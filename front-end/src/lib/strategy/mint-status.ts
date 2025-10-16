import { getStrategyContract } from '@/constants/contracts';
import { getApi } from '@/lib/stacks-api';
import { Network } from '@/lib/network';
import { parseReadOnlyResponse } from '@/lib/marketplace/operations';
import { ClarityType, cvToValue } from '@stacks/transactions';

export async function fetchStrategyMinted(network: Network): Promise<boolean> {
  const api = getApi(network).smartContractsApi;
  const strategyContract = getStrategyContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      ...strategyContract,
      functionName: 'get-total-supply',
      readOnlyFunctionArgs: {
        sender: strategyContract.contractAddress,
        arguments: [],
      },
    });
    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue || clarityValue.type !== ClarityType.ResponseOk) return false;

    const rawSupply = cvToValue(clarityValue.value);
    const numericSupply =
      typeof rawSupply === 'bigint'
        ? Number(rawSupply)
        : typeof rawSupply === 'number'
          ? rawSupply
          : Number(rawSupply);

    if (!Number.isFinite(numericSupply)) return false;
    return numericSupply > 0;
  } catch (error) {
    console.error('Error fetching strategy mint status:', error);
    return false;
  }
}
