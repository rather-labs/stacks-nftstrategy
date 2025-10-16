import { ClarityValue } from "@stacks/transactions";

// ==================== TEST ACCOUNT TYPES ====================
export interface TestAccount {
  name: string;
  address: string;
}

export interface TestAccounts {
  deployer: string;
  alice: string;
  bob: string;
  charlie: string;
}

// ==================== SIMNET TYPES ====================
export interface SimnetResult {
  result: ClarityValue;
  events: any[];
}

// ==================== MARKETPLACE TYPES ====================
export interface Listing {
  tokenId: number;
  price: number;
  priceInSTX?: number;
}

// ==================== LIQUIDITY POOL TYPES ====================
export interface PoolReserves {
  stx: bigint;
  rather: bigint;
}

export interface SwapQuote {
  amountIn: number;
  amountOut: number;
  minOut: number;
}

// ==================== SETUP OPTIONS ====================
export interface SetupOptions {
  mineBlocks?: number;
  fundAccounts?: Array<{ address: string; amount: bigint }>;
}

// ==================== GLOBAL DECLARATIONS ====================
declare global {
  const simnet: any;
}