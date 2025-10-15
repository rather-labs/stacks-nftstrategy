'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  FormHelperText,
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
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { Listing, fetchListings, listAsset } from '@/lib/marketplace/operations';
import { useNetwork } from '@/lib/use-network';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { executeContractCall, openContractCall, shouldUseDirectCall } from '@/lib/contract-utils';
import { getNftContract } from '@/constants/contracts';
import { toMicroAmount } from '@/lib/pool/operations';
import { getExplorerLink } from '@/utils/explorer-links';
import { useNftHoldings, useGetTxId } from '@/hooks/useNftHoldings';
import { mintFunnyDogNFT } from '@/lib/nft/operations';
import { formatValue } from '@/lib/clarity-utils';
import { NftCard } from '@/components/marketplace/NftCard';

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

export default function MarketplacePage() {
  const toast = useToast();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { currentWallet } = useDevnetWallet();

  const [listTokenId, setListTokenId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [pendingListTxId, setPendingListTxId] = useState<string | null>(null);
  const [lastMintTxId, setLastMintTxId] = useState<string | null>(null);

  const {
    data: marketplaceListings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
  } = useQuery<Listing[]>({
    queryKey: ['marketplace-listings', network],
    queryFn: () => (network ? fetchListings(network) : Promise.resolve([])),
    enabled: !!network,
    refetchInterval: 20000,
  });

  const {
    data: nftHoldings,
    isLoading: nftHoldingsLoading,
    refetch: refetchNftHoldings,
  } = useNftHoldings(currentAddress ?? undefined);

  const { data: mintTxData } = useGetTxId(lastMintTxId || '');

  useEffect(() => {
    if (!mintTxData) return;
    // @ts-ignore - tx_status available on API responses
    const status = mintTxData.tx_status;
    if (status === 'success') {
      toast({
        title: 'Mint confirmed',
        description: 'Your NFT has been minted successfully.',
        status: 'success',
      });
      setLastMintTxId(null);
      void refetchNftHoldings();
      return;
    }
    if (status === 'abort_by_response') {
      toast({
        title: 'Mint failed',
        description: 'The transaction was aborted.',
        status: 'error',
      });
      setLastMintTxId(null);
    }
  }, [mintTxData, toast, refetchNftHoldings]);

  const listingPriceMicro = useMemo(() => toMicroAmount(listPrice), [listPrice]);
  const listTokenIdNumber = useMemo(() => {
    const parsed = Number(listTokenId);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [listTokenId]);

  const nftContract = network ? getNftContract(network) : null;
  const walletHoldings = nftHoldings?.results ?? [];
  const walletNftTokens = useMemo(() => {
    if (!nftContract) return [] as number[];
    const contractId = `${nftContract.contractAddress}.${nftContract.contractName}`;
    const tokenIds = new Set<number>();
    walletHoldings.forEach((holding) => {
      if (!holding.asset_identifier.startsWith(`${contractId}::`)) return;
      const tokenId = extractTokenId(holding.value);
      if (tokenId !== null) tokenIds.add(tokenId);
    });
    return Array.from(tokenIds).sort((a, b) => a - b);
  }, [walletHoldings, nftContract]);

  const isListDisabled =
    !currentAddress ||
    !Number.isFinite(listTokenIdNumber) ||
    listTokenIdNumber < 0 ||
    listingPriceMicro <= 0 ||
    isListing;

  const refreshAll = useCallback(() => {
    void refetchListings();
    if (currentAddress) {
      void refetchNftHoldings();
    }
  }, [refetchListings, refetchNftHoldings, currentAddress]);

  const handleCreateListing = useCallback(async () => {
    if (!network) return;

    if (!currentAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect a wallet before listing NFTs.',
        status: 'warning',
      });
      return;
    }

    if (!nftContract) {
      toast({
        title: 'NFT contract unavailable',
        description: 'Unable to resolve NFT contract for the current network.',
        status: 'error',
      });
      return;
    }

    if (!Number.isFinite(listTokenIdNumber) || listTokenIdNumber < 0) {
      toast({
        title: 'Invalid token',
        description: 'Select a valid NFT token ID to list.',
        status: 'warning',
      });
      return;
    }

    if (listingPriceMicro <= 0) {
      toast({
        title: 'Invalid price',
        description: 'Enter a listing price greater than zero.',
        status: 'warning',
      });
      return;
    }

    setIsListing(true);
    setPendingListTxId(null);

    const txOptions = listAsset(network, {
      sender: currentAddress,
      nftContractAddress: nftContract.contractAddress,
      nftContractName: nftContract.contractName,
      tokenId: listTokenIdNumber,
      price: listingPriceMicro,
    });

    try {
      if (shouldUseDirectCall()) {
        if (!currentWallet) {
          throw new Error('Devnet wallet is not configured');
        }
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPendingListTxId(txid);
        toast({
          title: 'Listing submitted',
          description: `Broadcast listing transaction ${txid}`,
          status: 'info',
        });
        setListTokenId('');
        setListPrice('');
        refreshAll();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: ({ txId }) => {
          setPendingListTxId(txId);
          toast({
            title: 'Listing submitted',
            description: 'NFT listed on the marketplace.',
            status: 'success',
          });
          setListTokenId('');
          setListPrice('');
          refreshAll();
        },
        onCancel: () => {
          toast({
            title: 'Listing cancelled',
            description: 'You cancelled the listing transaction.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Listing failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      });
    } finally {
      setIsListing(false);
    }
  }, [
    network,
    currentAddress,
    nftContract,
    listTokenIdNumber,
    listingPriceMicro,
    currentWallet,
    toast,
    refreshAll,
  ]);

  const handleMintNFT = useCallback(async () => {
    if (!network || !currentAddress) return;

    try {
      const txOptions = mintFunnyDogNFT(network, currentAddress);

      if (shouldUseDirectCall()) {
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setLastMintTxId(txid);
        toast({
          title: 'Mint submitted',
          description: `Transaction broadcast with ID: ${txid}`,
          status: 'info',
        });
        void refetchNftHoldings();
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          setLastMintTxId(data.txId);
          toast({
            title: 'Mint submitted',
            description: 'Mint transaction submitted to the network.',
            status: 'success',
          });
          void refetchNftHoldings();
        },
        onCancel: () => {
          toast({
            title: 'Mint cancelled',
            description: 'You cancelled the minting transaction.',
            status: 'info',
          });
        },
      });
    } catch (error) {
      console.error('Error minting NFT:', error);
      toast({
        title: 'Mint failed',
        description: 'Failed to mint NFT',
        status: 'error',
      });
    }
  }, [network, currentAddress, currentWallet, toast, refetchNftHoldings]);

  return (
    <Container maxW="container.xl" py={8}>
      <Stack spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Marketplace</Heading>
          <Text color="gray.600">
            Browse active listings, list your Funny Dog NFTs, and mint new ones in a single view.
          </Text>
        </Stack>

        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Stack spacing={2}>
                <Heading size="md">List an NFT</Heading>
                <Text fontSize="sm" color="gray.600">
                  Select a Funny Dog NFT from your wallet and set a sale price in STX.
                </Text>
              </Stack>
              <Badge colorScheme="purple">{marketplaceListings.length} listings</Badge>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            <Stack spacing={6}>
              {!currentAddress ? (
                <Text fontSize="sm" color="gray.500">
                  Connect a wallet to list NFTs on the marketplace.
                </Text>
              ) : (
                <Stack spacing={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      Your Funny Dog NFTs
                    </Text>
                    {nftHoldingsLoading ? (
                      <HStack spacing={2}>
                        <Spinner size="sm" />
                        <Text fontSize="sm" color="gray.600">
                          Loading your holdings...
                        </Text>
                      </HStack>
                    ) : walletNftTokens.length === 0 ? (
                      <Text fontSize="sm" color="gray.500">
                        No Funny Dog NFTs detected in your wallet.
                      </Text>
                    ) : (
                      <Wrap spacing={2}>
                        {walletNftTokens.map((tokenId) => (
                          <WrapItem key={tokenId}>
                            <Button
                              size="sm"
                              variant={listTokenIdNumber === tokenId ? 'solid' : 'outline'}
                              colorScheme="orange"
                              onClick={() => setListTokenId(tokenId.toString())}
                            >
                              NFT #{tokenId}
                            </Button>
                          </WrapItem>
                        ))}
                      </Wrap>
                    )}
                  </Box>
                  <FormControl>
                    <FormLabel>Token ID</FormLabel>
                    <NumberInput
                      value={listTokenId}
                      min={0}
                      step={1}
                      clampValueOnBlur={false}
                      onChange={(valueString) => setListTokenId(valueString)}
                    >
                      <NumberInputField placeholder="e.g. 12" />
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Listing Price (STX)</FormLabel>
                    <NumberInput
                      value={listPrice}
                      min={0}
                      precision={6}
                      step={0.1}
                      clampValueOnBlur={false}
                      onChange={(valueString) => setListPrice(valueString)}
                    >
                      <NumberInputField placeholder="0.0 STX" />
                    </NumberInput>
                    <FormHelperText>
                      {listingPriceMicro > 0
                        ? `${(listingPriceMicro / MICROSTX_IN_STX).toFixed(6)} STX`
                        : 'Set the sale price in STX.'}
                    </FormHelperText>
                  </FormControl>
                  <Button
                    colorScheme="orange"
                    onClick={handleCreateListing}
                    isDisabled={isListDisabled}
                    isLoading={isListing}
                  >
                    List NFT
                  </Button>
                  {pendingListTxId && (
                    <Link
                      fontSize="sm"
                      color="blue.500"
                      href={getExplorerLink(pendingListTxId, network)}
                      isExternal
                    >
                      View listing transaction <ExternalLinkIcon mx="4px" />
                    </Link>
                  )}
                </Stack>
              )}

              <Divider />

              <Stack spacing={4}>
                <Heading size="sm">Active Listings</Heading>
                {listingsLoading ? (
                  <Center py={6}>
                    <Spinner />
                  </Center>
                ) : marketplaceListings.length === 0 ? (
                  <Text fontSize="sm" color="gray.500">
                    No listings found. List an NFT to populate the marketplace.
                  </Text>
                ) : (
                  <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
                    {marketplaceListings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} onRefresh={refreshAll} />
                    ))}
                  </SimpleGrid>
                )}
              </Stack>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading size="md">My Funny Dog NFTs</Heading>
            <Text fontSize="sm" color="gray.600" mt={2}>
              Review your holdings and mint additional NFTs for testing flows.
            </Text>
          </CardHeader>
          <Divider />
          <CardBody>
            {!currentAddress ? (
              <Center py={10}>
                <Text>Please connect your wallet to view and mint NFTs.</Text>
              </Center>
            ) : nftHoldingsLoading ? (
              <Center py={10}>
                <Spinner />
              </Center>
            ) : (
              <Stack spacing={6}>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                  {walletHoldings.map((holding) => (
                    <NftCard
                      key={holding.asset_identifier}
                      nft={{
                        nftAssetContract: holding.asset_identifier.split('::')[0],
                        tokenId: Number(formatValue(holding.value.hex).replace('u', '')),
                      }}
                    />
                  ))}
                  <Box
                    borderWidth="1px"
                    borderRadius="lg"
                    bg="white"
                    boxShadow="md"
                    overflow="hidden"
                  >
                    <Box position="relative" paddingTop="100%">
                      <Center
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        bg="gray.100"
                      />
                    </Box>
                    <Stack p={4} spacing={3}>
                      <Text fontWeight="bold" fontSize="lg">
                        Mint Funny Dog NFT
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Mints a new Funny Dog NFT to your connected wallet.
                      </Text>
                      <Button colorScheme="blue" onClick={handleMintNFT} size="sm">
                        Mint NFT
                      </Button>
                      {lastMintTxId && (
                        <Link
                          href={getExplorerLink(lastMintTxId, network)}
                          isExternal
                          color="blue.500"
                          fontSize="sm"
                        >
                          View mint transaction <ExternalLinkIcon mx="2px" />
                        </Link>
                      )}
                    </Stack>
                  </Box>
                </SimpleGrid>
              </Stack>
            )}
          </CardBody>
        </Card>
      </Stack>
    </Container>
  );
}
