import { DEVNET_STACKS_BLOCKCHAIN_API_URL } from '@/constants/devnet';
import { Network } from '@/lib/network';

const buildExplorerQuery = (network: Network | null): string => {
  const query = new URLSearchParams();
  const activeNetwork = network ?? 'testnet';

  if (activeNetwork === 'devnet') {
    query.set('chain', 'testnet');
    if (DEVNET_STACKS_BLOCKCHAIN_API_URL) {
      query.set('api', DEVNET_STACKS_BLOCKCHAIN_API_URL);
    }
  } else {
    query.set('chain', activeNetwork);
  }

  return query.toString();
};

export const getExplorerLink = (txId: string, network: Network | null): string => {
  const baseUrl = 'https://explorer.hiro.so/txid';
  const cleanTxId = txId.replace('0x', '');
  const query = buildExplorerQuery(network);

  return `${baseUrl}/${cleanTxId}?${query}`;
};

export const getAccountExplorerLink = (address: string, network: Network | null): string => {
  const baseUrl = 'https://explorer.hiro.so/address';
  const query = buildExplorerQuery(network);

  return `${baseUrl}/${address}?${query}`;
};
