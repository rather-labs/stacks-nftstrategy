import {
  AnchorMode,
  PostConditionMode,
  uintCV,
  ClarityType,
  cvToValue,
  serializeCV,
} from '@stacks/transactions';
import { ContractCallRegularOptions } from '@stacks/connect';
import { Network } from '@/lib/network';
import {
  getLiquidityPoolContract,
  getStrategyContract,
  getStrategyPrincipal,
} from '@/constants/contracts';
import { getApi } from '@/lib/stacks-api';
import { parseReadOnlyResponse } from '@/lib/marketplace/operations';
import { PostCondition } from '@stacks/transactions';

const MICROSTX_IN_STX = 1_000_000;

export type SwapDirection = 'stx-to-rather' | 'rather-to-stx';

export interface PoolReserves {
  stx: number;
  rather: number;
  initialized: boolean;
}

const baseCall = {
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Deny,
};

const getRatherAssetId = (network: Network) => {
  const strategyContract = getStrategyContract(network);
  return `${strategyContract.contractAddress}.${strategyContract.contractName}::rather-coin` as const;
};

export const fetchPoolReserves = async (network: Network): Promise<PoolReserves> => {
  const api = getApi(network).smartContractsApi;
  const poolContract = getLiquidityPoolContract(network);

  try {
    const [reservesResponse, statusResponse] = await Promise.all([
      api.callReadOnlyFunction({
        ...poolContract,
        functionName: 'get-reserves',
        readOnlyFunctionArgs: {
          sender: poolContract.contractAddress,
          arguments: [],
        },
      }),
      api.callReadOnlyFunction({
        ...poolContract,
        functionName: 'get-status',
        readOnlyFunctionArgs: {
          sender: poolContract.contractAddress,
          arguments: [],
        },
      }),
    ]);

    const reservesCv = parseReadOnlyResponse(reservesResponse);
    const statusCv = parseReadOnlyResponse(statusResponse);

    const initialized =
      statusCv?.type === ClarityType.ResponseOk ? Boolean(cvToValue(statusCv.value)) : false;

    if (!reservesCv || reservesCv.type !== ClarityType.Tuple) {
      return { stx: 0, rather: 0, initialized };
    }

    const stx = Number(cvToValue(reservesCv.value.stx));
    const rather = Number(cvToValue(reservesCv.value.rather));

    return { stx, rather, initialized };
  } catch (error) {
    console.error('Failed to fetch pool reserves:', error);
    return { stx: 0, rather: 0, initialized: false };
  }
};

export const fetchQuoteStxForRather = async (
  network: Network,
  amountIn: number
): Promise<number> => {
  if (amountIn <= 0) return 0;
  const api = getApi(network).smartContractsApi;
  const poolContract = getLiquidityPoolContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      ...poolContract,
      functionName: 'get-quote-stx-for-rather',
      readOnlyFunctionArgs: {
        sender: poolContract.contractAddress,
        arguments: [`0x${serializeCV(uintCV(amountIn))}`],
      },
    });

    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue || clarityValue.type !== ClarityType.ResponseOk) return 0;

    return Number(cvToValue(clarityValue.value));
  } catch (error) {
    console.error('Failed to fetch STX → RATHER quote:', error);
    return 0;
  }
};

export const fetchQuoteRatherForStx = async (
  network: Network,
  amountIn: number
): Promise<number> => {
  if (amountIn <= 0) return 0;
  const api = getApi(network).smartContractsApi;
  const poolContract = getLiquidityPoolContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      ...poolContract,
      functionName: 'get-quote-rather-for-stx',
      readOnlyFunctionArgs: {
        sender: poolContract.contractAddress,
        arguments: [`0x${serializeCV(uintCV(amountIn))}`],
      },
    });

    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue || clarityValue.type !== ClarityType.ResponseOk) return 0;

    return Number(cvToValue(clarityValue.value));
  } catch (error) {
    console.error('Failed to fetch RATHER → STX quote:', error);
    return 0;
  }
};

const buildPostConditions = (
  network: Network,
  sender: string,
  direction: SwapDirection,
  amountIn: number,
  minOut: number
): PostCondition[] => {
  const poolContract = getLiquidityPoolContract(network);
  const ratherAssetId = getRatherAssetId(network);
  const poolPrincipal = `${poolContract.contractAddress}.${poolContract.contractName}`;

  if (direction === 'stx-to-rather') {
    return [
      {
        type: 'stx-postcondition',
        address: sender,
        condition: 'eq',
        amount: amountIn,
      },
      {
        type: 'ft-postcondition',
        address: poolPrincipal,
        condition: 'gte',
        asset: ratherAssetId,
        amount: minOut,
      },
    ];
  }

  // direction === 'rather-to-stx'
  return [
    {
      type: 'ft-postcondition',
      address: sender,
      condition: 'eq',
      asset: ratherAssetId,
      amount: amountIn,
    },
    {
      type: 'stx-postcondition',
      address: poolPrincipal,
      condition: 'gte',
      amount: minOut,
    },
  ];
};

export const buildSwapStxForRatherTx = (
  network: Network,
  sender: string,
  amountIn: number,
  minOut: number
): ContractCallRegularOptions => {
  const poolContract = getLiquidityPoolContract(network);
  const postConditions = buildPostConditions(network, sender, 'stx-to-rather', amountIn, minOut);

  return {
    ...baseCall,
    ...poolContract,
    network,
    functionName: 'swap-stx-for-rather',
    functionArgs: [uintCV(amountIn), uintCV(minOut)],
    postConditions,
  };
};

export const buildSwapRatherForStxTx = (
  network: Network,
  sender: string,
  amountIn: number,
  minOut: number
): ContractCallRegularOptions => {
  const poolContract = getLiquidityPoolContract(network);
  const postConditions = buildPostConditions(network, sender, 'rather-to-stx', amountIn, minOut);

  return {
    ...baseCall,
    ...poolContract,
    network,
    functionName: 'swap-rather-for-stx',
    functionArgs: [uintCV(amountIn), uintCV(minOut)],
    postConditions,
  };
};

export const buildInitLiquidityPoolTx = (network: Network): ContractCallRegularOptions => {
  const poolContract = getLiquidityPoolContract(network);

  return {
    ...baseCall,
    ...poolContract,
    network,
    functionName: 'init',
    functionArgs: [],
  };
};

export const formatMicroAmount = (value: number) => value / MICROSTX_IN_STX;

export const toMicroAmount = (value: string, decimals = MICROSTX_IN_STX): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed * decimals);
};

export const calculateMinOut = (quote: number, slippageBps: number): number => {
  if (quote <= 0) return 0;
  const slippageMultiplier = 1 - slippageBps / 10_000;
  return Math.floor(quote * slippageMultiplier);
};

export const formatPoolReserves = (reserves: PoolReserves) => ({
  stx: formatMicroAmount(reserves.stx),
  rather: formatMicroAmount(reserves.rather),
});

export const fetchStrategyFeeBalanceFromPool = async (network: Network) => {
  const api = getApi(network).accountsApi;
  const strategyPrincipal = getStrategyPrincipal(network);

  try {
    const balanceResponse = await api.getAccountStxBalance({ principal: strategyPrincipal });
    const balance = Number((balanceResponse as { balance?: string }).balance ?? 0);
    return Number.isFinite(balance) ? balance : 0;
  } catch (error) {
    console.error('Failed to fetch strategy STX balance:', error);
    return 0;
  }
};
