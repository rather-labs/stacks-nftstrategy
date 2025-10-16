'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  Container,
  Divider,
  Flex,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Text,
  useToast,
  VStack,
  Progress,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useNetwork } from '@/lib/use-network';
import {
  buildBuyAndRelistTx,
  buildBuyTokenAndBurnTx,
  fetchSoldNfts,
  getStrategyContractsSummary,
  StrategyMetrics,
  SoldNft,
} from '@/lib/strategy/operations';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { shouldUseDirectCall, executeContractCall, openContractCall } from '@/lib/contract-utils';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { useNftHoldings } from '@/hooks/useNftHoldings';
import { getStrategyPrincipal } from '@/constants/contracts';
import { formatValue } from '@/lib/clarity-utils';
import { getPlaceholderImage } from '@/utils/nft-utils';
import { getAccountExplorerLink, getExplorerLink } from '@/utils/explorer-links';

const MICROSTX_IN_STX = 1_000_000;

const extractTokenId = (value: any): number | null => {
  if (!value) return null;
  if (typeof value.repr === 'string') {
    const reprMatch = /u(\d+)/.exec(value.repr);
    if (reprMatch) return Number(reprMatch[1]);
  }
  if (typeof value.hex === 'string') {
    const formatted = formatValue(value.hex);
    const hexMatch = /u(\d+)/.exec(formatted);
    if (hexMatch) return Number(hexMatch[1]);
  }
  return null;
};

export default function StrategyDashboard() {
  const toast = useToast();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { currentWallet } = useDevnetWallet();

  const [pendingBuyTxId, setPendingBuyTxId] = useState<string | null>(null);
  const [pendingBurnTxId, setPendingBurnTxId] = useState<string | null>(null);
  const [isBuyingFloor, setIsBuyingFloor] = useState(false);
  const [isBurning, setIsBurning] = useState(false);

  const strategyPrincipal = useMemo(
    () => (network ? getStrategyPrincipal(network) : ''),
    [network]
  );

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery<StrategyMetrics>({
    queryKey: ['strategy-metrics', network],
    queryFn: () =>
      network
        ? getStrategyContractsSummary(network)
        : Promise.resolve({ feeBalance: 0, stxBalance: 0, floorListing: null }),
    enabled: !!network,
    refetchInterval: 15000,
  });

  const {
    data: soldNfts = [],
    isLoading: soldLoading,
    refetch: refetchSold,
  } = useQuery<SoldNft[]>({
    queryKey: ['strategy-sold-nfts', network],
    queryFn: () => (network ? fetchSoldNfts(network) : Promise.resolve([])),
    enabled: !!network,
    refetchInterval: 30000,
  });

  const {
    data: holdingsData,
    isLoading: holdingsLoading,
    refetch: refetchHoldings,
  } = useNftHoldings(strategyPrincipal);

  const refreshAll = useCallback(() => {
    void refetchMetrics();
    void refetchSold();
    if (strategyPrincipal) {
      void refetchHoldings();
    }
  }, [refetchMetrics, refetchSold, refetchHoldings, strategyPrincipal]);

  const handleBuyFloor = useCallback(async () => {
    if (!network || !metrics?.floorListing) {
      toast({
        title: 'No floor listing available',
        description: 'The marketplace does not currently have a floor listing to purchase.',
        status: 'info',
      });
      return;
    }

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before executing strategy actions.',
        status: 'warning',
      });
      return;
    }

    setIsBuyingFloor(true);
    const txOptions = buildBuyAndRelistTx(
      network,
      metrics.floorListing.id,
      metrics.floorListing.price,
      metrics.floorListing.tokenId
    );

    try {
      if (shouldUseDirectCall()) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingBuyTxId(txid);
        toast({
          title: 'Transaction submitted',
          description: `Broadcast buy-and-relist transaction ${txid}`,
          status: 'info',
        });
        refreshAll();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingBuyTxId(txId);
          toast({
            title: 'Buy floor submitted',
            description: 'Transaction submitted to the Stacks network.',
            status: 'success',
          });
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Transaction cancelled',
            description: 'You cancelled the buy-and-relist transaction.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Buy floor failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsBuyingFloor(false);
    }
  }, [network, metrics, currentAddress, toast, currentWallet, refreshAll, shouldUseDirectCall]);

  const handleBurn = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before executing strategy actions.',
        status: 'warning',
      });
      return;
    }

    setIsBurning(true);
    const txOptions = buildBuyTokenAndBurnTx(network);

    try {
      if (shouldUseDirectCall()) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingBurnTxId(txid);
        toast({
          title: 'Burn submitted',
          description: `Broadcast buy-token-and-burn transaction ${txid}`,
          status: 'info',
        });
        refreshAll();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingBurnTxId(txId);
          toast({
            title: 'Burn submitted',
            description: 'RATHER burn transaction submitted to Stacks.',
            status: 'success',
          });
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Transaction cancelled',
            description: 'You cancelled the burn transaction.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Burn failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsBurning(false);
    }
  }, [network, currentAddress, toast, currentWallet, refreshAll, shouldUseDirectCall]);

  if (!network) {
    return (
      <Center minH="60vh">
        <Spinner />
      </Center>
    );
  }

  const holdings = holdingsData?.results ?? [];
  const feeBalanceStx = metrics ? metrics.feeBalance / MICROSTX_IN_STX : 0;
  const stxBalance = metrics ? metrics.stxBalance / MICROSTX_IN_STX : 0;
  const burnableStx = metrics
    ? Math.max(metrics.stxBalance - metrics.feeBalance, 0) / MICROSTX_IN_STX
    : 0;
  const floorPriceStx = metrics?.floorListing ? metrics.floorListing.price / MICROSTX_IN_STX : null;
  const purchaseProgress =
    !metricsLoading && floorPriceStx && floorPriceStx > 0
      ? Math.min((feeBalanceStx / floorPriceStx) * 100, 100)
      : 0;

  return (
    <Container maxW="6xl" py={10}>
      <VStack align="stretch" spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Strategy Dashboard</Heading>
          <Text color="gray.600">
            Monitor strategy treasury, marketplace floor, and recent execution on Stacks testnet.
          </Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Stat>
                  <StatLabel>Treasury Balance</StatLabel>
                  <StatNumber>
                    {metricsLoading ? '—' : `${feeBalanceStx.toFixed(3)} STX`}
                  </StatNumber>
                  <StatHelpText mt={1} color="gray.500">
                    Portion of the strategy STX reserved for NFT purchases.
                  </StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Burnable Balance</StatLabel>
                  <StatNumber>{metricsLoading ? '—' : `${burnableStx.toFixed(3)} STX`}</StatNumber>
                  <StatHelpText mt={1} color="gray.500">
                    Total STX accrued on NFT sales.
                  </StatHelpText>
                </Stat>
                {pendingBurnTxId && (
                  <Link
                    fontSize="sm"
                    color="blue.500"
                    href={getExplorerLink(pendingBurnTxId, network)}
                    isExternal
                  >
                    View burn transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Stat>
                  <StatLabel>Floor Listing</StatLabel>
                  <StatNumber>
                    {metricsLoading
                      ? '—'
                      : floorPriceStx !== null
                        ? `${floorPriceStx.toFixed(2)} STX`
                        : 'No listings'}
                  </StatNumber>
                </Stat>
                {metrics?.floorListing && (
                  <Text fontSize="sm" color="gray.600">
                    Token #{metrics.floorListing.tokenId} by{' '}
                    {metrics.floorListing.maker.slice(0, 6)}…
                  </Text>
                )}
                <Stack spacing={2}>
                  <Text fontSize="sm" color="gray.600">
                    Progress toward next floor purchase
                  </Text>
                  <Progress
                    value={purchaseProgress}
                    colorScheme="purple"
                    size="sm"
                    borderRadius="full"
                    isIndeterminate={metricsLoading}
                  />
                  <Text fontSize="xs" color="gray.500">
                    {metricsLoading
                      ? 'Calculating progress…'
                      : floorPriceStx
                        ? `${purchaseProgress.toFixed(0)}% of ${floorPriceStx.toFixed(2)} STX target`
                        : 'No active marketplace listing detected.'}
                  </Text>
                </Stack>
                {pendingBuyTxId && (
                  <Link
                    fontSize="sm"
                    color="blue.500"
                    href={getExplorerLink(pendingBuyTxId, network)}
                    isExternal
                  >
                    View buy transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Strategy Principal</StatLabel>
                <StatNumber fontSize="lg">
                  <Link
                    color="blue.500"
                    href={getAccountExplorerLink(strategyPrincipal, network)}
                    isExternal
                  >
                    {strategyPrincipal}
                  </Link>
                </StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Stack spacing={2}>
                <Heading size="md">Strategy Actions</Heading>
                <Text fontSize="sm" color="gray.600">
                  Execute the automated steps directly from your connected wallet.
                </Text>
              </Stack>
              <HStack spacing={3}>
                <Button
                  colorScheme="purple"
                  onClick={handleBuyFloor}
                  isLoading={isBuyingFloor}
                  isDisabled={!metrics?.floorListing || !currentAddress}
                >
                  Buy Floor &amp; Relist
                </Button>
                <Button
                  colorScheme="orange"
                  variant="outline"
                  onClick={handleBurn}
                  isLoading={isBurning}
                  isDisabled={!currentAddress || !metrics || metrics.feeBalance === 0}
                >
                  Buy RATHER &amp; Burn
                </Button>
              </HStack>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            <Text fontSize="sm" color="gray.600">
              The buy action consumes treasury STX to purchase the lowest-priced Funny Dog NFT and
              relists it at a premium. The burn action routes available STX through the liquidity
              pool, acquires RATHER, and burns it to reduce supply.
            </Text>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Card>
            <CardHeader>
              <Heading size="md">Current Holdings</Heading>
              <Text fontSize="sm" color="gray.600" mt={2}>
                NFTs currently held or relisted by the strategy contract.
              </Text>
            </CardHeader>
            <Divider />
            <CardBody>
              {holdingsLoading ? (
                <Center py={6}>
                  <Spinner />
                </Center>
              ) : holdings.length === 0 ? (
                <Text fontSize="sm" color="gray.600">
                  Strategy contract does not hold any Funny Dog NFTs right now.
                </Text>
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  {holdings.map((holding) => {
                    const assetContract = holding.asset_identifier.split('::')[0];
                    const tokenId = extractTokenId(holding.value);
                    if (tokenId === null) return null;

                    return (
                      <Card key={`${holding.asset_identifier}-${tokenId}`} bg="gray.50">
                        <CardBody>
                          <VStack align="start" spacing={3}>
                            <Box w="100%" borderRadius="md" overflow="hidden">
                              {getPlaceholderImage(network, assetContract, tokenId) ? (
                                <Box
                                  as="img"
                                  src={getPlaceholderImage(network, assetContract, tokenId) || ''}
                                  alt={`NFT #${tokenId}`}
                                  w="100%"
                                  h="160px"
                                  objectFit="cover"
                                />
                              ) : (
                                <Box w="100%" h="160px" bg="gray.200" />
                              )}
                            </Box>
                            <Heading size="sm">NFT #{tokenId}</Heading>
                            <Text fontSize="xs" color="gray.500">
                              {assetContract}
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Heading size="md">Recent Sales</Heading>
              <Text fontSize="sm" color="gray.600" mt={2}>
                Transfers executed from the strategy contract to external buyers.
              </Text>
            </CardHeader>
            <Divider />
            <CardBody>
              {soldLoading ? (
                <Center py={6}>
                  <Spinner />
                </Center>
              ) : soldNfts.length === 0 ? (
                <Text fontSize="sm" color="gray.600">
                  No sales detected yet. Run strategy actions to list and sell NFTs.
                </Text>
              ) : (
                <Stack spacing={4}>
                  {soldNfts.map((sale) => (
                    <Box
                      key={`${sale.txId}-${sale.tokenId}`}
                      p={3}
                      borderWidth="1px"
                      borderRadius="md"
                    >
                      <HStack justify="space-between" align="start">
                        <Stack spacing={1}>
                          <Text fontWeight="semibold">NFT #{sale.tokenId}</Text>
                          <Text fontSize="sm" color="gray.600">
                            Recipient {sale.recipient.slice(0, 6)}…{sale.recipient.slice(-4)}
                          </Text>
                        </Stack>
                        <Badge colorScheme="purple">Block {sale.blockHeight}</Badge>
                      </HStack>
                      <Link
                        mt={2}
                        fontSize="sm"
                        color="blue.500"
                        href={getExplorerLink(sale.txId, network)}
                        isExternal
                      >
                        View transaction <ExternalLinkIcon mx="4px" />
                      </Link>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
