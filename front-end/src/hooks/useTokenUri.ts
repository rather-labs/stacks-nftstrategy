import { useQuery } from '@tanstack/react-query';
import { fetchTokenUri } from '@/lib/nft/operations';
import { useNetwork } from '@/lib/use-network';

export const useTokenUri = (tokenId?: number | null) => {
  const network = useNetwork();

  return useQuery<string | undefined>({
    queryKey: ['nft-token-uri', network, tokenId],
    queryFn: () =>
      network && tokenId !== undefined && tokenId !== null
        ? fetchTokenUri(network, tokenId)
        : Promise.resolve(undefined),
    enabled: !!network && tokenId !== undefined && tokenId !== null,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};
