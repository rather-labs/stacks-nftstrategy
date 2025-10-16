import { Cl } from "@stacks/transactions";
import { expect } from "vitest";
import { CONTRACTS, ERROR_CODES, PRICES } from "./constants";

declare const simnet: any;

// Test accounts
export const getAccounts = () => {
  const accounts = simnet.getAccounts();
  return {
    deployer: accounts.get("deployer")!,
    alice: accounts.get("wallet_1")!,
    bob: accounts.get("wallet_2")!,
    charlie: accounts.get("wallet_3")!,
  };
};

// NFT helpers
export const nft = {
  mint: (to: string, caller?: string) => {
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.NFT,
      "mint",
      [Cl.principal(to)],
      caller || deployer
    );
  },

  getOwner: (tokenId: number, caller: string) => {
    return simnet.callReadOnlyFn(
      CONTRACTS.NFT,
      "get-owner",
      [Cl.uint(tokenId)],
      caller
    );
  },

  transfer: (tokenId: number, from: string, to: string, caller: string) => {
    return simnet.callPublicFn(
      CONTRACTS.NFT,
      "transfer",
      [Cl.uint(tokenId), Cl.principal(from), Cl.principal(to)],
      caller
    );
  },
};

// Marketplace helpers
export const marketplace = {
  list: (tokenId: number, price: number, seller: string) => {
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.MARKETPLACE,
      "list-asset",
      [
        Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
        Cl.tuple({ "token-id": Cl.uint(tokenId), price: Cl.uint(price) }),
      ],
      seller
    );
  },

  buy: (listingId: number, buyer: string) => {
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.MARKETPLACE,
      "fulfill-listing-stx",
      [Cl.uint(listingId), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      buyer
    );
  },

  cancel: (listingId: number, caller: string) => {
    const { deployer } = getAccounts();
    return simnet.callPublicFn(
      CONTRACTS.MARKETPLACE,
      "cancel-listing",
      [Cl.uint(listingId), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      caller
    );
  },

  getListing: (listingId: number, caller: string) => {
    return simnet.callReadOnlyFn(
      CONTRACTS.MARKETPLACE,
      "get-listing",
      [Cl.uint(listingId)],
      caller
    );
  },

  getFloorPrice: (caller?: string) => {
    const { deployer, alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.MARKETPLACE,
      "get-floor-price",
      [Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      caller || alice
    );
  },

  getNonce: (caller?: string) => {
    const { alice } = getAccounts();
    return simnet.callReadOnlyFn(
      CONTRACTS.MARKETPLACE,
      "get-listing-nonce",
      [],
      caller || alice
    );
  },
};

// Balance helpers
export const balance = {
  getSTX: (address: string): bigint => {
    return simnet.getAssetsMap().get("STX")?.get(address) || 0n;
  },
};

// Utility helpers
export const utils = {
  mineBlocks: (count: number) => {
    simnet.mineEmptyBlocks(count);
  },
  
  stxToMicro: (stx: number): number => {
    return stx * PRICES.STX_TO_MICRO;
  },
};

// Test data factories
export const testData = {
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
};

// Re-export the expect function for convenience
export { expect } from "vitest";