import { Cl } from "@stacks/transactions";
import { expect } from "vitest";
import { PRICES } from "./constants";
declare const simnet: any;

// Test accounts
const signers = () => {
  const accounts = simnet.getAccounts();
  return {
    deployer: accounts.get("deployer")!,
    alice: accounts.get("wallet_1")!,
    bob: accounts.get("wallet_2")!,
    charlie: accounts.get("wallet_3")!,
  };
};

// Balance helpers
const balance = {
  getSTX: (address: string): bigint => {
    return simnet.getAssetsMap().get("STX")?.get(address) || 0n;
  },
};

// Utility helpers
const utils = {
  mineBlocks: (count: number) => {
    simnet.mineEmptyBlocks(count);
  },

  stxToMicro: (stx: number): number => {
    return stx * PRICES.STX_TO_MICRO;
  },
};


// Test data factories
const testData = {
  createListing: (tokenId: number, priceInSTX: number) => ({
    tokenId,
    price: utils.stxToMicro(priceInSTX),
    priceInSTX,
  }),

  createUser: (name: string, address: string) => ({
    name,
    address,
  }),
};

// Common assertions
const assertions = {
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
};


export { balance, utils, signers, assertions, testData };