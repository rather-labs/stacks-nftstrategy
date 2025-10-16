import { Cl } from "@stacks/transactions";
import { expect } from "vitest";
import { CONTRACTS, ERROR_CODES, PRICES } from "./constants";
import { balance, utils, signers, testData, assertions } from "./test-setup";

declare const simnet: any;

// NFT helpers
export const nft = {
  mint: (to: string, caller?: string) => {
    const { deployer } = signers();
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
    const { deployer } = signers();
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
    const { deployer } = signers();
    return simnet.callPublicFn(
      CONTRACTS.MARKETPLACE,
      "fulfill-listing-stx",
      [Cl.uint(listingId), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      buyer
    );
  },

  cancel: (listingId: number, caller: string) => {
    const { deployer } = signers();
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
    const { deployer, alice } = signers();
    return simnet.callReadOnlyFn(
      CONTRACTS.MARKETPLACE,
      "get-floor-price",
      [Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      caller || alice
    );
  },

  getNonce: (caller?: string) => {
    const { alice } = signers();
    return simnet.callReadOnlyFn(
      CONTRACTS.MARKETPLACE,
      "get-listing-nonce",
      [],
      caller || alice
    );
  },
};

// Re-export functions for convenience
export { expect } from "vitest";
export { assertions } from "./test-setup";