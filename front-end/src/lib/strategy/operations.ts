import {
  AnchorMode,
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
  ClarityType,
  cvToValue,
} from '@stacks/transactions';
import { ContractCallRegularOptions } from '@stacks/connect';
import { Network } from '@/lib/network';
import {
  getLiquidityPoolContract,
  getNftContract,
  getStrategyContract,
  getStrategyPrincipal,
} from '@/constants/contracts';
import {
  fetchListingNonce,
  fetchListings,
  Listing,
  parseReadOnlyResponse,
} from '@/lib/marketplace/operations';
import { getApi, getApiUrl } from '@/lib/stacks-api';

export interface StrategyMetrics {
  feeBalance: number;
  floorListing: Listing | null;
}

export interface SoldNft {
  tokenId: number;
  recipient: string;
  txId: string;
  blockHeight: number;
  eventIndex?: number;
}

export const buildBuyAndRelistTx = (
  network: Network,
  listingId: number
): ContractCallRegularOptions => {
  const strategyContract = getStrategyContract(network);

  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    ...strategyContract,
    network,
    functionName: 'buy-and-relist-nft',
    functionArgs: [uintCV(listingId)],
  };
};

export const buildBuyTokenAndBurnTx = (network: Network): ContractCallRegularOptions => {
  const strategyContract = getStrategyContract(network);
  const liquidityPool = getLiquidityPoolContract(network);

  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    ...strategyContract,
    network,
    functionName: 'buy-token-and-burn',
    functionArgs: [contractPrincipalCV(liquidityPool.contractAddress, liquidityPool.contractName)],
  };
};

export const fetchStrategyFeeBalance = async (network: Network): Promise<number> => {
  const api = getApi(network).smartContractsApi;
  const strategyContract = getStrategyContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      ...strategyContract,
      functionName: 'get-fee-balance',
      readOnlyFunctionArgs: {
        sender: strategyContract.contractAddress,
        arguments: [],
      },
    });

    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue) return 0;
    if (clarityValue.type !== ClarityType.ResponseOk) return 0;

    return Number(cvToValue(clarityValue.value));
  } catch (error) {
    console.error('Error fetching strategy fee balance:', error);
    return 0;
  }
};

export const fetchFloorListing = async (network: Network): Promise<Listing | null> => {
  const nonce = await fetchListingNonce(network);
  if (nonce === 0) return null;

  const listings = await fetchListings(network, nonce);
  if (!listings.length) return null;

  return listings.reduce<Listing | null>((best, current) => {
    if (!best) return current;
    return current.price < best.price ? current : best;
  }, null);
};

export const fetchSoldNfts = async (network: Network): Promise<SoldNft[]> => {
  const baseUrl = getApiUrl(network);
  const nftContract = getNftContract(network);
  const strategyPrincipal = getStrategyPrincipal(network);
  const assetIdentifier = `${nftContract.contractAddress}.${nftContract.contractName}::${nftContract.contractName}`;
  const encodedIdentifier = encodeURIComponent(assetIdentifier);
  const url = `${baseUrl}/extended/v1/tokens/nft/${encodedIdentifier}/transfers?limit=50`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch NFT transfers:', response.statusText);
      return [];
    }

    const data = await response.json();
    const transfers = Array.isArray(data.results) ? data.results : [];

    const sold = transfers
      .filter(
        (event: any) => event.sender === strategyPrincipal && event.recipient !== strategyPrincipal
      )
      .map((event: any, index: number) => {
        const tokenIdString = event.token_id || event.value?.repr || '';
        const tokenIdMatch = /\d+/.exec(tokenIdString);
        const tokenId = tokenIdMatch ? Number(tokenIdMatch[0]) : Number.NaN;

        return {
          tokenId,
          recipient: event.recipient,
          txId: event.tx_id,
          blockHeight: event.block_height,
          eventIndex: event.event_index ?? index,
        } as SoldNft;
      })
      .filter((event: SoldNft) => Number.isFinite(event.tokenId));

    return sold.sort((a: SoldNft, b: SoldNft) => b.blockHeight - a.blockHeight).slice(0, 8);
  } catch (error) {
    console.error('Error fetching sold NFTs:', error);
    return [];
  }
};

export const getStrategyContractsSummary = async (network: Network): Promise<StrategyMetrics> => {
  const [feeBalance, floorListing] = await Promise.all([
    fetchStrategyFeeBalance(network),
    fetchFloorListing(network),
  ]);

  return {
    feeBalance,
    floorListing,
  };
};
