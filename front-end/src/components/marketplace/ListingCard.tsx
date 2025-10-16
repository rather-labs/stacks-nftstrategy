'use client';

import { openContractCall } from '@/lib/contract-utils';
import {
  CardFooter,
  Heading,
  Stack,
  CardBody,
  Card,
  useToast,
  Button,
  Text,
  Flex,
  Link,
} from '@chakra-ui/react';
import { cancelListing, purchaseListingStx } from '@/lib/marketplace/operations';
import { useContext, useState, useEffect } from 'react';
import { HiroWalletContext } from '../HiroWalletProvider';
import { shouldUseDirectCall } from '@/lib/contract-utils';
import { executeContractCall } from '@/lib/contract-utils';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { useGetTxId } from '@/hooks/useNftHoldings';
import { formatContractName } from '@/utils/formatting';
import { useNetwork } from '@/lib/use-network';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { getAccountExplorerLink, getExplorerLink } from '@/utils/explorer-links';
import { TokenImage } from '@/components/nft/TokenImage';

interface ListingCardProps {
  listing: {
    id: number;
    maker: string;
    tokenId: number;
    nftAssetContract: string;
    price: number;
  };
  onRefresh: () => void;
}

const truncateAddress = (address: string): string =>
  address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

export const ListingCard = ({ listing, onRefresh }: ListingCardProps) => {
  const { testnetAddress, mainnetAddress } = useContext(HiroWalletContext);
  const { currentWallet } = useDevnetWallet();
  const toast = useToast();
  const [purchaseTxId, setPurchaseTxId] = useState<string | null>(null);
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const { data: txData } = useGetTxId(purchaseTxId || '');

  useEffect(() => {
    if (txData?.tx_status === 'success') {
      toast({
        title: 'Purchase Confirmed',
        description: 'Your purchase has been confirmed on the blockchain',
        status: 'success',
      });
      onRefresh();
      setPurchaseTxId(null);
    } else if (txData?.tx_status === 'abort_by_response') {
      toast({
        title: 'Purchase Failed',
        description: 'The transaction was aborted',
        status: 'error',
      });
      setPurchaseTxId(null);
    }
  }, [txData, toast, onRefresh]);

  const handlePurchase = async () => {
    if (!network || !currentAddress) return;
    try {
      const txOptions = await purchaseListingStx(network, currentAddress, listing);

      if (shouldUseDirectCall()) {
        const { txid } = await executeContractCall(txOptions, currentWallet);
        setPurchaseTxId(txid);
        toast({
          title: 'Purchase Submitted',
          description: `Transaction broadcast with ID: ${txid}`,
          status: 'info',
        });
        return;
      }

      await openContractCall({
        ...txOptions,
        onFinish: () => {
          toast({
            title: 'Success',
            description: 'Purchase submitted!',
            status: 'success',
          });
          onRefresh();
        },
        onCancel: () => {
          toast({
            title: 'Cancelled',
            description: 'Transaction was cancelled',
            status: 'info',
          });
        },
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to purchase NFT',
        status: 'error',
      });
    }
  };

  const handleCancel = async () => {
    if (listing.maker !== currentAddress) return;
    if (!network) return;

    try {
      const txOptions = await cancelListing(network, listing);

      await openContractCall({
        ...txOptions,
        onFinish: (_data) => {
          toast({
            title: 'Success',
            description: 'Listing cancelled successfully',
            status: 'success',
          });
          onRefresh();
        },
        onCancel: () => {
          toast({
            title: 'Cancelled',
            description: 'Transaction was cancelled',
            status: 'info',
          });
        },
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to cancel listing',
        status: 'error',
      });
    }
  };

  if (!network) return null;

  return (
    <Card
      maxW="sm"
      cursor="pointer"
      transition="transform 0.2s"
      _hover={{ transform: 'scale(1.02)' }}
      overflow="hidden"
      boxShadow="lg"
    >
      <CardBody padding={0}>
        <TokenImage tokenId={listing.tokenId} alt={`NFT #${listing.tokenId}`} />
        <Stack spacing={2} p={4}>
          <Heading size="md">NFT #{listing.tokenId}</Heading>
          <Text fontSize="sm" color="text.tertiary">
            {formatContractName(listing.nftAssetContract)}
          </Text>
          <Stack spacing={1}>
            <Text color="accent.primary" fontWeight="bold">
              {listing.price / 1000000} STX
            </Text>
            <Flex align="center" justify="space-between" fontSize="xs" color="text.tertiary">
              <Text>Owner</Text>
              <Link
                href={getAccountExplorerLink(listing.maker, network)}
                isExternal
                color="link.primary"
                display="inline-flex"
                alignItems="center"
                gap={1}
              >
                {truncateAddress(listing.maker)} <ExternalLinkIcon />
              </Link>
            </Flex>
          </Stack>
        </Stack>
      </CardBody>
      <CardFooter pt={0} px={4} pb={4}>
        <Stack spacing={2} width="100%">
          {listing.maker === testnetAddress || listing.maker === mainnetAddress ? (
            <Button colorScheme="red" variant="outline" onClick={handleCancel}>
              Cancel Listing
            </Button>
          ) : (
            <Button
              colorScheme="blue"
              onClick={handlePurchase}
              isLoading={!!purchaseTxId && !txData}
              loadingText="Purchasing..."
            >
              Purchase
            </Button>
          )}
          {purchaseTxId && (
            <Link
              href={getExplorerLink(purchaseTxId, network)}
              isExternal
              color="link.primary"
              fontSize="sm"
            >
              View transaction <ExternalLinkIcon mx="2px" />
            </Link>
          )}
        </Stack>
      </CardFooter>
    </Card>
  );
};
