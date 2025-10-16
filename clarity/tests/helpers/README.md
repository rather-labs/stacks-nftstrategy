# Test Helpers Documentation

This directory contains helper utilities for testing Clarity smart contracts using the Clarinet SDK.

## Architecture Overview

The test helpers are now modularized into separate files for better organization and maintainability:

### Module Structure

#### Core Modules

1. **types.ts** - TypeScript interfaces and type definitions
   - Test account types
   - Simnet result types  
   - Domain-specific types (Listing, PoolReserves, etc.)
   - Setup configuration types

2. **accounts.ts** - Test account management
   - `signers()` - Get all test accounts
   - `getAccount()` - Get specific account by name
   - `getAllAccounts()` - Get accounts as array

3. **balance.ts** - Balance checking utilities
   - `getSTX()` - Check STX balance
   - `getToken()` - Check token balance
   - `getTokens()` - Check multiple token balances
   - `getAll()` - Get all balances for an address

4. **utils.ts** - General utility functions
   - Block mining and height management
   - STX/microSTX conversions
   - Formatting and display helpers
   - Random data generation
   - Unique ID creation

5. **test-data.ts** - Test data factories
   - Create listings, users, NFTs
   - Generate batch test data
   - Create swap configurations
   - Price helpers

6. **assertions.ts** - Clarity-specific assertions
   - Response type assertions (Ok, Err, Some, None)
   - Value type assertions (uint, bool, principal, etc.)
   - Complex type assertions (tuple, list)
   - Event assertions

7. **contract.ts** - Contract interaction helpers
   - Simplified function calling
   - Read-only function helpers
   - STX transfers
   - Multi-call support
   - Contract deployment and info

8. **test-lifecycle.ts** - Test setup and teardown
   - Test environment setup
   - State snapshots and restoration
   - Cleanup helpers
   - Test statistics

9. **test-setup.ts** - Main entry point
   - Re-exports all modules
   - Provides backward compatibility
   - Single import for all helpers

### Usage Examples

```typescript
// Import everything from test-setup
import { 
  signers, 
  contract, 
  assertions, 
  utils, 
  testData,
  balance,
  testHelpers 
} from './helpers/test-setup';

// Or import specific modules
import { signers } from './helpers/accounts';
import { assertions } from './helpers/assertions';

// Get test accounts
const { deployer, alice, bob } = signers();

// Create test data
const listing = testData.createListing(1, 10); // Token ID 1, 10 STX
const users = testData.createUsers(5); // Create 5 test users

// Setup test environment
testHelpers.setup({
  mineBlocks: 10,
  fundAccounts: [
    { address: alice, amount: 1000000n },
    { address: bob, amount: 500000n }
  ]
});

// Call contract functions
const mintResult = contract.call('nft-contract', 'mint', [Cl.principal(alice)]);
assertions.expectOk(mintResult.result, Cl.uint(1));

// Check balances
const aliceBalances = balance.getAll(alice, ['token-contract']);

// Use utilities
utils.mineUntilBlock(100);
const formatted = utils.formatSTX(1500000); // "1.5 STX"
```

### Domain-Specific Helpers

- **marketplace.helpers.ts**: NFT marketplace-specific helpers
- **liquidity-pool.helpers.ts**: Liquidity pool-specific helpers
- **constants.ts**: Shared constants and error codes

### Best Practices

1. Use the provided assertions for Clarity values
2. Leverage test data factories for consistency
3. Use contract helpers instead of direct simnet calls
4. Document any domain-specific helpers
5. Keep helpers focused and single-purpose