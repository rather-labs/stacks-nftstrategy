import { Cl } from "@stacks/transactions";
import { CONTRACTS, POOL_CONSTANTS } from "./constants";
import { signers, contract, balance, utils } from "./utils/test-setup";

// Test accounts
export const getAccounts = () => signers();

// Token helpers
export const token = {
  mint: (caller?: string) => {
    const { deployer } = signers();
    return contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "mint",
      [],
      caller || deployer
    );
  },

  getBalance: (address: string, caller?: string) => {
    return contract.readOnly(
      CONTRACTS.STRATEGY_TOKEN,
      "get-balance",
      [Cl.principal(address)],
      caller
    );
  },

  getFeeBalance: (caller?: string) => {
    return contract.readOnly(
      CONTRACTS.STRATEGY_TOKEN,
      "get-fee-balance",
      [],
      caller
    );
  },

  transfer: (amount: number, from: string, to: string, caller: string) => {
    return contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "transfer",
      [
        Cl.uint(amount),
        Cl.principal(from),
        Cl.principal(to),
        Cl.none(),
      ],
      caller
    );
  },
};

// Pool helpers
export const pool = {
  init: (caller?: string) => {
    const { deployer } = signers();
    return contract.call(
      CONTRACTS.LIQUIDITY_POOL,
      "init",
      [],
      caller || deployer
    );
  },

  updateReserves: (caller?: string) => {
    const { deployer } = signers();
    return contract.call(
      CONTRACTS.LIQUIDITY_POOL,
      "update-reserves",
      [],
      caller || deployer
    );
  },

  getReserves: (caller?: string) => {
    return contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-reserves",
      [],
      caller
    );
  },

  getStatus: (caller?: string) => {
    return contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-status",
      [],
      caller
    );
  },

  getToken: (caller?: string) => {
    const { deployer } = signers();
    return contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-token",
      [],
      caller
    );
  },

  swapStxForRather: (amountIn: number, minOut: number, caller: string) => {
    return contract.call(
      CONTRACTS.LIQUIDITY_POOL,
      "swap-stx-for-rather",
      [Cl.uint(amountIn), Cl.uint(minOut)],
      caller
    );
  },

  swapRatherForStx: (amountIn: number, minOut: number, caller: string) => {
    return contract.call(
      CONTRACTS.LIQUIDITY_POOL,
      "swap-rather-for-stx",
      [Cl.uint(amountIn), Cl.uint(minOut)],
      caller
    );
  },

  getQuoteStxForRather: (amountIn: number, caller?: string) => {
    return contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-quote-stx-for-rather",
      [Cl.uint(amountIn)],
      caller
    );
  },

  getQuoteRatherForStx: (amountIn: number, caller?: string) => {
    return contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-quote-rather-for-stx",
      [Cl.uint(amountIn)],
      caller
    );
  },

  getPoolContract: () => {
    const { deployer } = signers();
    return `${deployer}.${CONTRACTS.LIQUIDITY_POOL}`;
  },
};

// Re-export the balance module from test-setup
export { balance };

// Re-export utility functions and assertions
export { utils, assertions, expect } from "./utils/test-setup";