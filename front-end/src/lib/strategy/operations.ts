import {
  AnchorMode,
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
  ClarityType,
  cvToValue,
  Pc,
  Cl,
  PostCondition,
} from '@stacks/transactions';
import { ContractCallRegularOptions } from '@stacks/connect';
import { Network } from '@/lib/network';
import {
  getLiquidityPoolContract,
  getNftContract,
  getStrategyContract,
  getStrategyPrincipal,
  getMarketplaceContract,
} from '@/constants/contracts';
import {
  fetchListingNonce,
  fetchListings,
  Listing,
  parseReadOnlyResponse,
} from '@/lib/marketplace/operations';
import { getApi, getApiUrl } from '@/lib/stacks-api';
import { fetchStrategyFeeBalanceFromPool } from '@/lib/pool/operations';

export interface StrategyMetrics {
  feeBalance: number;
  stxBalance: number;
  floorListing: Listing | null;
}

export interface StrategyBurnStats {
  burned: number;
  initialSupply: number;
}

export interface SoldNft {
  tokenId: number;
  recipient: string;
  txId: string;
  blockHeight: number;
  eventIndex?: number;
}

const MAX_STX_SPEND = 1_000_000_000_000_000; // 1,000,000 STX (in microSTX)
const MAX_RATHER_TRANSFER = 1_000_000_000_000; // Total RATHER supply minted

export const buildBuyAndRelistTx = (
  network: Network,
  listingId: number,
  listingPrice: number,
  tokenId: number
): ContractCallRegularOptions => {
  const strategyContract = getStrategyContract(network);
  const marketplaceContract = getMarketplaceContract(network);
  const nftContract = getNftContract(network);
  const strategyPrincipal = getStrategyPrincipal(network);
  const nftAssetId =
    `${nftContract.contractAddress}.${nftContract.contractName}::${nftContract.contractName}` as `${string}.${string}::${string}`;

  const stxSpend = Pc.principal(strategyPrincipal).willSendEq(listingPrice).ustx();
  const relistTransfer = Pc.principal(strategyPrincipal)
    .willSendAsset()
    .nft(nftAssetId, Cl.uint(tokenId));

  // Marketplace pulls the NFT into escrow before relisting; allow it to send the asset back to the taker.
  const marketplaceReturn = Pc.principal(
    `${marketplaceContract.contractAddress}.${marketplaceContract.contractName}`
  )
    .willSendAsset()
    .nft(nftAssetId, Cl.uint(tokenId));

  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    ...strategyContract,
    network,
    functionName: 'buy-and-relist-nft',
    functionArgs: [uintCV(listingId)],
    postConditions: [stxSpend, relistTransfer, marketplaceReturn],
  };
};

export const buildBuyTokenAndBurnTx = (network: Network): ContractCallRegularOptions => {
  const strategyContract = getStrategyContract(network);
  const liquidityPool = getLiquidityPoolContract(network);
  const strategyPrincipal = getStrategyPrincipal(network);
  const poolPrincipal = `${liquidityPool.contractAddress}.${liquidityPool.contractName}`;
  const ratherAssetId =
    `${strategyContract.contractAddress}.${strategyContract.contractName}::rather-coin` as `${string}.${string}::${string}`;

  const postConditions: PostCondition[] = [
    {
      type: 'stx-postcondition',
      address: strategyPrincipal,
      condition: 'lte',
      amount: MAX_STX_SPEND,
    },
    {
      type: 'stx-postcondition',
      address: poolPrincipal,
      condition: 'lte',
      amount: MAX_STX_SPEND,
    },
    {
      type: 'ft-postcondition',
      address: poolPrincipal,
      condition: 'lte',
      asset: ratherAssetId,
      amount: MAX_RATHER_TRANSFER,
    },
    {
      type: 'ft-postcondition',
      address: strategyPrincipal,
      condition: 'lte',
      asset: ratherAssetId,
      amount: MAX_RATHER_TRANSFER,
    },
  ];

  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    ...strategyContract,
    network,
    functionName: 'buy-token-and-burn',
    functionArgs: [contractPrincipalCV(liquidityPool.contractAddress, liquidityPool.contractName)],
    postConditions,
  };
};

export const buildMintStrategyTokenTx = (network: Network): ContractCallRegularOptions => {
  const strategyContract = getStrategyContract(network);

  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    ...strategyContract,
    network,
    functionName: 'mint',
    functionArgs: [],
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

const fetchStrategyUint = async (
  network: Network,
  functionName: 'get-burned-balance' | 'get-initial-supply'
): Promise<number> => {
  const api = getApi(network).smartContractsApi;
  const strategyContract = getStrategyContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      ...strategyContract,
      functionName,
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
    console.error(`Error fetching ${functionName}:`, error);
    return 0;
  }
};

export const fetchStrategyBurnStats = async (network: Network): Promise<StrategyBurnStats> => {
  const [burned, initialSupply] = await Promise.all([
    fetchStrategyUint(network, 'get-burned-balance'),
    fetchStrategyUint(network, 'get-initial-supply'),
  ]);

  return {
    burned,
    initialSupply,
  };
};

export const fetchFloorListing = async (network: Network): Promise<Listing | null> => {
  const nonce = await fetchListingNonce(network);
  if (nonce === 0) return null;

  const listings = await fetchListings(network, nonce);
  if (!listings.length) return null;

  const strategyPrincipal = getStrategyPrincipal(network);
  const eligibleListings = listings.filter((listing) => listing.maker !== strategyPrincipal);
  if (!eligibleListings.length) return null;

  return eligibleListings.reduce<Listing | null>((best, current) => {
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
  const [feeBalance, stxBalance, floorListing] = await Promise.all([
    fetchStrategyFeeBalance(network),
    fetchStrategyFeeBalanceFromPool(network),
    fetchFloorListing(network),
  ]);

  return {
    feeBalance,
    stxBalance,
    floorListing,
  };
};
