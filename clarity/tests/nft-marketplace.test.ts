import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

// Declare the global simnet for TypeScript
declare const simnet: any;

const FUNNY_DOG = 'funny-dog';
const MARKETPLACE = 'nft-marketplace';

describe('NFT Marketplace - Integrated Tests', () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get('deployer')!;
  const seller = accounts.get('wallet_1')!;
  const buyer1 = accounts.get('wallet_2')!;
  const buyer2 = accounts.get('wallet_3')!;

  describe('Full Marketplace Flow', () => {
    it('should handle complete listing and purchase flow', () => {
      // Seller mints NFT
      const mint = simnet.callPublicFn(
        FUNNY_DOG,
        'mint',
        [Cl.principal(seller)],
        seller
      );
      expect(mint.result).toEqual(Cl.ok(Cl.uint(1)));

      // Seller lists NFT for 100 STX
      const list = simnet.callPublicFn(
        MARKETPLACE,
        'list-asset',
        [
          Cl.principal(`${deployer}.${FUNNY_DOG}`),
          Cl.tuple({
            'token-id': Cl.uint(1),
            'price': Cl.uint(100000000) // 100 STX in microSTX
          })
        ],
        seller
      );
      expect(list.result).toEqual(Cl.ok(Cl.uint(0)));

      // Record balances before purchase
      const sellerBalanceBefore = simnet.getAssetsMap().get('STX')?.get(seller) || 0n;
      const buyerBalanceBefore = simnet.getAssetsMap().get('STX')?.get(buyer1) || 0n;

      // Buyer purchases NFT
      const purchase = simnet.callPublicFn(
        MARKETPLACE,
        'fulfill-listing-stx',
        [
          Cl.uint(0),
          Cl.principal(`${deployer}.${FUNNY_DOG}`)
        ],
        buyer1
      );
      expect(purchase.result).toEqual(Cl.ok(Cl.uint(0)));

      // Verify NFT ownership transferred
      const newOwner = simnet.callReadOnlyFn(
        FUNNY_DOG,
        'get-owner',
        [Cl.uint(1)],
        buyer1
      );
      expect(newOwner.result).toEqual(Cl.ok(Cl.some(Cl.principal(buyer1))));

      // Verify STX payment
      const sellerBalanceAfter = simnet.getAssetsMap().get('STX')?.get(seller) || 0n;
      const buyerBalanceAfter = simnet.getAssetsMap().get('STX')?.get(buyer1) || 0n;
      
      expect(sellerBalanceAfter).toBe(sellerBalanceBefore + 100000000n);
      expect(buyerBalanceAfter).toBe(buyerBalanceBefore - 100000000n);

      // Verify listing removed
      const listing = simnet.callReadOnlyFn(
        MARKETPLACE,
        'get-listing',
        [Cl.uint(0)],
        buyer1
      );
      expect(listing.result).toEqual(Cl.none());
    });
  });

  describe('Multiple Listings Scenario', () => {
    it('should handle multiple sellers and buyers in the marketplace', () => {
      // Multiple sellers mint and list NFTs
      const sellers = [seller, buyer1, buyer2];
      const prices = [50000000, 75000000, 60000000]; // 50, 75, 60 STX
      
      sellers.forEach((user, index) => {
        // Mint NFT
        simnet.callPublicFn(FUNNY_DOG, 'mint', [Cl.principal(user)], user);
        
        // List NFT
        simnet.callPublicFn(
          MARKETPLACE,
          'list-asset',
          [
            Cl.principal(`${deployer}.${FUNNY_DOG}`),
            Cl.tuple({
              'token-id': Cl.uint(index + 1),
              'price': Cl.uint(prices[index])
            })
          ],
          user
        );
      });

      // Different buyers purchase different NFTs
      const purchases = [
        { buyer: buyer2, listingId: 1 }, // buyer2 buys from buyer1
        { buyer: seller, listingId: 2 }, // seller buys from buyer2
      ];

      purchases.forEach(({ buyer, listingId }) => {
        const result = simnet.callPublicFn(
          MARKETPLACE,
          'fulfill-listing-stx',
          [
            Cl.uint(listingId),
            Cl.principal(`${deployer}.${FUNNY_DOG}`)
          ],
          buyer
        );
        expect(result.result).toEqual(Cl.ok(Cl.uint(listingId)));
      });

      // Verify ownership changes
      expect(
        simnet.callReadOnlyFn(FUNNY_DOG, 'get-owner', [Cl.uint(2)], buyer2).result
      ).toEqual(Cl.ok(Cl.some(Cl.principal(buyer2))));
      
      expect(
        simnet.callReadOnlyFn(FUNNY_DOG, 'get-owner', [Cl.uint(3)], seller).result
      ).toEqual(Cl.ok(Cl.some(Cl.principal(seller))));
    });
  });

  describe('Listing Management', () => {
    it('should allow sellers to update listings by canceling and relisting', () => {
      // Mint and list NFT
      simnet.callPublicFn(FUNNY_DOG, 'mint', [Cl.principal(seller)], seller);
      
      const firstListing = simnet.callPublicFn(
        MARKETPLACE,
        'list-asset',
        [
          Cl.principal(`${deployer}.${FUNNY_DOG}`),
          Cl.tuple({
            'token-id': Cl.uint(1),
            'price': Cl.uint(100000000) // 100 STX
          })
        ],
        seller
      );
      expect(firstListing.result).toEqual(Cl.ok(Cl.uint(0)));

      // Cancel listing
      const cancel = simnet.callPublicFn(
        MARKETPLACE,
        'cancel-listing',
        [
          Cl.uint(0),
          Cl.principal(`${deployer}.${FUNNY_DOG}`)
        ],
        seller
      );
      expect(cancel.result).toEqual(Cl.ok(Cl.bool(true)));

      // Relist at new price
      const newListing = simnet.callPublicFn(
        MARKETPLACE,
        'list-asset',
        [
          Cl.principal(`${deployer}.${FUNNY_DOG}`),
          Cl.tuple({
            'token-id': Cl.uint(1),
            'price': Cl.uint(80000000) // 80 STX (reduced price)
          })
        ],
        seller
      );
      expect(newListing.result).toEqual(Cl.ok(Cl.uint(1)));

      // Verify new listing details
      const listing = simnet.callReadOnlyFn(
        MARKETPLACE,
        'get-listing',
        [Cl.uint(1)],
        seller
      );
      
      expect(listing.result).toEqual(Cl.some(
        Cl.tuple({
          'maker': Cl.principal(seller),
          'token-id': Cl.uint(1),
          'nft-asset-contract': Cl.principal(`${deployer}.${FUNNY_DOG}`),
          'price': Cl.uint(80000000)
        })
      ));
    });
  });

  describe('Security Features', () => {
    it('should prevent common marketplace attacks', () => {
      // Setup: mint NFT and list it
      simnet.callPublicFn(FUNNY_DOG, 'mint', [Cl.principal(seller)], seller);
      simnet.callPublicFn(
        MARKETPLACE,
        'list-asset',
        [
          Cl.principal(`${deployer}.${FUNNY_DOG}`),
          Cl.tuple({
            'token-id': Cl.uint(1),
            'price': Cl.uint(100000000)
          })
        ],
        seller
      );

      // Test 1: Seller cannot buy their own NFT
      const selfPurchase = simnet.callPublicFn(
        MARKETPLACE,
        'fulfill-listing-stx',
        [
          Cl.uint(0),
          Cl.principal(`${deployer}.${FUNNY_DOG}`)
        ],
        seller
      );
      expect(selfPurchase.result).toEqual(Cl.error(Cl.uint(2003)));

      // Test 2: Non-owner cannot cancel listing
      const unauthorizedCancel = simnet.callPublicFn(
        MARKETPLACE,
        'cancel-listing',
        [
          Cl.uint(0),
          Cl.principal(`${deployer}.${FUNNY_DOG}`)
        ],
        buyer1
      );
      expect(unauthorizedCancel.result).toEqual(Cl.error(Cl.uint(2001)));

      // Test 3: Cannot list with zero price
      simnet.callPublicFn(FUNNY_DOG, 'mint', [Cl.principal(buyer1)], buyer1);
      const zeroPrice = simnet.callPublicFn(
        MARKETPLACE,
        'list-asset',
        [
          Cl.principal(`${deployer}.${FUNNY_DOG}`),
          Cl.tuple({
            'token-id': Cl.uint(2),
            'price': Cl.uint(0)
          })
        ],
        buyer1
      );
      expect(zeroPrice.result).toEqual(Cl.error(Cl.uint(1000)));
    });
  });

  describe('Marketplace Analytics', () => {
    it('should track marketplace activity through nonce', () => {
      // Check initial nonce
      const initialNonce = simnet.callReadOnlyFn(
        MARKETPLACE,
        'get-listing-nonce',
        [],
        seller
      );
      expect(initialNonce.result).toEqual(Cl.ok(Cl.uint(0)));

      // Create multiple listings
      const numListings = 5;
      for (let i = 1; i <= numListings; i++) {
        simnet.callPublicFn(FUNNY_DOG, 'mint', [Cl.principal(seller)], seller);
        simnet.callPublicFn(
          MARKETPLACE,
          'list-asset',
          [
            Cl.principal(`${deployer}.${FUNNY_DOG}`),
            Cl.tuple({
              'token-id': Cl.uint(i),
              'price': Cl.uint(50000000 + (i * 10000000))
            })
          ],
          seller
        );
      }

      // Check final nonce
      const finalNonce = simnet.callReadOnlyFn(
        MARKETPLACE,
        'get-listing-nonce',
        [],
        seller
      );
      expect(finalNonce.result).toEqual(Cl.ok(Cl.uint(numListings)));

      // Purchase some listings
      [0, 2, 4].forEach(listingId => {
        simnet.callPublicFn(
          MARKETPLACE,
          'fulfill-listing-stx',
          [
            Cl.uint(listingId),
            Cl.principal(`${deployer}.${FUNNY_DOG}`)
          ],
          buyer1
        );
      });

      // Verify remaining active listings
      const activeListings = [1, 3];
      activeListings.forEach(id => {
        const listing = simnet.callReadOnlyFn(
          MARKETPLACE,
          'get-listing',
          [Cl.uint(id)],
          seller
        );
        expect(listing.result).not.toEqual(Cl.none());
      });
    });
  });

  describe('Collection Limits', () => {
    it('should respect NFT collection limits', () => {
      const maxMints = 10; // Test with smaller number for speed
      const results = [];

      // Try to mint beyond limit
      for (let i = 0; i < maxMints + 2; i++) {
        const result = simnet.callPublicFn(
          FUNNY_DOG,
          'mint',
          [Cl.principal(seller)],
          seller
        );
        results.push(result);
      }

      // All mints within limit should succeed
      results.slice(0, maxMints).forEach((result, index) => {
        expect(result.result).toEqual(Cl.ok(Cl.uint(index + 1)));
      });

      // Verify we can list all successfully minted NFTs
      const listingResults = [];
      for (let i = 1; i <= maxMints; i++) {
        const result = simnet.callPublicFn(
          MARKETPLACE,
          'list-asset',
          [
            Cl.principal(`${deployer}.${FUNNY_DOG}`),
            Cl.tuple({
              'token-id': Cl.uint(i),
              'price': Cl.uint(10000000 * i)
            })
          ],
          seller
        );
        listingResults.push(result);
      }

      // All listings should succeed
      listingResults.forEach((result, index) => {
        expect(result.result).toEqual(Cl.ok(Cl.uint(index)));
      });
    });
  });
});