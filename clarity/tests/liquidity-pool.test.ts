import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

describe("Liquidity Pool - Initialization", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const alice = accounts.get("wallet_1")!;
  const poolContract = `${deployer}.liquidity-pool`;

  describe("Pool Setup", () => {
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
});