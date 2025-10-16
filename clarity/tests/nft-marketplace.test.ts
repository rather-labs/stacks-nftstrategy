import { describe, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import {
  nft,
  marketplace,
  assertions,
  expect,
} from "./helpers/marketplace.helpers";
import { ERROR_CODES, PRICES } from "./helpers/constants";
import { signers, balance, utils } from "./helpers/utils/test-setup";

describe("NFT Marketplace Integration Tests", () => {
  const { deployer, alice, bob, charlie } = signers();
  const nftContract = `${deployer}.funny-dog`;

  describe("Core Marketplace Flow", () => {
    it("should handle complete buy/sell lifecycle", () => {
      // Alice mints and lists NFT
      assertions.expectOk(nft.mint(alice).result, Cl.uint(1));
      assertions.expectOk(
        marketplace.list(1, PRICES.DEFAULT_PRICE, alice).result,
        Cl.uint(0)
      );

      // Bob buys NFT
      const aliceBalanceBefore = balance.getSTX(alice);
      const bobBalanceBefore = balance.getSTX(bob);

      assertions.expectOk(marketplace.buy(0, bob).result, Cl.uint(0));

      // Verify ownership and payment
      assertions.expectOk(
        nft.getOwner(1, bob).result,
        Cl.some(Cl.principal(bob))
      );

      expect(balance.getSTX(alice)).toBe(
        aliceBalanceBefore + BigInt(PRICES.DEFAULT_PRICE)
      );
      expect(balance.getSTX(bob)).toBe(
        bobBalanceBefore - BigInt(PRICES.DEFAULT_PRICE)
      );

      // Verify listing removed
      assertions.expectNone(marketplace.getListing(0, bob).result);
    });

    it("should prevent self-purchases and unauthorized cancellations", () => {
      // Setup
      nft.mint(alice);
      marketplace.list(1, PRICES.DEFAULT_PRICE, alice);

      // Alice cannot buy her own NFT
      assertions.expectErr(
        marketplace.buy(0, alice).result,
        ERROR_CODES.MAKER_TAKER_EQUAL
      );

      // Bob cannot cancel Alice's listing
      assertions.expectErr(
        marketplace.cancel(0, bob).result,
        ERROR_CODES.UNAUTHORIZED
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero price and non-existent listings", () => {
      nft.mint(alice);

      // Cannot list with zero price
      assertions.expectErr(
        marketplace.list(1, 0, alice).result,
        ERROR_CODES.PRICE_ZERO
      );

      // Cannot buy non-existent listing
      assertions.expectErr(
        marketplace.buy(999, bob).result,
        ERROR_CODES.UNKNOWN_LISTING
      );
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
