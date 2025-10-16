'use client';
import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
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
  Tooltip,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useNetwork } from '@/lib/use-network';
import {
  buildBuyAndRelistTx,
  buildBuyTokenAndBurnTx,
  fetchStrategyBurnStats,
  getStrategyContractsSummary,
  StrategyBurnStats,
  StrategyMetrics,
} from '@/lib/strategy/operations';
import { fetchListings, Listing } from '@/lib/marketplace/operations';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { shouldUseDirectCall, executeContractCall, openContractCall } from '@/lib/contract-utils';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getStrategyPrincipal } from '@/constants/contracts';
import { getAccountExplorerLink, getExplorerLink } from '@/utils/explorer-links';
import { TokenImage } from '@/components/nft/TokenImage';

const MICROSTX_IN_STX = 1_000_000;

export default function StrategyDashboard() {
  const toast = useToast();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { currentWallet } = useDevnetWallet();
  const directCallEnabled = shouldUseDirectCall();

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
    data: burnStats,
    isLoading: burnStatsLoading,
    refetch: refetchBurnStats,
  } = useQuery<StrategyBurnStats>({
    queryKey: ['strategy-burn-stats', network],
    queryFn: () =>
      network ? fetchStrategyBurnStats(network) : Promise.resolve({ burned: 0, initialSupply: 0 }),
    enabled: !!network,
    refetchInterval: 30000,
  });

  const {
    data: strategyListings = [],
    isLoading: listingsLoading,
    refetch: refetchStrategyListings,
  } = useQuery<Listing[]>({
    queryKey: ['strategy-owned-listings', network, strategyPrincipal],
    queryFn: () =>
      network && strategyPrincipal
        ? fetchListings(network).then((listings) =>
            listings.filter((listing) => listing.maker === strategyPrincipal)
          )
        : Promise.resolve([]),
    enabled: !!network && !!strategyPrincipal,
    refetchInterval: 20000,
  });

  const refreshAll = useCallback(() => {
    void refetchMetrics();
    void refetchBurnStats();
    if (strategyPrincipal) {
      void refetchStrategyListings();
    }
  }, [refetchMetrics, refetchBurnStats, refetchStrategyListings, strategyPrincipal]);

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
      if (directCallEnabled) {
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
  }, [network, metrics, currentAddress, toast, currentWallet, refreshAll, directCallEnabled]);

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
      if (directCallEnabled) {
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
  }, [network, currentAddress, toast, currentWallet, refreshAll, directCallEnabled]);

  if (!network) {
    return (
      <Center minH="60vh">
        <Spinner />
      </Center>
    );
  }

  const marketplaceHoldingCount = strategyListings.length;
  const feeBalanceStx = metrics ? metrics.feeBalance / MICROSTX_IN_STX : 0;
  const burnableStx = metrics
    ? Math.max(metrics.stxBalance - metrics.feeBalance, 0) / MICROSTX_IN_STX
    : 0;
  const floorPriceStx = metrics?.floorListing ? metrics.floorListing.price / MICROSTX_IN_STX : null;
  const purchaseProgress =
    !metricsLoading && floorPriceStx && floorPriceStx > 0
      ? Math.min((feeBalanceStx / floorPriceStx) * 100, 100)
      : 0;

  const burnedRather = burnStats ? burnStats.burned / MICROSTX_IN_STX : 0;
  const totalSupplyRather = burnStats ? burnStats.initialSupply / MICROSTX_IN_STX : 0;
  const burnedPercentage =
    !burnStatsLoading && totalSupplyRather > 0 ? (burnedRather / totalSupplyRather) * 100 : 0;

  return (
    <Container maxW="6xl" py={10}>
      <VStack align="stretch" spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Strategy Dashboard</Heading>
          <Text color="text.secondary">
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
                  <StatHelpText mt={1} color="text.tertiary">
                    Portion of the strategy STX reserved for NFT purchases.
                  </StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Burnable Balance</StatLabel>
                  <StatNumber>{metricsLoading ? '—' : `${burnableStx.toFixed(3)} STX`}</StatNumber>
                  <StatHelpText mt={1} color="text.tertiary">
                    Total STX accrued on NFT sales.
                  </StatHelpText>
                </Stat>
                {pendingBurnTxId && (
                  <Link
                    fontSize="sm"
                    color="link.primary"
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
                  <Text fontSize="sm" color="text.secondary">
                    Token #{metrics.floorListing.tokenId} by{' '}
                    {metrics.floorListing.maker.slice(0, 6)}…
                  </Text>
                )}
                <Stack spacing={2}>
                  <Text fontSize="sm" color="text.secondary">
                    Progress toward next floor purchase
                  </Text>
                  <Progress
                    value={purchaseProgress}
                    colorScheme="purple"
                    size="sm"
                    borderRadius="full"
                    isIndeterminate={metricsLoading}
                  />
                  <Text fontSize="xs" color="text.tertiary">
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
                    color="link.primary"
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
                    color="link.primary"
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
                <Text fontSize="sm" color="text.secondary">
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
                  colorScheme="red"
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
            <Text fontSize="sm" color="text.secondary">
              The buy action consumes treasury STX to purchase the lowest-priced Funny Dog NFT and
              relists it at a premium. The burn action routes available STX through the liquidity
              pool, acquires RATHER, and burns it to reduce supply.
            </Text>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Card>
            <CardHeader>
              <Stack spacing={1}>
                <HStack spacing={2} align="center">
                  <Heading size="md">Current Holdings</Heading>
                  <Badge colorScheme="purple">
                    {listingsLoading ? '—' : marketplaceHoldingCount}
                  </Badge>
                </HStack>
              </Stack>
            </CardHeader>
            <Divider />
            <CardBody>
              {listingsLoading ? (
                <Center py={6}>
                  <Spinner />
                </Center>
              ) : marketplaceHoldingCount === 0 ? (
                <Text fontSize="sm" color="text.secondary">
                  Strategy contract does not hold any Funny Dog NFTs right now.
                </Text>
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  {strategyListings.map((listing) => {
                    const assetContract = listing.nftAssetContract;
                    const tokenId = listing.tokenId;
                    const contractHref = getAccountExplorerLink(assetContract, network);
                    const shortenedContract = `${assetContract.slice(0, 6)}…${assetContract.slice(-4)}`;

                    return (
                      <Card key={`${listing.id}-${tokenId}`} bg="bg.subtle">
                        <CardBody>
                          <VStack align="start" spacing={3}>
                            <TokenImage
                              tokenId={tokenId}
                              alt={`Funny Dog #${tokenId}`}
                              borderRadius="md"
                            />
                            <Heading size="sm">NFT #{tokenId}</Heading>
                            <Tooltip label={assetContract} placement="top" hasArrow>
                              <Link
                                fontSize="xs"
                                color="link.primary"
                                href={contractHref}
                                isExternal
                                noOfLines={1}
                              >
                                {shortenedContract}
                              </Link>
                            </Tooltip>
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
              <Stack spacing={1}>
                <Heading size="md">Burned RATHER</Heading>
              </Stack>
            </CardHeader>
            <Divider />
            <Text fontSize="sm" color="text.secondary" mt={3} textAlign="center" px={6}>
              Tracks cumulative RATHER removed from circulation by the strategy.
            </Text>
            <CardBody>
              {burnStatsLoading ? (
                <Center py={6}>
                  <Spinner />
                </Center>
              ) : (
                <Stack spacing={5}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <Stat>
                      <StatLabel>Total Burned</StatLabel>
                      <StatNumber>{`${burnedRather.toFixed(3)} RATHER`}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Supply Reduced</StatLabel>
                      <StatNumber>{`${burnedPercentage.toFixed(2)}%`}</StatNumber>
                      <StatHelpText mt={1} color="text.tertiary">
                        Initial supply{' '}
                        {totalSupplyRather.toLocaleString(undefined, {
                          maximumFractionDigits: 3,
                          minimumFractionDigits: 0,
                        })}{' '}
                        RATHER
                      </StatHelpText>
                    </Stat>
                  </SimpleGrid>
                  <Stack spacing={2}>
                    <Text fontSize="sm" color="text.secondary">
                      Burn progress against total supply
                    </Text>
                    <Progress
                      value={burnedPercentage}
                      colorScheme="orange"
                      size="sm"
                      borderRadius="full"
                      isIndeterminate={burnStatsLoading}
                    />
                    <Text fontSize="xs" color="text.tertiary">
                      {burnedPercentage > 0
                        ? `${burnedPercentage.toFixed(2)}% permanently removed from circulation.`
                        : 'No RATHER has been burned yet.'}
                    </Text>
                  </Stack>
                </Stack>
              )}
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
