/**
 * Centralized test setup module
 * Re-exports all test helper modules for convenience
 */

// Re-export all types
export * from "./types";

// Re-export all modules
export { signers, getAccount, getAllAccounts } from "./accounts";
export { balance } from "./balance";
export { utils } from "./utils";
export { testData } from "./test-data";
export { assertions, expect } from "./assertions";
export { contract } from "./contract";
export { testHelpers } from "./test-lifecycle";

// Re-export constants for convenience
export { CONTRACTS, ERROR_CODES, PRICES, POOL_CONSTANTS } from "../constants";

// Default export with all modules for backward compatibility
import { signers } from "./accounts";
import { balance } from "./balance";
import { utils } from "./utils";
import { testData } from "./test-data";
import { assertions } from "./assertions";
import { contract } from "./contract";
import { testHelpers } from "./test-lifecycle";

export default {
  signers,
  balance,
  utils,
  testData,
  assertions,
  contract,
  testHelpers,
};