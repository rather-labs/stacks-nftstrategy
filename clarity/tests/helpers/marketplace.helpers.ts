import { Cl } from "@stacks/transactions";
import { CONTRACTS } from "./constants";
import { signers, contract } from "./utils/test-setup";

// NFT helpers
export const nft = {
  mint: (to: string, caller?: string) => {
    const { deployer } = signers();
    return contract.call(
      CONTRACTS.NFT,
      "mint",
      [Cl.principal(to)],
      caller || deployer
    );
  },

  getOwner: (tokenId: number, caller: string) => {
    return contract.readOnly(
      CONTRACTS.NFT,
      "get-owner",
      [Cl.uint(tokenId)],
      caller
    );
  },

  transfer: (tokenId: number, from: string, to: string, caller: string) => {
    return contract.call(
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
    return contract.call(
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
    return contract.call(
      CONTRACTS.MARKETPLACE,
      "fulfill-listing-stx",
      [Cl.uint(listingId), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      buyer
    );
  },

  cancel: (listingId: number, caller: string) => {
    const { deployer } = signers();
    return contract.call(
      CONTRACTS.MARKETPLACE,
      "cancel-listing",
      [Cl.uint(listingId), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      caller
    );
  },

  getListing: (listingId: number, caller?: string) => {
    return contract.readOnly(
      CONTRACTS.MARKETPLACE,
      "get-listing",
      [Cl.uint(listingId)],
      caller
    );
  },

  getFloorPrice: (caller?: string) => {
    const { deployer } = signers();
    return contract.readOnly(
      CONTRACTS.MARKETPLACE,
      "get-floor-price",
      [Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      caller
    );
  },

  getNonce: (caller?: string) => {
    return contract.readOnly(
      CONTRACTS.MARKETPLACE,
      "get-listing-nonce",
      [],
      caller
    );
  },
};

// Re-export functions for convenience
export { expect, assertions } from "./utils/test-setup";