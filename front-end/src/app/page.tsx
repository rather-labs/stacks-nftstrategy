'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Center,
  Container,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  NumberInput,
  NumberInputField,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { request } from '@stacks/connect';
import { useNetwork } from '@/lib/use-network';
import {
  buildBuyAndRelistTx,
  buildBuyTokenAndBurnTx,
  fetchSoldNfts,
  getStrategyContractsSummary,
  buildMintStrategyTokenTx,
  SoldNft,
} from '@/lib/strategy/operations';
import { fetchStrategyMinted } from '@/lib/strategy/mint-status';
import {
  buildSwapRatherForStxTx,
  buildSwapStxForRatherTx,
  buildInitLiquidityPoolTx,
  buildUpdateReservesTx,
  calculateMinOut,
  fetchPoolReserves,
  fetchQuoteRatherForStx,
  fetchQuoteStxForRather,
  formatPoolReserves,
  SwapDirection,
  toMicroAmount,
} from '@/lib/pool/operations';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import {
  shouldUseDirectCall,
  executeContractCall,
  openContractCall,
  executeStxTransfer,
} from '@/lib/contract-utils';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { useNftHoldings } from '@/hooks/useNftHoldings';
import { getStrategyPrincipal } from '@/constants/contracts';
import { formatValue } from '@/lib/clarity-utils';
import { getPlaceholderImage } from '@/utils/nft-utils';
import { getExplorerLink } from '@/utils/explorer-links';

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
  const [swapDirection, setSwapDirection] = useState<SwapDirection>('stx-to-rather');
  const [swapAmount, setSwapAmount] = useState('');
  const [slippagePercent, setSlippagePercent] = useState(1);
  const [isSwapping, setIsSwapping] = useState(false);
  const [pendingSwapTxId, setPendingSwapTxId] = useState<string | null>(null);
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

  const strategyPrincipal = useMemo(
    () => (network ? getStrategyPrincipal(network) : ''),
    [network]
  );

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['strategy-metrics', network],
    queryFn: () =>
      network
        ? getStrategyContractsSummary(network)
        : Promise.resolve({ feeBalance: 0, floorListing: null }),
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
    data: holdingsData,
    isLoading: holdingsLoading,
    refetch: refetchHoldings,
  } = useNftHoldings(strategyPrincipal);

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

  const slippageBps = useMemo(
    () => Math.max(1, Math.round(slippagePercent * 100)),
    [slippagePercent]
  );
  const amountIn = useMemo(() => toMicroAmount(swapAmount), [swapAmount, swapDirection]);

  const { data: quote = 0, isLoading: quoteLoading } = useQuery({
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
  console.log('quote = ', quote);
  const swapButtonLabel =
    swapDirection === 'stx-to-rather' ? 'Swap STX for RATHER' : 'Swap RATHER for STX';
  const isSwapDisabled =
    !currentAddress || !poolInitialized || amountIn <= 0 || quote <= 0 || isSwapping;
  const slippageLabel = slippagePercent.toFixed(1);
  const sendAmountMicro = useMemo(() => toMicroAmount(sendAmount), [sendAmount]);
  const isSendDisabled = !currentAddress || sendAmountMicro <= 0 || !sendRecipient || isSendingStx;
  const isMintDisabled = !currentAddress || isMinting || hasMintedTokens || mintStatusLoading;
  const isInitDisabled = !currentAddress || isInitializingPool || poolInitialized;
  const isUpdateReservesDisabled = !currentAddress || isUpdatingReserves;

  const handleDirectionChange = useCallback((direction: SwapDirection) => {
    setSwapDirection(direction);
    setSwapAmount('');
    setPendingSwapTxId(null);
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    setSwapAmount(value);
  }, []);

  const refreshAll = useCallback(() => {
    void refetchMetrics();
    void refetchSold();
    void refetchPool();
    void refetchMintStatus();
    if (strategyPrincipal) {
      void refetchHoldings();
    }
  }, [
    refetchMetrics,
    refetchSold,
    refetchPool,
    refetchMintStatus,
    refetchHoldings,
    strategyPrincipal,
  ]);

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
  }, [strategyPrincipal]);

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
        description: 'The liquidity pool must be initialized before performing swaps.',
        status: 'warning',
      });
      return;
    }

    if (amountIn <= 0 || quote <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter a valid amount to receive a quote before swapping.',
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
        refreshAll();
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
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Transaction cancelled',
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
    refreshAll,
    shouldUseDirectCall,
  ]);

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
      if (shouldUseDirectCall()) {
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

      // Handle successful response
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
    shouldUseDirectCall,
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
      if (shouldUseDirectCall()) {
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
    shouldUseDirectCall,
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
      if (shouldUseDirectCall()) {
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
    shouldUseDirectCall,
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
      if (shouldUseDirectCall()) {
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
  }, [network, currentAddress, shouldUseDirectCall, currentWallet, toast, refreshAll]);

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
    const txOptions = buildBuyAndRelistTx(network, metrics.floorListing.id);

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
  const floorPriceStx = metrics?.floorListing ? metrics.floorListing.price / MICROSTX_IN_STX : null;

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
              <Stat>
                <StatLabel>Treasury Balance</StatLabel>
                <StatNumber>{metricsLoading ? '—' : `${feeBalanceStx.toFixed(3)} STX`}</StatNumber>
              </Stat>
              <Text mt={3} fontSize="sm" color="gray.600">
                Fee-on-transfer accrual currently held by the strategy contract.
              </Text>
              {pendingBurnTxId && (
                <Link
                  mt={3}
                  fontSize="sm"
                  color="blue.500"
                  href={getExplorerLink(pendingBurnTxId, network)}
                  isExternal
                >
                  View burn transaction <ExternalLinkIcon mx="4px" />
                </Link>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
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
                <Text mt={3} fontSize="sm" color="gray.600">
                  Token #{metrics.floorListing.tokenId} by {metrics.floorListing.maker.slice(0, 6)}…
                </Text>
              )}
              {pendingBuyTxId && (
                <Link
                  mt={3}
                  fontSize="sm"
                  color="blue.500"
                  href={getExplorerLink(pendingBuyTxId, network)}
                  isExternal
                >
                  View buy transaction <ExternalLinkIcon mx="4px" />
                </Link>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Strategy Principal</StatLabel>
                <StatNumber fontSize="lg">{strategyPrincipal}</StatNumber>
              </Stat>
              <Text mt={3} fontSize="sm" color="gray.600">
                Contract currently executing buy and burn automation on testnet.
              </Text>
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

        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Stack spacing={2}>
                <Heading size="md">Liquidity Pool Swaps</Heading>
                <Text fontSize="sm" color="gray.600">
                  Swap between STX and RATHER to actively feed the strategy fee balance via pool
                  fees.
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
                  <Text fontSize="sm" color="gray.600">
                    STX Reserve
                  </Text>
                  <Heading size="md" mt={1}>
                    {poolLoading || !formattedReserves
                      ? '—'
                      : `${formattedReserves.stx.toFixed(3)} STX`}
                  </Heading>
                </Box>
                <Box borderWidth="1px" borderRadius="md" p={4}>
                  <Text fontSize="sm" color="gray.600">
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
                <Text fontSize="sm" color="orange.500">
                  Liquidity pool is not initialized yet. Deployers should call <code>init</code> on
                  the pool contract before attempting swaps.
                </Text>
              )}

              <Box>
                <Text fontSize="sm" color="gray.600" mb={2}>
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
                <Text mt={2} fontSize="xs" color="gray.500">
                  Enter the {inputTokenLabel} amount you wish to trade through the pool.
                </Text>
              </FormControl>

              <Box>
                {quoteLoading ? (
                  <HStack spacing={2}>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="gray.600">
                      Fetching quote...
                    </Text>
                  </HStack>
                ) : amountIn > 0 && quote > 0 ? (
                  <Stack spacing={1}>
                    <Text fontSize="sm" color="gray.600">
                      Estimated output:{' '}
                      <Text as="span" fontWeight="semibold">
                        {estimatedOutput.toFixed(6)} {outputTokenLabel}
                      </Text>
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Each swap routes a 10% fee to the strategy treasury automatically.
                    </Text>
                  </Stack>
                ) : (
                  <Text fontSize="sm" color="gray.500">
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
                  color="blue.500"
                  href={getExplorerLink(pendingSwapTxId, network)}
                  isExternal
                >
                  View swap transaction <ExternalLinkIcon mx="4px" />
                </Link>
              )}
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading size="md">Admin Utilities</Heading>
          </CardHeader>
          <Divider />
          <CardBody>
            <Stack spacing={6} divider={<Divider />}>
              <Stack spacing={4}>
                <Stack spacing={1}>
                  <Heading size="sm">Send STX</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Transfer STX from the connected wallet to fund the strategy or pay
                    collaborators.
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
                    color="blue.500"
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
                  <Text fontSize="sm" color="gray.600">
                    Bootstrap the strategy protocol once contracts are deployed.
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
                    colorScheme="orange"
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
                    color="blue.500"
                    href={getExplorerLink(pendingMintTxId, network)}
                    isExternal
                  >
                    View mint transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
                {pendingInitTxId && (
                  <Link
                    fontSize="sm"
                    color="blue.500"
                    href={getExplorerLink(pendingInitTxId, network)}
                    isExternal
                  >
                    View init transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
                {pendingUpdateTxId && (
                  <Link
                    fontSize="sm"
                    color="blue.500"
                    href={getExplorerLink(pendingUpdateTxId, network)}
                    isExternal
                  >
                    View update transaction <ExternalLinkIcon mx="4px" />
                  </Link>
                )}
                {poolInitialized && (
                  <Text fontSize="xs" color="gray.500">
                    Pool already initialized. Further calls will fail on-chain.
                  </Text>
                )}
              </Stack>
            </Stack>
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
