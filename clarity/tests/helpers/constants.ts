// Contract names
export const CONTRACTS = {
  NFT: "funny-dog",
  MARKETPLACE: "nft-marketplace",
  LIQUIDITY_POOL: "liquidity-pool",
  STRATEGY_TOKEN: "strategy-token",
} as const;

// Error codes
export const ERROR_CODES = {
  // Marketplace errors
  PRICE_ZERO: 1000,
  UNKNOWN_LISTING: 2000,
  UNAUTHORIZED: 2001,
  NFT_ASSET_MISMATCH: 2002,
  MAKER_TAKER_EQUAL: 2003,

  // NFT errors 
  NOT_OWNER: 101,
  SOLD_OUT: 300,

  // Liquidity pool errors
  LP_NOT_OWNER: 100,
  LP_ALREADY_INIT: 101,
  LP_NOT_INIT: 102,
  LP_BAD_TOKEN: 103,
  LP_BAD_INPUT: 104,
  LP_MIN_OUT: 105,
  LP_INSUFF_LIQ: 106,
} as const;

// Price constants
export const PRICES = {
  STX_TO_MICRO: 1000000,
  DEFAULT_PRICE: 1000000, // 1 STX
  HIGH_PRICE: 100000000,  // 100 STX
} as const;

// Test data
export const TEST_DATA = {
  TOKEN_ID_1: 1,
  TOKEN_ID_2: 2,
  TOKEN_ID_3: 3,
  LISTING_ID_0: 0,
  LISTING_ID_1: 1,
  LISTING_ID_2: 2,
  NON_EXISTENT_LISTING: 999,
} as const;

// Liquidity pool constants
export const POOL_CONSTANTS = {
  RATHER_FEE_BPS: 1000, // 10% fee in basis points
  BPS_DIVISOR: 10000,
  INITIAL_STX_RESERVE: 100000000, // 100 STX
  INITIAL_RATHER_RESERVE: 1000000000, // 1000 RATHER
} as const;

// Types
export type TestAccount = {
  name: string;
  address: string;
};

export type Listing = {
  tokenId: number;
  price: number;
  priceInSTX?: number;
};

export type PoolReserves = {
  stx: bigint;
  rather: bigint;
};