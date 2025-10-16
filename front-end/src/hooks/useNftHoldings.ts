import { UseQueryResult, useQuery } from '@tanstack/react-query';
import {
  NonFungibleTokenHoldingsList,
  Transaction,
  MempoolTransaction,
} from '@stacks/stacks-blockchain-api-types';
import { getApi } from '@/lib/stacks-api';
import { useNetwork } from '@/lib/use-network';

// Custom hook to fetch NFT holdings for a given address
export const useNftHoldings = (address?: string): UseQueryResult<NonFungibleTokenHoldingsList> => {
  const network = useNetwork();

  return useQuery<NonFungibleTokenHoldingsList>({
    queryKey: ['nftHoldings', address],
    queryFn: async () => {
      if (!address) throw new Error('Address is required');
      if (!network) throw new Error('Network is required');
      const api = getApi(network).nonFungibleTokensApi;
      const response = await api.getNftHoldings({
        principal: address,
        limit: 200,
      });
      return response as unknown as NonFungibleTokenHoldingsList;
    },
    enabled: !!address && !!network,
    retry: false,
    // Refetch every 10 seconds and whenever the window regains focus
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
};

// Continuously query a transaction by txId until it is confirmed
export const useGetTxId = (txId: string) => {
  const network = useNetwork();
  return useQuery<Transaction | MempoolTransaction>({
    queryKey: ['nftHoldingsByTxId', txId],
    queryFn: async () => {
      if (!txId) throw new Error('txId is required');
      if (!network) throw new Error('Network is required');
      const api = getApi(network).transactionsApi;
      const response = await api.getTransactionById({ txId });
      return response as unknown as Transaction | MempoolTransaction;
    },
    enabled: !!txId && !!network,
    refetchInterval: (query: { state: { data?: Transaction | MempoolTransaction } }) => {
      const status = query.state.data?.tx_status as string | undefined;
      return status === 'pending' ? 5000 : false;
    },
    retry: false,
    refetchIntervalInBackground: true,
  });
};
