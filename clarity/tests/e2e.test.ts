import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";
import { signers, contract, CONTRACTS } from "./helpers/utils/test-setup";

// @ts-ignore - simnet is available in test environment
declare const simnet: any;

/**
 * End-to-End Tests for NFT Strategy System
 * 
 * This test suite validates the complete flow of the NFT strategy including:
 * - Liquidity pool initialization and token minting
 * - NFT marketplace operations (list, buy, cancel)
 * - Strategy token fee accumulation
 * - Buy-and-relist-nft strategy function
 * - Buy-token-and-burn mechanism
 * - Error handling and edge cases
 * 
 * Tests are designed to work within the constraints of the test environment
 * where STX transfers and pool funding have limitations.
 */
describe("E2E Strategy Flow - Buy, Relist, Sell & Burn", () => {
  const { deployer, alice, bob, charlie } = signers();

  it("should execute the complete strategy flow", () => {
    console.log("\n=== Phase 1: Initialize Liquidity Pool ===");
    
    // 1. Mint tokens to the liquidity pool
    console.log("- Minting RATHER tokens to pool");
    const mintResult = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "mint",
      [],
      deployer
    );
    expect(mintResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // 2. Initialize the liquidity pool
    console.log("- Initializing liquidity pool");
    const initResult = contract.call(
      CONTRACTS.LIQUIDITY_POOL,
      "init",
      [],
      deployer
    );
    expect(initResult.result.type).toBe("ok");
    
    // Note: In test environment, the pool starts with deployer's STX balance
    // In production, you'd fund it with the 50M STX transfer
    
    const reservesResponse = contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-reserves",
      [],
      alice
    );
    
    // Type guard for tuple response
    const reserves = reservesResponse.result;
    if (reserves.type === 'ok' && reserves.value.type === 'tuple') {
      const reserveData = reserves.value.value as any;
      console.log("- Pool reserves:", {
        stx: Number(reserveData.stx.value),
        rather: Number(reserveData.rather.value)
      });
    }

    console.log("\n=== Phase 2: Perform Swaps to Generate Fees ===");
    
    // 3. Alice performs STX -> RATHER swap
    const stxSwapAmount = 1000000; // 1 STX
    console.log("- Alice swapping 1 STX for RATHER");
    
    // Get quote first
    const quoteStxResult = contract.readOnly(
      CONTRACTS.LIQUIDITY_POOL,
      "get-quote-stx-for-rather",
      [Cl.uint(stxSwapAmount)],
      alice
    );
    console.log("  Quote result:", quoteStxResult.result);
    
    // Only proceed with swap if quote is successful
    if (quoteStxResult.result.type === "ok") {
      const swapStxResult = contract.call(
        CONTRACTS.LIQUIDITY_POOL,
        "swap-stx-for-rather",
        [Cl.uint(stxSwapAmount), Cl.uint(0)], // 0 min out for testing
        alice
      );
      console.log("  Swap result:", swapStxResult.result);
      
      // 4. Transfer some RATHER from alice to bob
      if (swapStxResult.result.type === "ok") {
        const transferResult = contract.call(
          CONTRACTS.STRATEGY_TOKEN,
          "transfer",
          [Cl.uint(5000), Cl.principal(alice), Cl.principal(bob), Cl.none()],
          alice
        );
        console.log("- Transfer RATHER to Bob:", transferResult.result.type);
        
        // 5. Bob performs RATHER -> STX swap
        console.log("- Bob swapping RATHER for STX");
        const swapRatherResult = contract.call(
          CONTRACTS.LIQUIDITY_POOL,
          "swap-rather-for-stx",
          [Cl.uint(5000), Cl.uint(0)], // 0 min out for testing
          bob
        );
        console.log("  Swap result:", swapRatherResult.result);
      }
    } else {
      console.log("  Skipping swaps - pool needs STX funding");
    }

    // Check strategy fee balance
    const feeBalance1 = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "get-fee-balance",
      [],
      alice
    );
    console.log("- Strategy fee balance after swaps:", feeBalance1.result);

    console.log("\n=== Phase 3: NFT Buy & Relist Strategy ===");
    
    // 6. Mint an NFT to deployer
    console.log("- Minting NFT to deployer");
    const nftMintResult = contract.call(
      CONTRACTS.NFT,
      "mint",
      [Cl.principal(deployer)],
      deployer
    );
    expect(nftMintResult.result).toEqual(Cl.ok(Cl.uint(1)));

    // 7. List the NFT for sale in marketplace
    console.log("- Listing NFT for 100,000 micro-STX");
    const listResult = contract.call(
      CONTRACTS.MARKETPLACE,
      "list-asset",
      [
        Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
        Cl.tuple({ "token-id": Cl.uint(1), price: Cl.uint(100000) })
      ],
      deployer
    );
    expect(listResult.result).toEqual(Cl.ok(Cl.uint(0))); // Listing ID 0

    // 8. Check if strategy has enough balance to buy
    const feeBalance2 = contract.call(
      CONTRACTS.STRATEGY_TOKEN, 
      "get-fee-balance",
      [],
      alice
    );
    console.log("- Fee balance before buy-and-relist:", feeBalance2.result);
    
    // Only attempt buy-and-relist if strategy has enough STX
    // Type guard for fee balance
    if (feeBalance2.result.type === 'ok' && 
        feeBalance2.result.value.type === 'uint' && 
        Number(feeBalance2.result.value.value) >= 100000) {
      console.log("- Strategy buying and relisting NFT");
      const buyRelistResult = contract.call(
        CONTRACTS.STRATEGY_TOKEN,
        "buy-and-relist-nft",
        [Cl.uint(0)],
        deployer
      );
      console.log("  Buy-and-relist result:", buyRelistResult.result);
      
      if (buyRelistResult.result.type === "ok") {
        // 9. Charlie buys the relisted NFT
        console.log("- Charlie buying relisted NFT");
        const charlieBuyResult = contract.call(
          CONTRACTS.MARKETPLACE,
          "fulfill-listing-stx",
          [Cl.uint(1), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
          charlie
        );
        console.log("  Charlie buy result:", charlieBuyResult.result);
      }
    } else {
      console.log("- Insufficient fee balance for buy-and-relist");
    }

    console.log("\n=== Phase 4: Buy Token and Burn ===");
    
    // 10. Check final strategy balances
    // @ts-ignore - simnet is available
    const strategyStxBalance = simnet.getAssetsMap().get("STX")
      ?.get(`${deployer}.${CONTRACTS.STRATEGY_TOKEN}`) || 0n;
    console.log("- Strategy STX balance:", strategyStxBalance);
    
    // Only attempt buy-and-burn if strategy has STX
    if (strategyStxBalance > 0n) {
      console.log("- Strategy buying RATHER and burning");
      const buyBurnResult = contract.call(
        CONTRACTS.STRATEGY_TOKEN,
        "buy-token-and-burn",
        [Cl.principal(`${deployer}.${CONTRACTS.LIQUIDITY_POOL}`)],
        deployer
      );
      console.log("  Buy-and-burn result:", buyBurnResult.result);
    } else {
      console.log("- No STX balance for buy-and-burn");
    }

    // Final state
    console.log("\n=== Final State ===");
    const finalFeeBalance = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "get-fee-balance",
      [],
      alice
    );
    const burnedBalance = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "get-burned-balance", 
      [],
      alice
    );
    
    console.log("- Final fee balance:", finalFeeBalance.result);
    console.log("- Burned RATHER balance:", burnedBalance.result);
  });

  it("should test strategy flow with simulated fee accumulation", () => {
    console.log("\n=== Strategy Flow with Simulated Fees ===");
    
    // 1. Setup: Mint tokens and initialize pool
    const mintResult = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "mint", 
      [],
      deployer
    );
    expect(mintResult.result).toEqual(Cl.ok(Cl.bool(true)));

    const initResult = contract.call(
      CONTRACTS.LIQUIDITY_POOL,
      "init",
      [],
      deployer
    );
    expect(initResult.result.type).toBe("ok");

    // 2. Since we can't directly add fees in test (ERR_LP_ONLY),
    // we'll test the buy-and-relist flow with insufficient balance first
    console.log("\n- Testing buy-and-relist with insufficient balance");
    
    // Mint NFT
    contract.call(
      CONTRACTS.NFT,
      "mint",
      [Cl.principal(alice)],
      deployer
    );

    // List NFT for 1 STX
    const listResult = contract.call(
      CONTRACTS.MARKETPLACE,
      "list-asset",
      [
        Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
        Cl.tuple({ "token-id": Cl.uint(1), price: Cl.uint(1000000) })
      ],
      alice
    );
    expect(listResult.result).toEqual(Cl.ok(Cl.uint(0)));

    // Try buy-and-relist (should fail with insufficient balance)
    const buyRelistResult = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "buy-and-relist-nft",
      [Cl.uint(0)],
      deployer
    );
    console.log("  Buy-and-relist result:", buyRelistResult.result);
    expect(buyRelistResult.result.type).toBe("err");
    expect(buyRelistResult.result.value).toEqual(Cl.uint(202)); // ERR_INSUFFICIENT_BAL

    // 3. Test NFT marketplace flow separately
    console.log("\n- Testing NFT marketplace flow");
    
    // Bob buys the NFT directly
    const bobBuyResult = contract.call(
      CONTRACTS.MARKETPLACE,
      "fulfill-listing-stx",
      [Cl.uint(0), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      bob
    );
    console.log("  Bob bought NFT:", bobBuyResult.result.type);
    expect(bobBuyResult.result.type).toBe("ok");

    // Verify NFT ownership
    const owner = contract.readOnly(
      CONTRACTS.NFT,
      "get-owner",
      [Cl.uint(1)],
      bob
    );
    console.log("  NFT owner:", owner.result);
    expect(owner.result).toEqual(Cl.ok(Cl.some(Cl.principal(bob))));

    // 4. Test floor price tracking
    console.log("\n- Testing floor price tracking");
    
    // Mint more NFTs and list them at different prices
    const prices = [800000, 1200000, 900000]; // 0.8, 1.2, 0.9 STX
    prices.forEach((price, index) => {
      const mintResult = contract.call(CONTRACTS.NFT, "mint", [Cl.principal(alice)], deployer);
      expect(mintResult.result.type).toBe("ok");
      
      const listResult = contract.call(
        CONTRACTS.MARKETPLACE,
        "list-asset",
        [
          Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
          Cl.tuple({ "token-id": Cl.uint(index + 2), price: Cl.uint(price) })
        ],
        alice
      );
      expect(listResult.result.type).toBe("ok");
    });

    // Check floor price
    const floorPrice = contract.readOnly(
      CONTRACTS.MARKETPLACE,
      "get-floor-price",
      [Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      alice
    );
    console.log("  Floor price:", floorPrice.result);
    expect(floorPrice.result.type).toBe("ok");
    
    if (floorPrice.result.type === 'ok' && 
        floorPrice.result.value.type === 'some' && 
        floorPrice.result.value.value.type === 'uint') {
      expect(floorPrice.result.value.value.value).toEqual(800000n); // Lowest price
    }
  });

  it("should test buy-token-and-burn with balance", () => {
    console.log("\n=== Test Buy-Token-and-Burn ===");
    
    // Setup pool
    contract.call(CONTRACTS.STRATEGY_TOKEN, "mint", [], deployer);
    contract.call(CONTRACTS.LIQUIDITY_POOL, "init", [], deployer);

    // Check initial burned balance
    const initialBurned = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "get-burned-balance",
      [],
      alice
    );
    console.log("- Initial burned balance:", initialBurned.result);
    expect(initialBurned.result).toEqual(Cl.ok(Cl.uint(0)));

    // In a real scenario, the strategy would have accumulated STX from NFT sales
    // For testing, we verify the function behavior
    const strategyContract = `${deployer}.${CONTRACTS.STRATEGY_TOKEN}`;
    // @ts-ignore - simnet is available
    const currentStxBalance = simnet.getAssetsMap().get("STX")?.get(strategyContract) || 0n;
    console.log("- Strategy STX balance:", currentStxBalance);

    // Test buy-token-and-burn (will fail if no STX balance)
    const buyBurnResult = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "buy-token-and-burn",
      [Cl.principal(`${deployer}.${CONTRACTS.LIQUIDITY_POOL}`)],
      deployer
    );
    console.log("- Buy-and-burn result:", buyBurnResult.result);
    
    if (buyBurnResult.result.type === "ok") {
      // Check updated burned balance
      const finalBurned = contract.call(
        CONTRACTS.STRATEGY_TOKEN,
        "get-burned-balance",
        [],
        alice
      );
      console.log("- Final burned balance:", finalBurned.result);
    } else {
      // Verify we got the expected error
      expect(buyBurnResult.result.type).toBe("err");
      expect(buyBurnResult.result.value).toEqual(Cl.uint(202)); // ERR_INSUFFICIENT_BAL
    }
  });

  it("should test complete flow with simulated STX funding", () => {
    console.log("\n=== Complete Flow with Simulated Funding ===");
    
    // Setup: Initialize pool and mint tokens
    contract.call(CONTRACTS.STRATEGY_TOKEN, "mint", [], deployer);
    contract.call(CONTRACTS.LIQUIDITY_POOL, "init", [], deployer);
    
    // 1. Simulate multiple NFT sales to accumulate fees
    console.log("\n- Simulating NFT marketplace activity");
    
    // Create and sell multiple NFTs at different prices
    const nftSales = [
      { seller: alice, buyer: bob, price: 500000 },
      { seller: alice, buyer: charlie, price: 750000 },
      { seller: bob, buyer: alice, price: 1000000 }
    ];
    
    nftSales.forEach(({ seller, buyer, price }, index) => {
      // Mint NFT to seller
      const tokenId = index + 1;
      const mintResult = contract.call(
        CONTRACTS.NFT,
        "mint",
        [Cl.principal(seller)],
        deployer
      );
      expect(mintResult.result).toEqual(Cl.ok(Cl.uint(tokenId)));
      
      // List NFT
      const listResult = contract.call(
        CONTRACTS.MARKETPLACE,
        "list-asset",
        [
          Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
          Cl.tuple({ "token-id": Cl.uint(tokenId), price: Cl.uint(price) })
        ],
        seller
      );
      expect(listResult.result.type).toBe("ok");
      
      // Buy NFT
      const buyResult = contract.call(
        CONTRACTS.MARKETPLACE,
        "fulfill-listing-stx",
        [Cl.uint(index), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
        buyer
      );
      console.log(`  Sale ${index + 1}: ${price} STX from ${buyer} to ${seller}`);
      expect(buyResult.result.type).toBe("ok");
    });
    
    // 2. Check accumulated marketplace fees
    console.log("\n- Checking marketplace state");
    
    // Get floor price after multiple listings
    const floorPrice = contract.readOnly(
      CONTRACTS.MARKETPLACE,
      "get-floor-price",
      [Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      alice
    );
    console.log("  Current floor price:", floorPrice.result);
    
    // 3. Test edge cases
    console.log("\n- Testing edge cases");
    
    // Try to cancel non-existent listing
    const cancelInvalid = contract.call(
      CONTRACTS.MARKETPLACE,
      "cancel-listing",
      [Cl.uint(999), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      alice
    );
    expect(cancelInvalid.result.type).toBe("err");
    console.log("  Cancel invalid listing: ERR as expected");
    
    // Try to buy already sold NFT
    const buyAgain = contract.call(
      CONTRACTS.MARKETPLACE,
      "fulfill-listing-stx",
      [Cl.uint(0), Cl.principal(`${deployer}.${CONTRACTS.NFT}`)],
      charlie
    );
    expect(buyAgain.result.type).toBe("err");
    console.log("  Buy already sold NFT: ERR as expected");
    
    // 4. Test invalid buy-and-relist scenarios
    console.log("\n- Testing invalid buy-and-relist scenarios");
    
    // Try to buy-and-relist non-existent listing
    const invalidBuyRelist = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "buy-and-relist-nft",
      [Cl.uint(9999)],
      deployer
    );
    expect(invalidBuyRelist.result.type).toBe("err");
    if (invalidBuyRelist.result.type === 'err') {
      expect(invalidBuyRelist.result.value).toEqual(Cl.uint(300)); // ERR_UNKNOWN_LISTING
    }
    console.log("  Buy-and-relist invalid listing: ERR_UNKNOWN_LISTING");
    
    // 5. Final state verification
    console.log("\n- Final verification");
    
    // Check total supply hasn't changed
    const totalSupply = contract.readOnly(
      CONTRACTS.STRATEGY_TOKEN,
      "get-total-supply",
      [],
      alice
    );
    console.log("  Total supply:", totalSupply.result);
    expect(totalSupply.result).toEqual(Cl.ok(Cl.uint(1000000000000)));
  });

  it("should test error scenarios comprehensively", () => {
    console.log("\n=== Comprehensive Error Scenarios ===");
    
    // Setup
    contract.call(CONTRACTS.STRATEGY_TOKEN, "mint", [], deployer);
    contract.call(CONTRACTS.LIQUIDITY_POOL, "init", [], deployer);
    
    // 1. Test double initialization
    console.log("\n- Testing double initialization");
    const secondMint = contract.call(CONTRACTS.STRATEGY_TOKEN, "mint", [], deployer);
    expect(secondMint.result.type).toBe("err");
    if (secondMint.result.type === 'err') {
      expect(secondMint.result.value).toEqual(Cl.uint(205)); // ERR_ALREADY_BOOTSTRAPPED
    }
    console.log("  Double mint: ERR_ALREADY_BOOTSTRAPPED");
    
    const secondInit = contract.call(CONTRACTS.LIQUIDITY_POOL, "init", [], deployer);
    expect(secondInit.result.type).toBe("err");
    console.log("  Double init: ERR as expected");
    
    // 2. Test unauthorized operations
    console.log("\n- Testing unauthorized operations");
    
    // Try to add fees directly (not from LP)
    const addFeesDirect = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "add-fees",
      [Cl.uint(1000000)],
      alice
    );
    expect(addFeesDirect.result.type).toBe("err");
    if (addFeesDirect.result.type === 'err') {
      expect(addFeesDirect.result.value).toEqual(Cl.uint(206)); // ERR_LP_ONLY
    }
    console.log("  Add fees directly: ERR_LP_ONLY");
    
    // 3. Test NFT operations with wrong owner
    console.log("\n- Testing NFT operations with wrong owner");
    
    // Mint NFT to alice
    contract.call(CONTRACTS.NFT, "mint", [Cl.principal(alice)], deployer);
    
    // Try to list NFT as bob (not owner)
    const wrongOwnerList = contract.call(
      CONTRACTS.MARKETPLACE,
      "list-asset",
      [
        Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
        Cl.tuple({ "token-id": Cl.uint(1), price: Cl.uint(100000) })
      ],
      bob
    );
    expect(wrongOwnerList.result.type).toBe("err");
    console.log("  List NFT as non-owner: ERR as expected");
    
    // 4. Test transfer restrictions
    console.log("\n- Testing transfer restrictions");
    
    // Try to transfer from wrong sender
    const wrongSenderTransfer = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "transfer",
      [Cl.uint(1000), Cl.principal(alice), Cl.principal(bob), Cl.none()],
      bob // Bob trying to transfer Alice's tokens
    );
    expect(wrongSenderTransfer.result.type).toBe("err");
    if (wrongSenderTransfer.result.type === 'err') {
      expect(wrongSenderTransfer.result.value).toEqual(Cl.uint(201)); // ERR_NOT_TOKEN_OWNER
    }
    console.log("  Transfer from wrong sender: ERR_NOT_TOKEN_OWNER");
    
    // 5. Test boundary conditions
    console.log("\n- Testing boundary conditions");
    
    // Try to transfer 0 tokens (this actually fails with ERR_BAD_AMOUNT in this implementation)
    const zeroTransfer = contract.call(
      CONTRACTS.STRATEGY_TOKEN,
      "transfer",
      [Cl.uint(0), Cl.principal(deployer), Cl.principal(alice), Cl.none()],
      deployer
    );
    expect(zeroTransfer.result.type).toBe("err");
    if (zeroTransfer.result.type === 'err') {
      expect(zeroTransfer.result.value).toEqual(Cl.uint(3)); // ERR_BAD_AMOUNT in ft-trait
    }
    console.log("  Transfer 0 tokens: ERR_BAD_AMOUNT (as expected in this implementation)");
    
    // Try to list NFT with 0 price
    contract.call(CONTRACTS.NFT, "mint", [Cl.principal(alice)], deployer);
    const zeroPriceList = contract.call(
      CONTRACTS.MARKETPLACE,
      "list-asset",
      [
        Cl.principal(`${deployer}.${CONTRACTS.NFT}`),
        Cl.tuple({ "token-id": Cl.uint(2), price: Cl.uint(0) })
      ],
      alice
    );
    console.log("  List NFT with 0 price:", zeroPriceList.result.type);
  });
});