import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

describe("Liquidity Pool Tests", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const alice = accounts.get("wallet_1")!;
  const poolContract = `${deployer}.liquidity-pool`;

  describe("Initialization", () => {
    it("should mint tokens to pool and initialize", () => {
      // Mint tokens (goes to deployer by default)
      const mintResult = simnet.callPublicFn(
        "strategy-token",
        "mint",
        [],
        deployer
      );
      expect(mintResult.result).toEqual(Cl.ok(Cl.bool(true)));

      // Initialize pool
      const initResult = simnet.callPublicFn(
        "liquidity-pool",
        "init",
        [],
        deployer
      );
      
      // Should return reserves tuple  
      expect(initResult.result.type).toBe("ok");
      const reserves = initResult.result.value.value;
      expect(Number(reserves.stx.value)).toBeGreaterThanOrEqual(0);
      expect(Number(reserves.rather.value)).toBeGreaterThan(0);

      // Verify pool is initialized
      const statusResult = simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-status",
        [],
        alice
      );
      expect(statusResult.result).toEqual(Cl.ok(Cl.bool(true)));
    });

    it("should fail to initialize twice", () => {
      // First initialization
      simnet.callPublicFn("strategy-token", "mint", [], deployer);
      simnet.callPublicFn("liquidity-pool", "init", [], deployer);

      // Second initialization should fail
      const secondInit = simnet.callPublicFn(
        "liquidity-pool",
        "init",
        [],
        deployer
      );
      expect(secondInit.result).toEqual(Cl.error(Cl.uint(101)));
    });
  });

  describe("Read-only functions", () => {
    it("should get correct token contract", () => {
      const result = simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-token",
        [],
        alice
      );
      expect(result.result).toEqual(
        Cl.ok(Cl.principal(`${deployer}.strategy-token`))
      );
    });

    it("should return uninitialized status before init", () => {
      const result = simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-status",
        [],
        alice
      );
      expect(result.result).toEqual(Cl.ok(Cl.bool(false)));
    });
  });

  describe("Error cases", () => {
    it("should fail swap when pool not initialized", () => {
      // Try to swap without initialization
      const swapResult = simnet.callPublicFn(
        "liquidity-pool",
        "swap-stx-for-rather",
        [Cl.uint(1000000), Cl.uint(0)],
        alice
      );
      expect(swapResult.result).toEqual(Cl.error(Cl.uint(102))); // ERR_NOT_INIT
    });

    it("should fail quote when pool not initialized", () => {
      const quoteResult = simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-quote-stx-for-rather",
        [Cl.uint(1000000)],
        alice
      );
      expect(quoteResult.result).toEqual(Cl.error(Cl.uint(102))); // ERR_NOT_INIT
    });

    it("should fail with zero amount", () => {
      // Initialize pool first
      simnet.callPublicFn("strategy-token", "mint", [], deployer);
      simnet.callPublicFn("liquidity-pool", "init", [], deployer);

      // Try to get quote with zero amount
      const quoteResult = simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-quote-stx-for-rather",
        [Cl.uint(0)],
        alice
      );
      expect(quoteResult.result).toEqual(Cl.error(Cl.uint(104))); // ERR_BAD_INPUT
    });
  });
});