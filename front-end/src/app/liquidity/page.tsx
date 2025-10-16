'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Link,
  NumberInput,
  NumberInputField,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useNetwork } from '@/lib/use-network';
import {
  buildSwapRatherForStxTx,
  buildSwapStxForRatherTx,
  fetchPoolReserves,
  fetchQuoteRatherForStx,
  fetchQuoteStxForRather,
  formatPoolReserves,
  SwapDirection,
  toMicroAmount,
} from '@/lib/pool/operations';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { executeContractCall, openContractCall, shouldUseDirectCall } from '@/lib/contract-utils';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getExplorerLink } from '@/utils/explorer-links';

const MICROSTX_IN_STX = 1_000_000;

export default function LiquidityPage() {
  const toast = useToast();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { currentWallet } = useDevnetWallet();

  const [swapDirection, setSwapDirection] = useState<SwapDirection>('stx-to-rather');
  const [swapAmount, setSwapAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [pendingSwapTxId, setPendingSwapTxId] = useState<string | null>(null);

  const {
    data: poolReserves,
    isLoading: poolLoading,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ['liquidity-pool-reserves', network],
    queryFn: () =>
      network
        ? fetchPoolReserves(network)
        : Promise.resolve({ stx: 0, rather: 0, initialized: false }),
    enabled: !!network,
    refetchInterval: 20000,
  });

  const amountIn = useMemo(() => toMicroAmount(swapAmount), [swapAmount]);
  const {
    data: quote = 0,
    isLoading: quoteLoading,
    refetch: refetchQuote,
  } = useQuery({
    queryKey: ['liquidity-pool-quote', network, swapDirection, amountIn],
    queryFn: () => {
      if (!network || amountIn <= 0) return Promise.resolve(0);
      return swapDirection === 'stx-to-rather'
        ? fetchQuoteStxForRather(network, amountIn)
        : fetchQuoteRatherForStx(network, amountIn);
    },
    enabled: !!network && amountIn > 0,
    refetchInterval: 20000,
  });

  const inputTokenLabel = swapDirection === 'stx-to-rather' ? 'STX' : 'RATHER';
  const outputTokenLabel = swapDirection === 'stx-to-rather' ? 'RATHER' : 'STX';
  const formattedReserves = poolReserves ? formatPoolReserves(poolReserves) : null;
  const poolInitialized = poolReserves?.initialized ?? false;
  const estimatedOutput = quote / MICROSTX_IN_STX;
  const swapButtonLabel =
    swapDirection === 'stx-to-rather' ? 'Swap STX for RATHER' : 'Swap RATHER for STX';
  const isSwapDisabled =
    !currentAddress || !poolInitialized || amountIn <= 0 || quote <= 0 || isSwapping;

  const handleDirectionChange = useCallback((direction: SwapDirection) => {
    setSwapDirection(direction);
    setSwapAmount('');
    setPendingSwapTxId(null);
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    setSwapAmount(value);
  }, []);

  const handleSwap = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before swapping.',
        status: 'warning',
      });
      return;
    }

    if (!poolInitialized) {
      toast({
        title: 'Pool not initialized',
        description: 'Initialize the pool before executing swaps.',
        status: 'warning',
      });
      return;
    }

    if (amountIn <= 0 || quote <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter an amount to receive an execution quote.',
        status: 'warning',
      });
      return;
    }

    setIsSwapping(true);
    setPendingSwapTxId(null);

    const txOptions =
      swapDirection === 'stx-to-rather'
        ? buildSwapStxForRatherTx(network, currentAddress, amountIn, quote)
        : buildSwapRatherForStxTx(network, currentAddress, amountIn, quote);

    try {
      if (shouldUseDirectCall()) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }

        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingSwapTxId(txid);
        toast({
          title: 'Swap submitted',
          description: `Broadcast swap transaction ${txid}`,
          status: 'info',
        });
        setSwapAmount('');
        void refetchPool();
        void refetchQuote();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingSwapTxId(txId);
          toast({
            title: 'Swap submitted',
            description: 'Swap transaction submitted to the Stacks network.',
            status: 'success',
          });
          setSwapAmount('');
          void refetchPool();
          void refetchQuote();
        },
        onCancel: () => {
          toast({
            title: 'Swap cancelled',
            description: 'You cancelled the swap transaction.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Swap failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsSwapping(false);
    }
  }, [
    network,
    currentAddress,
    poolInitialized,
    amountIn,
    quote,
    swapDirection,
    currentWallet,
    toast,
    refetchPool,
    refetchQuote,
  ]);

  return (
    <Container maxW="container.lg" py={8}>
      <Stack spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Liquidity Pool</Heading>
          <Text color="text.secondary">
            Monitor reserves and execute swaps between STX and RATHER to keep the strategy funded.
          </Text>
        </Stack>

        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Stack spacing={2}>
                <Heading size="md">Pool Overview</Heading>
                <Text fontSize="sm" color="text.secondary">
                  Reserves update automatically every few seconds. Swapping accrues protocol fees to
                  the treasury.
                </Text>
              </Stack>
              <Badge colorScheme={poolInitialized ? 'green' : 'yellow'}>
                {poolInitialized ? 'Initialized' : 'Needs init'}
              </Badge>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            <Stack spacing={6}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box borderWidth="1px" borderRadius="md" p={4}>
                  <Text fontSize="sm" color="text.secondary">
                    STX Reserve
                  </Text>
                  <Heading size="md" mt={1}>
                    {poolLoading || !formattedReserves
                      ? '—'
                      : `${formattedReserves.stx.toFixed(3)} STX`}
                  </Heading>
                </Box>
                <Box borderWidth="1px" borderRadius="md" p={4}>
                  <Text fontSize="sm" color="text.secondary">
                    RATHER Reserve
                  </Text>
                  <Heading size="md" mt={1}>
                    {poolLoading || !formattedReserves
                      ? '—'
                      : `${formattedReserves.rather.toFixed(3)} RATHER`}
                  </Heading>
                </Box>
              </SimpleGrid>

              {!poolInitialized && (
                <Text fontSize="sm" color="accent.primary">
                  Liquidity pool is not initialized yet. Deployers should call <code>init</code> on
                  the pool contract before attempting swaps.
                </Text>
              )}

              <Box>
                <Text fontSize="sm" color="text.secondary" mb={2}>
                  Choose swap direction
                </Text>
                <ButtonGroup isAttached size="sm">
                  <Button
                    onClick={() => handleDirectionChange('stx-to-rather')}
                    variant={swapDirection === 'stx-to-rather' ? 'solid' : 'outline'}
                    colorScheme={swapDirection === 'stx-to-rather' ? 'teal' : 'gray'}
                  >
                    STX → RATHER
                  </Button>
                  <Button
                    onClick={() => handleDirectionChange('rather-to-stx')}
                    variant={swapDirection === 'rather-to-stx' ? 'solid' : 'outline'}
                    colorScheme={swapDirection === 'rather-to-stx' ? 'teal' : 'gray'}
                  >
                    RATHER → STX
                  </Button>
                </ButtonGroup>
              </Box>

              <FormControl>
                <FormLabel>Amount ({inputTokenLabel})</FormLabel>
                <NumberInput
                  value={swapAmount}
                  min={0}
                  precision={6}
                  step={0.01}
                  clampValueOnBlur={false}
                  onChange={(valueString) => handleAmountChange(valueString)}
                >
                  <NumberInputField placeholder={`0.0 ${inputTokenLabel}`} />
                </NumberInput>
                <Text mt={2} fontSize="xs" color="text.tertiary">
                  Enter the {inputTokenLabel} amount you wish to trade through the pool.
                </Text>
              </FormControl>

              <Box>
                {quoteLoading ? (
                  <HStack spacing={2}>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="text.secondary">
                      Fetching quote...
                    </Text>
                  </HStack>
                ) : amountIn > 0 && quote > 0 ? (
                  <Stack spacing={1}>
                    <Text fontSize="sm" color="text.secondary">
                      Estimated output:{' '}
                      <Text as="span" fontWeight="semibold">
                        {estimatedOutput.toFixed(6)} {outputTokenLabel}
                      </Text>
                    </Text>
                    <Text fontSize="xs" color="text.tertiary">
                      Each swap routes a 10% fee to the strategy treasury automatically.
                    </Text>
                  </Stack>
                ) : (
                  <Text fontSize="sm" color="text.tertiary">
                    Enter an amount to preview swap output and minimum received.
                  </Text>
                )}
              </Box>

              <Button
                colorScheme="teal"
                onClick={handleSwap}
                isDisabled={isSwapDisabled}
                isLoading={isSwapping}
              >
                {swapButtonLabel}
              </Button>

              {pendingSwapTxId && (
                <Link
                  fontSize="sm"
                  color="link.primary"
                  href={getExplorerLink(pendingSwapTxId, network)}
                  isExternal
                >
                  View swap transaction <ExternalLinkIcon mx="4px" />
                </Link>
              )}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </Container>
  );
}
