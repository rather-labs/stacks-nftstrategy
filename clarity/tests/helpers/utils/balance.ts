import { Cl, ClarityType } from "@stacks/transactions";

/**
 * Balance utility functions for checking STX and token balances
 */
export const balance = {
  /**
   * Get STX balance for an address
   * @param address - The address to check
   * @returns The STX balance in micro-STX as bigint
   */
  getSTX: (address: string): bigint => {
    return simnet.getAssetsMap().get("STX")?.get(address) || 0n;
  },

  /**
   * Get token balance for an address
   * @param contractId - The token contract identifier
   * @param address - The address to check
   * @returns The token balance as bigint
   */
  getToken: (contractId: string, address: string): bigint => {
    const result = simnet.callReadOnlyFn(
      contractId,
      "get-balance",
      [Cl.principal(address)],
      address
    );
    if (result.result.type === ClarityType.ResponseOk) {
      return result.result.value.value;
    }
    return 0n;
  },

  /**
   * Get multiple token balances for an address
   * @param contractIds - Array of token contract identifiers
   * @param address - The address to check
   * @returns Object mapping contract IDs to balances
   */
  getTokens: (contractIds: string[], address: string): Record<string, bigint> => {
    const balances: Record<string, bigint> = {};
    for (const contractId of contractIds) {
      balances[contractId] = balance.getToken(contractId, address);
    }
    return balances;
  },

  /**
   * Get all balances (STX + tokens) for an address
   * @param address - The address to check
   * @param tokenContracts - Optional array of token contracts to check
   * @returns Object with STX and token balances
   */
  getAll: (address: string, tokenContracts?: string[]): {
    stx: bigint;
    tokens: Record<string, bigint>;
  } => {
    return {
      stx: balance.getSTX(address),
      tokens: tokenContracts ? balance.getTokens(tokenContracts, address) : {},
    };
  },
};