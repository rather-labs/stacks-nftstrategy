import { describe, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import {
  nft,
  marketplace,
  assertions,
  expect,
} from "./helpers/marketplace.helpers";
import { ERROR_CODES, PRICES } from "./helpers/constants";
import { signers, balance, utils } from "./helpers/test-setup";

describe("NFT Marketplace Integration Tests", () => {
  const { deployer, alice, bob, charlie } = signers();
  const nftContract = `${deployer}.funny-dog`;

  describe("Core Marketplace Flow", () => {
    it("should handle complete buy/sell lifecycle", () => {
      // Alice mints and lists NFT
      assertions.expectOk(nft.mint(alice).result, Cl.uint(1));
      assertions.expectOk(marketplace.list(1, PRICES.DEFAULT_PRICE, alice).result, Cl.uint(0));

      // Bob buys NFT
      const aliceBalanceBefore = balance.getSTX(alice);
      const bobBalanceBefore = balance.getSTX(bob);

      assertions.expectOk(marketplace.buy(0, bob).result, Cl.uint(0));

      // Verify ownership and payment
      assertions.expectOk(
        nft.getOwner(1, bob).result,
        Cl.some(Cl.principal(bob))
      );

      expect(balance.getSTX(alice)).toBe(aliceBalanceBefore + BigInt(PRICES.DEFAULT_PRICE));
      expect(balance.getSTX(bob)).toBe(bobBalanceBefore - BigInt(PRICES.DEFAULT_PRICE));
      
      // Verify listing removed
      assertions.expectNone(marketplace.getListing(0, bob).result);
    });

    it("should prevent self-purchases and unauthorized cancellations", () => {
      // Setup
      nft.mint(alice);
      marketplace.list(1, PRICES.DEFAULT_PRICE, alice);

      // Alice cannot buy her own NFT
      assertions.expectErr(marketplace.buy(0, alice).result, ERROR_CODES.MAKER_TAKER_EQUAL);

      // Bob cannot cancel Alice's listing
      assertions.expectErr(marketplace.cancel(0, bob).result, ERROR_CODES.UNAUTHORIZED);
    });
  });

  describe("Floor Price Feature", () => {
    beforeEach(() => {
      utils.mineBlocks(1);
    });

    it("should track floor price correctly", () => {
      // Initially no floor price
      assertions.expectOk(marketplace.getFloorPrice().result, Cl.none());

      // Alice lists NFT at 2 STX
      nft.mint(alice);
      marketplace.list(1, utils.stxToMicro(2), alice);
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(utils.stxToMicro(2)))
      );

      // Bob lists cheaper NFT at 1.5 STX - floor price updates
      nft.mint(bob);
      marketplace.list(2, utils.stxToMicro(1.5), bob);
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(utils.stxToMicro(1.5)))
      );

      // Charlie lists even cheaper at 1 STX - floor price updates again
      nft.mint(charlie);
      marketplace.list(3, utils.stxToMicro(1), charlie);
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(utils.stxToMicro(1)))
      );

      // Someone buys the cheapest NFT - floor price should update
      marketplace.buy(2, alice); // Buy Charlie's NFT
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(utils.stxToMicro(1.5)))
      );
    });

    it("should remove floor price when no listings remain", () => {
      // Create single listing
      nft.mint(alice);
      marketplace.list(1, PRICES.DEFAULT_PRICE, alice);
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(PRICES.DEFAULT_PRICE))
      );

      // Cancel listing - floor price should be removed
      marketplace.cancel(0, alice);
      assertions.expectOk(marketplace.getFloorPrice().result, Cl.none());
    });
  });

  describe("Multi-User Marketplace", () => {
    it("should handle concurrent listings and sales", () => {
      // Multiple users mint and list
      const users = [alice, bob, charlie];
      const prices = [
        utils.stxToMicro(3),
        utils.stxToMicro(2),
        utils.stxToMicro(2.5)
      ];

      users.forEach((user, i) => {
        nft.mint(user);
        marketplace.list(i + 1, prices[i], user);
      });

      // Floor price should be Bob's listing (cheapest)
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(utils.stxToMicro(2)))
      );

      // Cross-trading scenario
      marketplace.buy(0, bob); // Bob buys Alice's NFT
      marketplace.buy(1, charlie); // Charlie buys Bob's NFT

      // Only Charlie's listing remains, floor price updates
      assertions.expectOk(
        marketplace.getFloorPrice().result,
        Cl.some(Cl.uint(utils.stxToMicro(2.5)))
      );

      // Verify ownership transfers
      assertions.expectOk(
        nft.getOwner(1, bob).result,
        Cl.some(Cl.principal(bob))
      );
      assertions.expectOk(
        nft.getOwner(2, charlie).result,
        Cl.some(Cl.principal(charlie))
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero price and non-existent listings", () => {
      nft.mint(alice);

      // Cannot list with zero price
      assertions.expectErr(marketplace.list(1, 0, alice).result, ERROR_CODES.PRICE_ZERO);

      // Cannot buy non-existent listing
      assertions.expectErr(marketplace.buy(999, bob).result, ERROR_CODES.UNKNOWN_LISTING);
    });

    it("should maintain listing integrity", () => {
      // Create multiple listings and verify nonce increments
      const count = 3;
      for (let i = 1; i <= count; i++) {
        nft.mint(alice);
        assertions.expectOk(
          marketplace.list(i, utils.stxToMicro(i), alice).result,
          Cl.uint(i - 1)
        );
      }

      // Verify nonce
      assertions.expectOk(marketplace.getNonce().result, Cl.uint(count));
    });
  });
});