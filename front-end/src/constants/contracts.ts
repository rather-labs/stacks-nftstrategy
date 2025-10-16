import { isDevnetEnvironment, isTestnetEnvironment } from '@/lib/use-network';
import { Network } from '@/lib/network';

const DEVNET_FALLBACK = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const TESTNET_DEPLOYER =
  process.env.NEXT_PUBLIC_TESTNET_DEPLOYER || 'ST2YY2DYVA8Q92SBXFVAS4A4MAEWCWXS1SZQ9GZRX';
const MAINNET_DEPLOYER =
  process.env.NEXT_PUBLIC_MAINNET_DEPLOYER || 'SP2YY2DYVA8Q92SBXFVAS4A4MAEWCWXS1SYTXYCJ8';

const getDeployerForNetwork = (network: Network) => {
  if (isDevnetEnvironment()) {
    return process.env.NEXT_PUBLIC_DEPLOYER_ACCOUNT_ADDRESS || DEVNET_FALLBACK;
  }

  if (isTestnetEnvironment(network)) {
    return TESTNET_DEPLOYER;
  }

  return MAINNET_DEPLOYER;
};

const buildContract = (network: Network, contractName: string) => {
  const contractAddress = getDeployerForNetwork(network);
  return { contractAddress, contractName } as const;
};

export const getNftContract = (network: Network) => buildContract(network, 'funny-dog');

export const getMarketplaceContract = (network: Network) =>
  buildContract(network, 'nft-marketplace');

export const getStrategyContract = (network: Network) => buildContract(network, 'strategy-token');

export const getLiquidityPoolContract = (network: Network) =>
  buildContract(network, 'liquidity-pool');

export const getStrategyPrincipal = (network: Network) => {
  const { contractAddress, contractName } = getStrategyContract(network);
  return `${contractAddress}.${contractName}`;
};

export const getNftContractAddress = (network: Network) => getNftContract(network).contractAddress;

export const getMarketplaceContractAddress = (network: Network) =>
  getMarketplaceContract(network).contractAddress;
