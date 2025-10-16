import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

const NFT = 'funny-dog';
const MARKETPLACE = 'nft-marketplace';

describe('NFT Marketplace Integration Tests', () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get('deployer')!;
  const alice = accounts.get('wallet_1')!;
  const bob = accounts.get('wallet_2')!;
  const charlie = accounts.get('wallet_3')!;
  
  const nftContract = `${deployer}.${NFT}`;

  // Helper functions
  const mintNFT = (to: string) => 
    simnet.callPublicFn(NFT, 'mint', [Cl.principal(to)], deployer);
  
  const listNFT = (tokenId: number, price: number, seller: string) =>
    simnet.callPublicFn(MARKETPLACE, 'list-asset', [
      Cl.principal(nftContract),
      Cl.tuple({ 'token-id': Cl.uint(tokenId), 'price': Cl.uint(price) })
    ], seller);
  
  const buyNFT = (listingId: number, buyer: string) =>
    simnet.callPublicFn(MARKETPLACE, 'fulfill-listing-stx', [
      Cl.uint(listingId),
      Cl.principal(nftContract)
    ], buyer);
  
  const getFloorPrice = () =>
    simnet.callReadOnlyFn(MARKETPLACE, 'get-floor-price', [
      Cl.principal(nftContract)
    ], alice);

  describe('Core Marketplace Flow', () => {
    it('should handle complete buy/sell lifecycle', () => {
      // Alice mints and lists NFT
      expect(mintNFT(alice).result).toEqual(Cl.ok(Cl.uint(1)));
      expect(listNFT(1, 1000000, alice).result).toEqual(Cl.ok(Cl.uint(0)));
      
      // Bob buys NFT
      const aliceBalanceBefore = simnet.getAssetsMap().get('STX')?.get(alice)!;
      const bobBalanceBefore = simnet.getAssetsMap().get('STX')?.get(bob)!;
      
      expect(buyNFT(0, bob).result).toEqual(Cl.ok(Cl.uint(0)));
      
      // Verify ownership and payment
      const owner = simnet.callReadOnlyFn(NFT, 'get-owner', [Cl.uint(1)], bob);
      expect(owner.result).toEqual(Cl.ok(Cl.some(Cl.principal(bob))));
      
      expect(simnet.getAssetsMap().get('STX')?.get(alice)!).toBe(aliceBalanceBefore + 1000000n);
      expect(simnet.getAssetsMap().get('STX')?.get(bob)!).toBe(bobBalanceBefore - 1000000n);
    });

    it('should prevent self-purchases and unauthorized cancellations', () => {
      // Setup
      mintNFT(alice);
      listNFT(1, 1000000, alice);
      
      // Alice cannot buy her own NFT
      expect(buyNFT(0, alice).result).toEqual(Cl.error(Cl.uint(2003)));
      
      // Bob cannot cancel Alice's listing
      const cancelResult = simnet.callPublicFn(MARKETPLACE, 'cancel-listing', [
        Cl.uint(0),
        Cl.principal(nftContract)
      ], bob);
      expect(cancelResult.result).toEqual(Cl.error(Cl.uint(2001)));
    });
  });

  describe('Floor Price Feature', () => {
    beforeEach(() => {
      // Reset state between tests
      simnet.mineEmptyBlocks(1);
    });

    it('should track floor price correctly', () => {
      // Initially no floor price
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.none()));
      
      // Alice lists NFT at 2 STX
      mintNFT(alice);
      listNFT(1, 2000000, alice);
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(2000000))));
      
      // Bob lists cheaper NFT at 1.5 STX - floor price updates
      mintNFT(bob);
      listNFT(2, 1500000, bob);
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(1500000))));
      
      // Charlie lists even cheaper at 1 STX - floor price updates again
      mintNFT(charlie);
      listNFT(3, 1000000, charlie);
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(1000000))));
      
      // Someone buys the cheapest NFT - floor price should update
      buyNFT(2, alice); // Buy Charlie's NFT
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(1500000))));
    });

    it('should remove floor price when no listings remain', () => {
      // Create single listing
      mintNFT(alice);
      listNFT(1, 1000000, alice);
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(1000000))));
      
      // Cancel listing - floor price should be removed
      simnet.callPublicFn(MARKETPLACE, 'cancel-listing', [
        Cl.uint(0),
        Cl.principal(nftContract)
      ], alice);
      
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.none()));
    });
  });

  describe('Multi-User Marketplace', () => {
    it('should handle concurrent listings and sales', () => {
      // Multiple users mint and list
      const users = [alice, bob, charlie];
      const prices = [3000000, 2000000, 2500000];
      
      users.forEach((user, i) => {
        mintNFT(user);
        listNFT(i + 1, prices[i], user);
      });
      
      // Floor price should be Bob's listing (cheapest)
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(2000000))));
      
      // Cross-trading scenario
      buyNFT(0, bob); // Bob buys Alice's NFT
      buyNFT(1, charlie); // Charlie buys Bob's NFT
      
      // Only Charlie's listing remains, floor price updates
      expect(getFloorPrice().result).toEqual(Cl.ok(Cl.some(Cl.uint(2500000))));
      
      // Verify ownership transfers
      expect(simnet.callReadOnlyFn(NFT, 'get-owner', [Cl.uint(1)], bob).result)
        .toEqual(Cl.ok(Cl.some(Cl.principal(bob))));
      expect(simnet.callReadOnlyFn(NFT, 'get-owner', [Cl.uint(2)], charlie).result)
        .toEqual(Cl.ok(Cl.some(Cl.principal(charlie))));
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero price and non-existent listings', () => {
      mintNFT(alice);
      
      // Cannot list with zero price
      expect(listNFT(1, 0, alice).result).toEqual(Cl.error(Cl.uint(1000)));
      
      // Cannot buy non-existent listing
      expect(buyNFT(999, bob).result).toEqual(Cl.error(Cl.uint(2000)));
    });

    it('should maintain listing integrity', () => {
      // Create multiple listings and verify nonce increments
      const count = 3;
      for (let i = 1; i <= count; i++) {
        mintNFT(alice);
        expect(listNFT(i, 1000000 * i, alice).result).toEqual(Cl.ok(Cl.uint(i - 1)));
      }
      
      // Verify nonce
      const nonce = simnet.callReadOnlyFn(MARKETPLACE, 'get-listing-nonce', [], alice);
      expect(nonce.result).toEqual(Cl.ok(Cl.uint(count)));
    });
  });
});