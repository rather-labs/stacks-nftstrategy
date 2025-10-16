'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  Container,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  NumberInput,
  NumberInputField,
  Spinner,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { request } from '@stacks/connect';
import { useNetwork } from '@/lib/use-network';
import { buildMintStrategyTokenTx } from '@/lib/strategy/operations';
import { fetchStrategyMinted } from '@/lib/strategy/mint-status';
import {
  buildInitLiquidityPoolTx,
  buildUpdateReservesTx,
  fetchPoolReserves,
  formatPoolReserves,
  toMicroAmount,
} from '@/lib/pool/operations';
import {
  shouldUseDirectCall,
  executeContractCall,
  openContractCall,
  executeStxTransfer,
} from '@/lib/contract-utils';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getExplorerLink } from '@/utils/explorer-links';
import { getStrategyContract } from '@/constants/contracts';

const MICROSTX_IN_STX = 1_000_000;

export default function AdminUtilitiesPage() {
  const toast = useToast();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { currentWallet } = useDevnetWallet();
  const directCallEnabled = shouldUseDirectCall();

  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSendingStx, setIsSendingStx] = useState(false);
  const [pendingSendTxId, setPendingSendTxId] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [pendingMintTxId, setPendingMintTxId] = useState<string | null>(null);
  const [hasMintedTokens, setHasMintedTokens] = useState(false);
  const [isInitializingPool, setIsInitializingPool] = useState(false);
  const [pendingInitTxId, setPendingInitTxId] = useState<string | null>(null);
  const [isUpdatingReserves, setIsUpdatingReserves] = useState(false);
  const [pendingUpdateTxId, setPendingUpdateTxId] = useState<string | null>(null);

  const {
    data: mintedOnChain = false,
    isLoading: mintStatusLoading,
    refetch: refetchMintStatus,
  } = useQuery({
    queryKey: ['strategy-mint-status', network],
    queryFn: () => (network ? fetchStrategyMinted(network) : Promise.resolve(false)),
    enabled: !!network,
    refetchInterval: 20000,
  });

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

  const formattedReserves = poolReserves ? formatPoolReserves(poolReserves) : null;
  const poolInitialized = poolReserves?.initialized ?? false;
  const sendAmountMicro = useMemo(() => toMicroAmount(sendAmount), [sendAmount]);
  const strategyDeployer = useMemo(() => {
    if (!network) return null;
    return getStrategyContract(network).contractAddress;
  }, [network]);
  const normalizedCurrentAddress = currentAddress?.toUpperCase() ?? null;
  const normalizedDeployer = strategyDeployer?.toUpperCase() ?? null;
  const isTestnet = network === 'testnet';
  const isAuthorized =
    !isTestnet ||
    (!!normalizedCurrentAddress &&
      !!normalizedDeployer &&
      normalizedCurrentAddress === normalizedDeployer);

  const isSendDisabled = !currentAddress || sendAmountMicro <= 0 || !sendRecipient || isSendingStx;
  const isMintDisabled = !currentAddress || isMinting || hasMintedTokens || mintStatusLoading;
  const isInitDisabled = !currentAddress || isInitializingPool || poolInitialized;
  const isUpdateReservesDisabled = !currentAddress || isUpdatingReserves;

  const refreshAll = useCallback(() => {
    void refetchMintStatus();
    void refetchPool();
  }, [refetchMintStatus, refetchPool]);

  useEffect(() => {
    if (mintedOnChain) {
      setHasMintedTokens(true);
    } else if (!mintStatusLoading && !pendingMintTxId) {
      setHasMintedTokens(false);
    }
  }, [mintedOnChain, mintStatusLoading, pendingMintTxId]);

  useEffect(() => {
    setPendingMintTxId(null);
    setHasMintedTokens(false);
  }, [network]);

  const handleSendStx = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before sending STX.',
        status: 'warning',
      });
      return;
    }

    const cleanedRecipient = sendRecipient.trim();
    if (
      !cleanedRecipient ||
      (!cleanedRecipient.startsWith('ST') && !cleanedRecipient.startsWith('SP'))
    ) {
      toast({
        title: 'Invalid recipient',
        description: 'Enter a valid Stacks principal (ST/SP) to send STX.',
        status: 'warning',
      });
      return;
    }

    if (sendAmountMicro <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter a positive STX amount to transfer.',
        status: 'warning',
      });
      return;
    }

    setIsSendingStx(true);
    setPendingSendTxId(null);
    try {
      if (directCallEnabled) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeStxTransfer(
          {
            recipient: cleanedRecipient,
            amount: sendAmountMicro,
          },
          currentWallet
        );
        setPendingSendTxId(txid);
        toast({
          title: 'Transfer submitted',
          description: `Broadcast STX transfer ${txid}`,
          status: 'info',
        });
        setSendAmount('');
        refreshAll();
        return;
      }

      const response = await request('stx_transferStx', {
        amount: sendAmountMicro.toString(),
        recipient: cleanedRecipient,
      });

      if (response.txid) {
        setPendingSendTxId(response.txid);
        toast({
          title: 'Transfer submitted',
          description: 'STX transfer submitted to the Stacks network.',
          status: 'success',
        });
        setSendAmount('');
        setSendRecipient('');
        refreshAll();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Transfer failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsSendingStx(false);
    }
  }, [
    network,
    currentAddress,
    sendRecipient,
    sendAmountMicro,
    directCallEnabled,
    currentWallet,
    toast,
    refreshAll,
  ]);

  const handleMintTokens = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before minting tokens.',
        status: 'warning',
      });
      return;
    }

    setIsMinting(true);
    setPendingMintTxId(null);

    const txOptions = buildMintStrategyTokenTx(network);

    try {
      if (directCallEnabled) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingMintTxId(txid);
        toast({
          title: 'Mint submitted',
          description: `Broadcast strategy mint transaction ${txid}`,
          status: 'info',
        });
        setHasMintedTokens(true);
        void refetchMintStatus();
        refreshAll();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingMintTxId(txId);
          toast({
            title: 'Mint submitted',
            description: 'Mint transaction submitted to the Stacks network.',
            status: 'success',
          });
          setHasMintedTokens(true);
          void refetchMintStatus();
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Transaction cancelled',
            description: 'You cancelled the mint transaction.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Mint failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsMinting(false);
    }
  }, [
    network,
    currentAddress,
    directCallEnabled,
    currentWallet,
    toast,
    refreshAll,
    refetchMintStatus,
  ]);

  const handleInitPool = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before initializing the pool.',
        status: 'warning',
      });
      return;
    }

    if (poolInitialized) {
      toast({
        title: 'Pool already initialized',
        description: 'The liquidity pool has already been initialized.',
        status: 'info',
      });
      return;
    }

    setIsInitializingPool(true);
    setPendingInitTxId(null);

    const txOptions = buildInitLiquidityPoolTx(network);

    try {
      if (directCallEnabled) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingInitTxId(txid);
        toast({
          title: 'Init submitted',
          description: `Broadcast pool init transaction ${txid}`,
          status: 'info',
        });
        refreshAll();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingInitTxId(txId);
          toast({
            title: 'Init submitted',
            description: 'Liquidity pool initialization submitted to Stacks.',
            status: 'success',
          });
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Transaction cancelled',
            description: 'You cancelled the pool initialization.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Init failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsInitializingPool(false);
    }
  }, [
    network,
    currentAddress,
    poolInitialized,
    directCallEnabled,
    currentWallet,
    toast,
    refreshAll,
  ]);

  const handleUpdateReserves = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before updating reserves.',
        status: 'warning',
      });
      return;
    }

    setIsUpdatingReserves(true);
    setPendingUpdateTxId(null);

    const txOptions = buildUpdateReservesTx(network);

    try {
      if (directCallEnabled) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingUpdateTxId(txid);
        toast({
          title: 'Update submitted',
          description: `Broadcast reserve update transaction ${txid}`,
          status: 'info',
        });
        refreshAll();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingUpdateTxId(txId);
          toast({
            title: 'Update submitted',
            description: 'Reserve update submitted to the Stacks network.',
            status: 'success',
          });
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Transaction cancelled',
            description: 'You cancelled the reserve update.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsUpdatingReserves(false);
    }
  }, [network, currentAddress, directCallEnabled, currentWallet, toast, refreshAll]);

  if (!network) {
    return (
      <Center minH="60vh">
        <Spinner />
      </Center>
    );
  }

  if (!isAuthorized) {
    return (
      <Center minH="60vh" px={4} textAlign="center">
        <Stack spacing={4} align="center" maxW="lg">
          <Heading size="md">Restricted Access</Heading>
          <Text color="gray.600">
            Admin utilities on testnet are limited to the strategy deployer wallet.
          </Text>
          {strategyDeployer && (
            <Text fontSize="sm" color="gray.500">
              Connect with {strategyDeployer} to continue.
            </Text>
          )}
        </Stack>
      </Center>
    );
  }

  return (
    <Container maxW="4xl" py={10}>
      <VStack align="stretch" spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Admin Utilities</Heading>
          <Text color="text.secondary">
            Bootstrap and maintain the strategy protocol. These actions require deployer privileges.
          </Text>
        </Stack>

        <Card>
          <CardHeader>
            <Heading size="md">Protocol Status</Heading>
          </CardHeader>
          <Divider />
          <CardBody>
            <Stack spacing={4}>
              <Stack spacing={1}>
                <Text fontWeight="semibold">Strategy Mint</Text>
                <HStack spacing={3}>
                  <Badge colorScheme={hasMintedTokens ? 'green' : 'yellow'}>
                    {hasMintedTokens ? 'Mint complete' : 'Mint required'}
                  </Badge>
                  {mintStatusLoading && <Spinner size="sm" />}
                </HStack>
                <Text fontSize="sm" color="text.secondary">
                  Mint the RATHER supply to the strategy contract once after deployment.
                </Text>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Text fontWeight="semibold">Liquidity Pool</Text>
                <HStack spacing={3}>
                  <Badge colorScheme={poolInitialized ? 'green' : 'yellow'}>
                    {poolInitialized ? 'Initialized' : 'Needs init'}
                  </Badge>
                  {poolLoading && <Spinner size="sm" />}
                </HStack>
                {formattedReserves && poolInitialized ? (
                  <Text fontSize="sm" color="text.secondary">
                    Reserves: {formattedReserves.stx.toFixed(3)} STX /{' '}
                    {formattedReserves.rather.toFixed(3)} RATHER
                  </Text>
                ) : (
                  <Text fontSize="sm" color="text.secondary">
                    Initialize the pool to enable swaps and protocol fee capture.
                  </Text>
                )}
              </Stack>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading size="md">Operations</Heading>
          </CardHeader>
          <Divider />
          <CardBody>
            <Stack spacing={6} divider={<Divider />}>
              <Stack spacing={4}>
                <Stack spacing={1}>
                  <Heading size="sm">Send STX</Heading>
                  <Text fontSize="sm" color="text.secondary">
                    Transfer STX from the connected wallet to fund the strategy or collaborators.
                  </Text>
                </Stack>
                <FormControl>
                  <FormLabel>Recipient Principal</FormLabel>
                  <Input
                    value={sendRecipient}
                    onChange={(event) => setSendRecipient(event.target.value)}
                    placeholder="STX or contract address"
                  />
                  <FormHelperText>Example: ST.... or SP.... principal.</FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>Amount (STX)</FormLabel>
                  <NumberInput
                    value={sendAmount}
                    min={0}
                    precision={6}
                    step={0.1}
                    clampValueOnBlur={false}
                    onChange={(valueString) => setSendAmount(valueString)}
                  >
                    <NumberInputField placeholder="0.0 STX" />
                  </NumberInput>
                  <FormHelperText>
                    {sendAmountMicro > 0
                      ? `${(sendAmountMicro / MICROSTX_IN_STX).toFixed(6)} STX selected`
                      : 'Specify the STX amount to transfer.'}
                  </FormHelperText>
                </FormControl>
                <Button
                  colorScheme="blue"
                  onClick={handleSendStx}
                  isDisabled={isSendDisabled}
                  isLoading={isSendingStx}
                >
                  Send STX
                </Button>
                {pendingSendTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
                    href={getExplorerLink(pendingSendTxId, network)}
                    isExternal
                  >
                    View transfer transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
              </Stack>

              <Stack spacing={4}>
                <Stack spacing={1}>
                  <Heading size="sm">Contract Maintenance</Heading>
                  <Text fontSize="sm" color="text.secondary">
                    Run the one-time bootstrap actions for the strategy protocol.
                  </Text>
                </Stack>
                <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
                  <Button
                    colorScheme="purple"
                    onClick={handleMintTokens}
                    isDisabled={isMintDisabled}
                    isLoading={isMinting}
                  >
                    Mint Strategy Tokens
                  </Button>
                  <Button
                    colorScheme="teal"
                    variant={poolInitialized ? 'outline' : 'solid'}
                    onClick={handleInitPool}
                    isDisabled={isInitDisabled}
                    isLoading={isInitializingPool}
                  >
                    Init Liquidity Pool
                  </Button>
                  <Button
                    colorScheme="teal"
                    variant="outline"
                    onClick={handleUpdateReserves}
                    isDisabled={isUpdateReservesDisabled}
                    isLoading={isUpdatingReserves}
                  >
                    Update Reserves
                  </Button>
                </Stack>
                {pendingMintTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
                    href={getExplorerLink(pendingMintTxId, network)}
                    isExternal
                  >
                    View mint transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
                {pendingInitTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
                    href={getExplorerLink(pendingInitTxId, network)}
                    isExternal
                  >
                    View init transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
                {pendingUpdateTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
                    href={getExplorerLink(pendingUpdateTxId, network)}
                    isExternal
                  >
                    View update transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
                {poolInitialized && (
                  <Text fontSize="xs" color="text.tertiary">
                    Pool already initialized. Further calls will fail on-chain.
                  </Text>
                )}
              </Stack>
            </Stack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}
