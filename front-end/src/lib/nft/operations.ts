import {
  PostConditionMode,
  principalCV,
  uintCV,
  serializeCV,
  deserializeCV,
  ClarityType,
  cvToValue,
} from '@stacks/transactions';
import { hexToBytes } from '@stacks/common';
import { ContractCallRegularOptions } from '@stacks/connect';
import { getNftContract } from '@/constants/contracts';
import { Network } from '@/lib/network';
import { getApi } from '@/lib/stacks-api';

export const mintFunnyDogNFT = (
  network: Network,
  recipientAddress: string
): ContractCallRegularOptions => {
  const recipient = principalCV(recipientAddress);
  const functionArgs = [recipient];
  const contract = getNftContract(network);

  return {
    ...contract,
    network,
    anchorMode: 1,
    functionName: 'mint',
    functionArgs,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
  };
};

export const fetchTokenUri = async (
  network: Network,
  tokenId: number
): Promise<string | undefined> => {
  const api = getApi(network).smartContractsApi;
  const nftContract = getNftContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      contractAddress: nftContract.contractAddress,
      contractName: nftContract.contractName,
      functionName: 'get-token-uri',
      readOnlyFunctionArgs: {
        sender: nftContract.contractAddress,
        arguments: [`0x${serializeCV(uintCV(tokenId)).toString()}`],
      },
    });

    if (!response.result) return undefined;
    const clarityValue = deserializeCV(hexToBytes(response.result.slice(2)));

    if (clarityValue.type !== ClarityType.ResponseOk) return undefined;
    const optionalValue = clarityValue.value;
    if (optionalValue.type === ClarityType.OptionalSome) {
      const innerValue = optionalValue.value;
      if (
        innerValue.type === ClarityType.StringASCII ||
        innerValue.type === ClarityType.StringUTF8
      ) {
        return cvToValue(innerValue);
      }
    }
    return undefined;
  } catch (error) {
    console.error(`Failed to fetch token URI for #${tokenId}:`, error);
    return undefined;
  }
};
