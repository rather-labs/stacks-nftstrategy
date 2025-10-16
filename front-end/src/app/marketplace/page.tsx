'use client';

import Image from 'next/image';
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
  Heading,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { Listing, fetchListings } from '@/lib/marketplace/operations';
import { useNetwork } from '@/lib/use-network';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { executeContractCall, openContractCall, shouldUseDirectCall } from '@/lib/contract-utils';
import { getExplorerLink } from '@/utils/explorer-links';
import { useNftHoldings, useGetTxId } from '@/hooks/useNftHoldings';
import { mintFunnyDogNFT } from '@/lib/nft/operations';
import { formatValue } from '@/lib/clarity-utils';
import { NftCard } from '@/components/marketplace/NftCard';

export default function MarketplacePage() {
  const toast = useToast();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { currentWallet } = useDevnetWallet();
  const directCallEnabled = shouldUseDirectCall();
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
    const status =
      typeof mintTxData === 'object' && mintTxData !== null && 'tx_status' in mintTxData
        ? (mintTxData.tx_status as string | undefined)
        : undefined;
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

  const walletHoldings = useMemo(() => nftHoldings?.results ?? [], [nftHoldings]);

  const refreshAll = useCallback(() => {
    void refetchListings();
    if (currentAddress) {
      void refetchNftHoldings();
    }
  }, [refetchListings, refetchNftHoldings, currentAddress]);

  const handleMintNFT = useCallback(async () => {
    if (!network || !currentAddress) return;

    try {
      const txOptions = mintFunnyDogNFT(network, currentAddress);

      if (directCallEnabled) {
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
  }, [network, currentAddress, currentWallet, toast, refetchNftHoldings, directCallEnabled]);

  return (
    <Container maxW="container.xl" py={8}>
      <Stack spacing={8}>
        <Stack spacing={2}>
          <Heading size="lg">Marketplace</Heading>
          <Text color="text.secondary">
            Browse active listings, list your Funny Dog NFTs, and mint new ones in a single view.
          </Text>
        </Stack>

        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Stack spacing={2}>
                <Heading size="md">Active Listings</Heading>
                <Text fontSize="sm" color="text.secondary">
                  Select a Funny Dog NFT from your wallet and set a sale price in STX.
                </Text>
              </Stack>
              <Badge colorScheme="purple">{marketplaceListings.length} listings</Badge>
            </Flex>
          </CardHeader>
          <Divider />
          <CardBody>
            <Stack spacing={6}>
              <Stack spacing={4}>
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
            <Text fontSize="sm" color="text.secondary" mt={2}>
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
                    bg="bg.surface"
                    boxShadow="md"
                    overflow="hidden"
                  >
                    <Box position="relative" sx={{ aspectRatio: '1 / 1' }}>
                      <Image
                        src="https://placedog.net/500/500?id=236"
                        alt="Mint Funny Dog preview"
                        fill
                        sizes="(min-width: 768px) 240px, 100vw"
                        style={{ objectFit: 'cover' }}
                      />
                    </Box>
                    <Stack p={4} spacing={3}>
                      <Text fontWeight="bold" fontSize="lg">
                        Mint Funny Dog NFT
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        Mints a new Funny Dog NFT to your connected wallet.
                      </Text>
                      <Button colorScheme="blue" onClick={handleMintNFT} size="sm">
                        Mint NFT
                      </Button>
                      {lastMintTxId && (
                        <Link
                          href={getExplorerLink(lastMintTxId, network)}
                          isExternal
                          color="link.primary"
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
