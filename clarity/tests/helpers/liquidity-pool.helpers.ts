import { Cl } from "@stacks/transactions";
import { expect } from "vitest";
import { CONTRACTS, ERROR_CODES, POOL_CONSTANTS } from "./constants";
import { signers } from "./test-setup";

declare const simnet: any;

// Test accounts
export const getAccounts = () => signers();

// Token helpers
export const token = {
  mint: (caller?: string) => {
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.STRATEGY_TOKEN,
      "mint",
      [],
      caller || deployer
    );
  },

  getBalance: (address: string, caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.STRATEGY_TOKEN,
      "get-balance",
      [Cl.principal(address)],
      caller || alice
    );
  },

  getFeeBalance: (caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.STRATEGY_TOKEN,
      "get-fee-balance",
      [],
      caller || alice
    );
  },

  transfer: (amount: number, from: string, to: string, caller: string) => {
    return simnet.callPublicFn(
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
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.LIQUIDITY_POOL,
      "init",
      [],
      caller || deployer
    );
  },

  updateReserves: (caller?: string) => {
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.LIQUIDITY_POOL,
      "update-reserves",
      [],
      caller || deployer
    );
  },

  getReserves: (caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.LIQUIDITY_POOL,
      "get-reserves",
      [],
      caller || alice
    );
  },

  getStatus: (caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.LIQUIDITY_POOL,
      "get-status",
      [],
      caller || alice
    );
  },

  getToken: (caller?: string) => {
    const { alice } = getAccounts();
    const { deployer } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.LIQUIDITY_POOL,
      "get-token",
      [],
      caller || alice
    );
  },

  swapStxForRather: (amountIn: number, minOut: number, caller: string) => {
    return simnet.callPublicFn(
      CONTRACTS.LIQUIDITY_POOL,
      "swap-stx-for-rather",
      [Cl.uint(amountIn), Cl.uint(minOut)],
      caller
    );
  },

  swapRatherForStx: (amountIn: number, minOut: number, caller: string) => {
    return simnet.callPublicFn(
      CONTRACTS.LIQUIDITY_POOL,
      "swap-rather-for-stx",
      [Cl.uint(amountIn), Cl.uint(minOut)],
      caller
    );
  },

  getQuoteStxForRather: (amountIn: number, caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.LIQUIDITY_POOL,
      "get-quote-stx-for-rather",
      [Cl.uint(amountIn)],
      caller || alice
    );
  },

  getQuoteRatherForStx: (amountIn: number, caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.LIQUIDITY_POOL,
      "get-quote-rather-for-stx",
      [Cl.uint(amountIn)],
      caller || alice
    );
  },

  getPoolContract: () => {
    const { deployer } = getAccounts();
    return `${deployer}.${CONTRACTS.LIQUIDITY_POOL}`;
  },
};

// Balance helpers
export const balance = {
  getSTX: (address: string): bigint => {
    return simnet.getAssetsMap().get("STX")?.get(address) || 0n;
  },

  transferSTX: (amount: number, from: string, to: string, caller?: string) => {
    return simnet.callPublicFn(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pox-4",
      "stx-transfer", 
      [Cl.uint(amount), Cl.principal(from), Cl.principal(to)],
      caller || from
    );
  },
};

// Utility helpers
export const utils = {
  mineBlocks: (count: number) => {
    simnet.mineEmptyBlocks(count);
  },

  calculateSwapOutput: (
    amountIn: number,
    reserveIn: number,
    reserveOut: number,
    feeInBps: number = 0
  ): number => {
    const netAmountIn = feeInBps > 0
      ? Math.floor((amountIn * (POOL_CONSTANTS.BPS_DIVISOR - feeInBps)) / POOL_CONSTANTS.BPS_DIVISOR)
      : amountIn;
    return Math.floor((netAmountIn * reserveOut) / (reserveIn + netAmountIn));
  },

  calculateFee: (amount: number, feeInBps: number): number => {
    return Math.floor((amount * feeInBps) / POOL_CONSTANTS.BPS_DIVISOR);
  },
};

// Common assertions
export const assertions = {
  expectOk: (result: any, value: any) => {
    expect(result).toEqual(Cl.ok(value));
  },

  expectErr: (result: any, code: number) => {
    expect(result).toEqual(Cl.error(Cl.uint(code)));
  },

  expectSome: (result: any, value: any) => {
    expect(result).toEqual(Cl.some(value));
  },

  expectNone: (result: any) => {
    expect(result).toEqual(Cl.none());
  },

  expectReserves: (result: any, stx: number, rather: number) => {
    expect(result).toEqual(Cl.tuple({
      stx: Cl.uint(stx),
      rather: Cl.uint(rather),
    }));
  },
};

// Re-export the expect function for convenience
export { expect } from "vitest";