import {
  AnchorMode,
  PostConditionMode,
  uintCV,
  serializeCV,
  contractPrincipalCV,
  tupleCV,
  cvToValue,
  deserializeCV,
  cvToString,
  ClarityType,
  ClarityValue,
  TupleCV,
  Pc,
  Cl,
} from '@stacks/transactions';
import { getMarketplaceContract } from '@/constants/contracts';
import { getApi } from '@/lib/stacks-api';
import { Network } from '@/lib/network';
import { ContractCallRegularOptions } from '@stacks/connect';
const baseContractCall = {
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Deny,
};

export interface ListAssetParams {
  sender: string;
  nftContractAddress: string;
  nftContractName: string;
  tokenId: number;
  price: number;
}

export const listAsset = (
  network: Network,
  params: ListAssetParams
): ContractCallRegularOptions => {
  const marketplaceContract = getMarketplaceContract(network);
  const nftAsset = {
    'token-id': uintCV(params.tokenId),
    price: uintCV(params.price),
  };

  const postCondition = Pc.principal(params.sender)
    .willSendAsset()
    .nft(
      `${params.nftContractAddress}.${params.nftContractName}::${params.nftContractName}`,
      Cl.uint(params.tokenId)
    );

  return {
    ...baseContractCall,
    ...marketplaceContract,
    network,
    functionName: 'list-asset',
    functionArgs: [
      contractPrincipalCV(params.nftContractAddress, params.nftContractName),
      tupleCV(nftAsset),
    ],
    postConditions: [postCondition],
    postConditionMode: PostConditionMode.Deny,
  };
};

export const cancelListing = async (
  network: Network,
  listing: Listing
): Promise<ContractCallRegularOptions> => {
  const marketplaceContract = getMarketplaceContract(network);
  const { id: listingId, tokenId, nftAssetContract } = listing;
  const [contractAddress, contractName] = nftAssetContract.split('.');

  //  Post condition to ensure NFT transfer from marketplace contract back to maker
  const postCondition = Pc.principal(
    `${marketplaceContract.contractAddress}.${marketplaceContract.contractName}`
  )
    .willSendAsset()
    .nft(`${contractAddress}.${contractName}::${contractName}`, Cl.uint(tokenId));

  return {
    ...baseContractCall,
    ...marketplaceContract,
    network,
    functionName: 'cancel-listing',
    functionArgs: [uintCV(listingId), contractPrincipalCV(contractAddress, contractName)],
    postConditions: [postCondition],
    postConditionMode: PostConditionMode.Deny,
  };
};

export const contractToPrincipalCV = (contract: string) => {
  return contractPrincipalCV(contract.split('.')[0], contract.split('.')[1]);
};

export const purchaseListingStx = async (
  network: Network,
  currentAddress: string,
  listing: Listing
): Promise<ContractCallRegularOptions> => {
  const marketplaceContract = getMarketplaceContract(network);
  const { id, tokenId, price, nftAssetContract } = listing;
  const [contractAddress, contractName] = nftAssetContract.split('.');

  // Post condition for STX transfer from marketplace to maker
  const stxCondition = Pc.principal(currentAddress).willSendEq(price).ustx();

  // Post condition for NFT transfer from marketplace to buyer
  const nftCondition = Pc.principal(
    `${marketplaceContract.contractAddress}.${marketplaceContract.contractName}`
  )
    .willSendAsset()
    .nft(`${contractAddress}.${contractName}::${contractName}`, Cl.uint(tokenId));

  return {
    ...baseContractCall,
    ...marketplaceContract,
    network,
    functionName: 'fulfill-listing-stx',
    functionArgs: [uintCV(id), contractToPrincipalCV(nftAssetContract)],
    postConditions: [stxCondition, nftCondition],
    postConditionMode: PostConditionMode.Deny,
  };
};

export interface Listing {
  id: number;
  maker: string;
  tokenId: number;
  nftAssetContract: string;
  price: number;
}

export interface ReadOnlyResponse {
  okay: boolean;
  result?: string | undefined;
}

export const parseReadOnlyResponse = ({ result }: ReadOnlyResponse) => {
  if (result === undefined) return undefined;
  const hex = result.slice(2);
  const bufferCv = Buffer.from(hex, 'hex');
  const clarityValue = deserializeCV(bufferCv);
  return clarityValue;
};

export const parseListing = (listingId: number, cv: ClarityValue): Listing | undefined => {
  if (cv.type === ClarityType.OptionalNone) {
    return undefined;
  }

  if (cv.type === ClarityType.OptionalSome) {
    cv = cv.value;
  }

  if (cv.type !== ClarityType.Tuple) return undefined;

  const tuple = cv as TupleCV<{
    maker: ClarityValue;
    'token-id': ClarityValue;
    'nft-asset-contract': ClarityValue;
    price: ClarityValue;
  }>;

  const maker = cvToString(tuple.value.maker);
  const tokenId = Number(cvToValue(tuple.value['token-id']));
  const nftAssetContract = cvToString(tuple.value['nft-asset-contract']);
  const price = Number(cvToValue(tuple.value.price));

  return {
    id: listingId,
    maker,
    tokenId,
    nftAssetContract,
    price,
  };
};

export const fetchListingById = async (
  network: Network,
  listingId: number
): Promise<Listing | undefined> => {
  const api = getApi(network).smartContractsApi;
  const marketplaceContract = getMarketplaceContract(network);
  try {
    const response = await api.callReadOnlyFunction({
      ...marketplaceContract,
      functionName: 'get-listing',
      readOnlyFunctionArgs: {
        sender: marketplaceContract.contractAddress,
        arguments: [`0x${serializeCV(uintCV(listingId)).toString()}`],
      },
    });

    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue) return undefined;
    const listing = parseListing(listingId, clarityValue);
    if (!listing) return undefined;
    return listing;
  } catch (error) {
    console.error(`Error fetching listing ${listingId}:`, error);
    return undefined;
  }
};

export const fetchListingNonce = async (network: Network): Promise<number> => {
  const api = getApi(network).smartContractsApi;
  const marketplaceContract = getMarketplaceContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      ...marketplaceContract,
      functionName: 'get-listing-nonce',
      readOnlyFunctionArgs: {
        sender: marketplaceContract.contractAddress,
        arguments: [],
      },
    });

    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue) return 0;
    if (clarityValue.type !== ClarityType.ResponseOk) return 0;

    return Number(cvToValue(clarityValue.value));
  } catch (error) {
    console.error('Error fetching listing nonce:', error);
    return 0;
  }
};

export async function fetchListings(network: Network, maxId?: number): Promise<Listing[]> {
  const nonce = typeof maxId === 'number' ? maxId : await fetchListingNonce(network);
  if (nonce <= 0) return [];

  const allListings: Listing[] = [];
  const batchSize = 4;
  for (let i = 0; i < nonce; i += batchSize) {
    const batchPromises = Array.from({ length: Math.min(batchSize, nonce - i) }, (_, index) =>
      fetchListingById(network, i + index)
    );
    const batchResults = await Promise.all(batchPromises);
    allListings.push(...batchResults.filter((listing): listing is Listing => !!listing));
  }

  return allListings;
}
