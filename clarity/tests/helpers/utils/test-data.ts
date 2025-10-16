import { utils } from "./utils";
import { TestAccount, Listing } from "./types";

/**
 * Test data factory functions
 */
export const testData = {
  /**
   * Create a listing object for testing
   * @param tokenId - The NFT token ID
   * @param priceInSTX - Price in STX (will be converted to micro-STX)
   * @returns Listing object
   */
  createListing: (tokenId: number, priceInSTX: number): Listing => ({
    tokenId,
    price: utils.stxToMicro(priceInSTX),
    priceInSTX,
  }),

  /**
   * Create a user object for testing
   * @param name - User's name
   * @param address - User's Stacks address
   * @returns TestAccount object
   */
  createUser: (name: string, address: string): TestAccount => ({
    name,
    address,
  }),

  /**
   * Create multiple listings for testing
   * @param count - Number of listings to create
   * @param basePrice - Base price in STX (each listing will increment by 0.1 STX)
   * @returns Array of listings
   */
  createListings: (count: number, basePrice: number = 1): Listing[] => {
    return Array.from({ length: count }, (_, i) => 
      testData.createListing(i + 1, basePrice + (i * 0.1))
    );
  },

  /**
   * Create a batch of test users
   * @param count - Number of users to create
   * @returns Array of test accounts
   */
  createUsers: (count: number): TestAccount[] => {
    return Array.from({ length: count }, (_, i) => 
      testData.createUser(`user${i + 1}`, `ST${utils.uniqueId("USER")}`)
    );
  },

  /**
   * Create NFT metadata
   * @param tokenId - Token ID
   * @param name - NFT name
   * @param uri - NFT URI
   * @returns NFT metadata object
   */
  createNFTMetadata: (tokenId: number, name?: string, uri?: string) => ({
    tokenId,
    name: name || `NFT #${tokenId}`,
    uri: uri || `https://example.com/nft/${tokenId}`,
  }),

  /**
   * Create a swap configuration
   * @param amountIn - Amount to swap
   * @param minOut - Minimum amount out
   * @param slippage - Slippage percentage (default 5%)
   * @returns Swap configuration
   */
  createSwapConfig: (amountIn: number, expectedOut: number, slippage: number = 5) => ({
    amountIn,
    expectedOut,
    minOut: Math.floor(expectedOut * (100 - slippage) / 100),
    slippage,
  }),

  /**
   * Create test prices in different denominations
   * @param basePrice - Base price in STX
   * @returns Object with prices in different units
   */
  createPrices: (basePrice: number) => ({
    stx: basePrice,
    microStx: utils.stxToMicro(basePrice),
    display: utils.formatSTX(utils.stxToMicro(basePrice)),
  }),
};