# AGENTS.md

This guide orients AI coding agents (Cursor, Copilot, Claude Code, etc.) to “vibe code” effectively in this repo: keep tight loops, small diffs, frequent checks, and always finish a runnable slice.

## Development Commands

Monorepo is managed with Turbo and npm workspaces. Common tasks run at the repo root:

- Build all: `npm run build` (turbo run build)
- Dev all: `npm run dev` (turbo run dev)
- Lint all: `npm run lint`
- Test all: `npm run test`
- Watch tests: `npm run test:watch`

Scope commands to a workspace (if needed):

- Frontend only: `turbo run dev --filter=front-end`
- Clarity only: `turbo run test --filter=clarity`

Contracts (Clarinet):

- Compile: VS Code task “check contracts” (runs `clarinet check`)
- Tests: `npm test` (Clarinet TS tests under `./tests`)

Turbo tips:

- Leverage caching: Turbo caches per task/target; prefer stable inputs and avoid noisy outputs.
- Parallelism: By default, Turbo runs tasks in parallel where safe. Add serial constraints via pipeline (turbo.json) if introduced.
- Filters: `--filter=<workspace>` or `--filter=...[affected]` to limit the surface area during inner loops.

## Project map

- Frontend: Next.js app using Stacks.js (wallet, transactions, data). Current code was forked as a baseline and does not yet implement our flows. Treat it as scaffolding to be reshaped.
- Clarity: Stacks smart contracts managed with Clarinet. Current contracts are mocks/placeholders; we’ll iterate to the target behavior.

Repo layout (high-level):

- `contracts/` — Clarity contracts (Clarinet) and traits
- `tests/` — Clarinet tests (TypeScript)
- `Clarinet.toml` — Contracts registry
- Frontend folder — Next.js app using Stacks.js (location may vary; adapt paths as needed)

## Architecture Overview

End-to-end flow: a Next.js app (Stacks.js) drives user actions (buy floor NFT, relist, process sale) against Clarity contracts (Strategy+Token, Marketplace, Pool, Collection). Fees are captured at token level (fee-on-transfer) so any market interaction accrues treasury.

### Core Technologies

- Next.js + React + TypeScript
- Stacks.js (wallet connect, contract calls, tx broadcasting)
- Clarinet + Clarity (contracts, devnet, TS tests)
- TurboRepo (task orchestration, caching)
- Vitest (unit tests in JS/TS)

### Contracts Integration Architecture

- RATHER Token (SIP-010 + Strategy):
  - Fee-on-transfer (10%) accrues to on-chain treasury.
  - Strategy methods trigger marketplace and pool interactions; on sale, principal is swapped to RATHER and burned; treasury remains.
- Marketplace (STX-only):
  - Lists and sells NFTs; exposes floor price query.
- Pool (mock Bitflow):
  - XYK price curve for STX <-> RATHER; no protocol fee logic—token transfer enforces fees.
- Collection (SIP-009):
  - ~100 NFTs with standard ownership/transfer.
- Frontend:
  - Reads floor, triggers buy/relist, shows treasury/holdings/sales; listens to printed events.

### Project Structure

At a glance (monorepo):

- `package.json` — workspaces and turbo scripts
- `clarity/` — Clarity workspace (contracts, tests) [if present]
- `front-end/` — Next.js app (Stacks.js)
- `contracts/` — current Clarity contracts (mocks/placeholders; registered in `Clarinet.toml`)
- `Clarinet.toml` — Clarinet project registry
- `tests/` — Clarinet TS tests
- `turbo.json` — Turbo pipeline config (if/when added)

Notes:

- The current frontend is a baseline and will be refactored to match the required flows.
- Current contracts are mocks; implement incrementally with tests.

### Key Architecture Patterns

- Fee-on-transfer at token layer guarantees global fee capture across venues.
- Event-driven flows: contracts `print` structured events that the frontend/executor consumes.
- Separation of concerns: Marketplace lists/prices, Pool swaps, Token collects fees, Strategy orchestrates.
- Traits/interfaces for loose coupling between contracts.
- Monorepo with Turbo: fast inner loops using filtered runs and cache reuse.

## Delivery priorities (clarity first, then frontend)

1. SIP-010 + Strategy (single contract)

- Token: RATHER (SIP-010). Decimals 6.
- Strategy logic lives in the same contract.
- Fees: Collect 10% via token-level fee-on-transfer into a treasury balance (enforced in the RATHER token `transfer`). This guarantees fees no matter which market executes the trade.
- State: store NFT collection principal.
- Floor buy: buy lowest-priced NFT from marketplace.
- Relist: re-list last purchased NFT at 1.2x the buy price.
- On sale: use sale proceeds to buy RATHER and burn; do NOT burn treasury—only principal portion (sale proceeds minus treasury accruals) should be burned.
- Expose `get-treasury-balance` (read-only) and any minimal helpers (e.g., `get-last-purchase-price`).

2. Liquidity Pool (mock DEX)

- Implement a simple XYK pool for STX <-> RATHER swaps (mimic Bitflow for dev).
- Expose `swap-stx-for-rather(amount-in, min-out)` and `get-quote-stx-for-rather(amount-in)`.
- Do NOT collect protocol fees here; token-level fee-on-transfer collects automatically when the pool calls the token `transfer`.

3. NFT Marketplace (basic)

- STX-only purchases.
- Listing struct with price.
- Read-only floor price search for a given collection.
- Endpoints needed by Strategy: list, buy, fetch floor token-id and price.

4. NFT Collection (SIP-009)

- 100-ish NFTs.
- Standard SIP-009 functions: owner-of, transfer, token-uri, etc.

5. Frontend (Next.js + Stacks.js)

- Replace placeholder UI with:
  - Floor price fetch + token-id display.
  - “Buy floor NFT” executes Strategy’s floor purchase.
  - “Relist last NFT” executes Strategy’s relist at 1.2x.
  - Show treasury balance, current holdings, and sold NFTs.
- Keep wallet connect, network switch, and tx broadcasting via Stacks.js.

## Clarity contracts: suggested interfaces

Single contract “RATHER + Strategy” (merge SIP-010 and strategy):

- Token (SIP-010 core):
  - `transfer(amount, sender, recipient) -> (response bool uint)`
  - `get-balance(who) -> (response uint uint)`
  - `get-total-supply() -> (response uint uint)`
  - Fee-on-transfer rules (implemented in `transfer`):
    - `fee-bps` (default 1000 = 10%).
    - On transfer: take `fee = amount * fee-bps / 10000` to treasury; send `amount - fee` to recipient.
    - Exemptions: treasury, burn address, and optional strategy/owner operations to avoid recursive fees (document in code).
  - Admin:
    - `set-fee-bps(bps) -> (response bool uint)` with sane bounds, `set-treasury(principal)`, `set-exempt(principal, bool)`.
- Admin:
  - `set-nft-collection(nft: principal) -> (response bool uint)`
  - `set-pool(pool: principal) -> (response bool uint)`
- Strategy:
  - `get-treasury-balance() -> (response uint uint)`
  - `get-last-purchase() -> (response {token-id: uint, price: uint} uint)`
  - `buy-floor() -> (response {token-id: uint, price: uint} uint)`
  - `relist-last() -> (response {token-id: uint, price: uint} uint)` (price = 1.2x last buy)
  - `process-sale() -> (response uint uint)`
    - Computes principal vs treasury; swaps principal STX -> RATHER via pool; burns RATHER; keeps treasury.

Mock DEX pool (separate contract):

- `swap-stx-for-rather(amount-in, min-out, recipient) -> (response uint uint)`
- `get-quote-stx-for-rather(amount-in) -> (response uint uint)`
- Keep simple XYK math with a fee parameter; route 10% to strategy treasury (or return to caller and let strategy accrue it).

Marketplace (separate contract):

- `list(token-id, price) -> (response bool uint)`
- `buy(token-id) -> (response bool uint)` (STX-only)
- `get-floor(collection) -> (response {token-id: uint, price: uint} uint)`

Collection (SIP-009):

- Standard SIP-009 trait and base methods. Pre-mint ~100 NFTs to the deployer.

Events/logging:

- Use `(print {...})` for events; index by front-end.

## Coding workflow (vibe coding loop)

1. Read and restate requirements → write a visible checklist (keep it updated).
2. Make the smallest viable code change; preserve public APIs.
3. Run fast checks locally:
   - Clarinet compile: “check contracts” task
   - Unit tests: `npm test`
4. If you touch public behavior, add/update tests in `tests/`.
5. Commit small, focused diffs. Include a one-line summary and what you verified.

## Minimal acceptance checks per component

- Strategy + Token

  - `get-treasury-balance` returns non-decreasing value across swaps.
  - `buy-floor` purchases the current marketplace floor token.
  - `relist-last` posts a listing at exactly 1.2x the last purchase price.
  - `process-sale` buys RATHER with principal portion and burns it; treasury stays intact.

- Pool

  - Reserves update correctly; quotes are monotonic.
  - Slippage respected via `min-out`.

- Marketplace

  - `get-floor` returns the lowest listed price and token-id.
  - `buy` transfers NFT and STX, de-lists the item.

- Collection

  - SIP-009 conformance for transfers; ~100 tokens minted.

- Frontend
  - Shows floor: token-id + price.
  - Buttons run strategy flows and show tx feedback.
  - Displays treasury, holdings, and sold NFTs.

## Quality gates

- Build: Clarinet “check contracts” must pass.
- Tests: Add a basic happy path + 1 edge test per contract as behavior lands.
- Lint/typecheck: Keep TypeScript clean (frontend/tests).
- Smoke: One local run of the core flow end-to-end in devnet.

## How to run

Contracts

- Compile: use VS Code task “check contracts” (runs `clarinet check`).
- Test: `npm test` (Clarinet TS tests in `./tests`).

Frontend

- Start Next.js dev server; ensure Stacks network envs are set (testnet/devnet). Use Stacks.js for wallet connect and contract calls.

## Notes on current state

- Frontend is a baseline from another project—keep only what’s useful (Stacks.js glue), and incrementally replace the pages/components with our features.
- Clarity contracts in `contracts/` are currently mocks. Implement the real behavior per this guide, one endpoint at a time, landing tests alongside.

## Global fee capture design (IMPORTANT)

- Rationale: to guarantee fees across any market, collect fees in the RATHER token contract’s `transfer` entrypoint (fee-on-transfer). Any DEX/marketplace must call this to move tokens; thus fees are captured globally.
- The pool and marketplace do not need to implement fee logic. They just transfer tokens; the token contract enforces the fee.
- Tests must verify fee accrual for: direct wallet transfers, swaps via pool, marketplace sales. Include exempt address tests.

## Small roadmap (suggested order)

1. Implement Marketplace (list/buy + floor) and Collection (SIP-009 + mint 100).
2. Implement mock Pool (STX -> RATHER) with fee path to Strategy.
3. Implement RATHER+Strategy contract (SIP-010 + strategy ops + treasury) and integrate with Marketplace/Pool.
4. Wire Frontend: floor display, buy/relist, treasury/holdings views.
5. Add refinements (slippage controls, events, better tests).

---

## Frontend Development Guide: Stacks.js Integration & Best Practices

This section provides comprehensive patterns for building the frontend with Stacks.js, focusing on contract interactions, wallet management, and production-ready UX.

### Table of Contents
- [Stacks.js Architecture](#stacksjs-architecture)
- [Contract Interaction Patterns](#contract-interaction-patterns)
- [Wallet Management](#wallet-management)
- [Post-Conditions & Security](#post-conditions--security)
- [Read-Only Function Calls](#read-only-function-calls)
- [Event Handling & State Management](#event-handling--state-management)
- [Error Handling & UX](#error-handling--ux)
- [Testing Strategies](#testing-strategies)
- [Performance Optimization](#performance-optimization)

---

### Stacks.js Architecture

The frontend uses a layered architecture to interact with Stacks blockchain:

```
User Interface (React Components)
        ↓
Custom Hooks (useNftHoldings, useContractCall)
        ↓
Operations Layer (lib/marketplace/operations.ts)
        ↓
Contract Utils (executeContractCall, openContractCall)
        ↓
Stacks.js (@stacks/transactions, @stacks/connect)
        ↓
Stacks Blockchain (Devnet/Testnet/Mainnet)
```

**Key Libraries**:
- `@stacks/transactions`: CV encoding/decoding, transaction building
- `@stacks/connect`: Wallet connection (Hiro, Leather, Xverse)
- `@stacks/network`: Network configuration (mainnet, testnet, custom)
- `@hiro-so/api`: Stacks API client for read operations

**Directory structure best practices**:
```
src/
├── constants/
│   ├── contracts.ts       # Contract addresses and deployment configs
│   └── devnet.ts          # Devnet-specific configuration
├── lib/
│   ├── marketplace/
│   │   └── operations.ts  # Marketplace contract calls
│   ├── strategy/
│   │   └── operations.ts  # Strategy contract calls (TO BE ADDED)
│   ├── pool/
│   │   └── operations.ts  # Liquidity pool calls (TO BE ADDED)
│   ├── contract-utils.ts  # Generic contract call execution
│   ├── stacks-api.ts      # API client wrapper
│   └── network.ts         # Network utilities
├── hooks/
│   ├── useContractCall.ts # Generic contract call hook
│   ├── useReadOnly.ts     # Read-only function hook
│   └── useNftHoldings.ts  # NFT balance fetching
└── components/
    ├── strategy/          # Strategy UI components (TO BE ADDED)
    └── marketplace/       # Marketplace components
```

---

### Contract Interaction Patterns

#### 1. Write Operations (Contract Calls)

**Pattern**: Use `ContractCallRegularOptions` from `@stacks/connect` for all write operations.

**Example: Strategy Buy Floor NFT**
```typescript
// lib/strategy/operations.ts
import {
  ContractCallRegularOptions,
  PostConditionMode,
  uintCV,
  Pc, Cl
} from '@stacks/transactions';
import { getStrategyContract } from '@/constants/contracts';
import { Network } from '@/lib/network';

export const buyFloorNft = (
  network: Network,
  sender: string
): ContractCallRegularOptions => {
  const strategyContract = getStrategyContract(network);

  // Post-condition: Strategy contract will receive STX from fee balance
  // and receive NFT from marketplace
  const nftCondition = Pc.principal(
    `${strategyContract.contractAddress}.nft-marketplace`
  )
    .willSendAsset()
    .nft(
      `${strategyContract.contractAddress}.funny-dog::funny-dog`,
      // We don't know the exact token-id, so we use generic condition
    );

  return {
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny, // ALWAYS use Deny in production
    ...strategyContract,
    functionName: 'buy-floor',
    functionArgs: [], // No args needed if marketplace is hardcoded
    postConditions: [nftCondition],
  };
};
```

**Key principles**:
- **Always** use `PostConditionMode.Deny` in production (only Allow in devnet for rapid testing)
- **Always** specify post-conditions for asset transfers (STX, NFT, FT)
- **Never** hardcode contract addresses; use network-based lookup from constants
- **Validate** function arguments before creating CVs
- **Use** type-safe CV constructors: `uintCV`, `stringAsciiCV`, `principalCV`, etc.

#### 2. Executing Contract Calls

**Two execution modes** based on environment:

**A. Devnet Mode (Direct Signing)**
```typescript
// lib/contract-utils.ts
export const executeContractCall = async (
  txOptions: ContractCallRegularOptions,
  currentWallet: DevnetWallet | null
): Promise<{ txid: string }> => {
  const wallet = await generateWallet({
    secretKey: currentWallet.mnemonic,
    password: 'password',
  });

  const transaction = await makeContractCall({
    ...txOptions,
    network: DEVNET_NETWORK,
    senderKey: wallet.accounts[0].stxPrivateKey,
    postConditionMode: PostConditionMode.Allow, // Relaxed for devnet
    fee: 1000,
  });

  const response = await broadcastTransaction({
    transaction,
    network: DEVNET_NETWORK,
  });

  if ('error' in response) {
    throw new Error(response.error);
  }

  return { txid: response.txid };
};
```

**B. Wallet Mode (Hiro/Leather/Xverse)**
```typescript
// lib/contract-utils.ts
import { request, TransactionResult } from '@stacks/connect';

export const openContractCall = async (
  options: ContractCallRegularOptions
): Promise<TransactionResult> => {
  const result = await request({}, 'stx_callContract', {
    contract: `${options.contractAddress}.${options.contractName}`,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    network: options.network,
    postConditions: options.postConditions,
    postConditionMode: options.postConditionMode === PostConditionMode.Allow
      ? 'allow'
      : 'deny',
  });

  if (options.onFinish) {
    options.onFinish(result);
  }

  return result;
};
```

**Usage in Component**:
```typescript
// components/strategy/BuyFloorButton.tsx
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { useNetwork } from '@/lib/use-network';
import { buyFloorNft } from '@/lib/strategy/operations';
import { executeContractCall, openContractCall } from '@/lib/contract-utils';

const BuyFloorButton = () => {
  const { currentWallet } = useDevnetWallet();
  const network = useNetwork();
  const [loading, setLoading] = useState(false);

  const handleBuyFloor = async () => {
    if (!network || !currentWallet) return;

    setLoading(true);
    try {
      const txOptions = buyFloorNft(network, currentWallet.stxAddress);

      // Use direct call in devnet, wallet popup otherwise
      const result = isDevnetEnvironment()
        ? await executeContractCall(txOptions, currentWallet)
        : await openContractCall(txOptions);

      console.log('Transaction ID:', result.txid);
      // TODO: Poll for transaction confirmation
    } catch (error) {
      console.error('Failed to buy floor NFT:', error);
      // TODO: Show user-friendly error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleBuyFloor} isLoading={loading}>
      Buy Floor NFT
    </Button>
  );
};
```

---

### Post-Conditions & Security

Post-conditions are **critical security features** that prevent unexpected asset transfers. They act as client-side assertions about what a transaction will do.

**Golden rules**:
1. **Always** use `PostConditionMode.Deny` in production
2. **Always** add post-conditions for ANY asset transfer (STX, NFT, FT)
3. **Test** post-conditions by intentionally creating mismatches
4. **Prefer** specific amounts over ranges when possible

**Post-condition types**:

```typescript
import { Pc, Cl } from '@stacks/transactions';

// STX transfers
const stxCondition = Pc.principal(sender)
  .willSendEq(1000000) // Exact amount in microSTX
  .ustx();

// NFT transfers
const nftCondition = Pc.principal(sender)
  .willSendAsset()
  .nft(
    `${contractAddress}.${contractName}::${assetName}`,
    Cl.uint(tokenId)
  );

// Fungible token transfers
const ftCondition = Pc.principal(sender)
  .willSendLte(5000000) // Less than or equal to amount
  .ft(
    `${contractAddress}.${contractName}::${tokenName}`,
    Cl.uint(5000000)
  );

// Multiple conditions
const postConditions = [stxCondition, nftCondition, ftCondition];
```

**Complex example: NFT Marketplace Purchase**
```typescript
// User buys NFT with STX
export const purchaseListingStx = (
  network: Network,
  currentAddress: string,
  listing: Listing
): ContractCallRegularOptions => {
  const marketplaceContract = getMarketplaceContract(network);
  const [contractAddress, contractName] = listing.nftAssetContract.split('.');

  // Buyer sends STX to seller
  const stxCondition = Pc.principal(currentAddress)
    .willSendEq(listing.price)
    .ustx();

  // Marketplace sends NFT to buyer
  const nftCondition = Pc.principal(
    `${marketplaceContract.contractAddress}.${marketplaceContract.contractName}`
  )
    .willSendAsset()
    .nft(
      `${contractAddress}.${contractName}::${contractName}`,
      Cl.uint(listing.tokenId)
    );

  return {
    network,
    ...marketplaceContract,
    functionName: 'fulfill-listing-stx',
    functionArgs: [
      uintCV(listing.id),
      contractPrincipalCV(contractAddress, contractName)
    ],
    postConditions: [stxCondition, nftCondition],
    postConditionMode: PostConditionMode.Deny,
  };
};
```

**Testing post-conditions**:
```typescript
// In Clarinet tests or integration tests
it('should fail if post-condition mismatches', async () => {
  const wrongPrice = 999999; // Different from actual price
  const stxCondition = Pc.principal(buyer).willSendEq(wrongPrice).ustx();

  await expect(
    executeContractCall({
      ...txOptions,
      postConditions: [stxCondition],
      postConditionMode: PostConditionMode.Deny,
    })
  ).rejects.toThrow('Post-condition check failed');
});
```

---

### Read-Only Function Calls

Read-only calls fetch data from contracts without broadcasting transactions. They're free and instant.

**Pattern**: Use Stacks API's `callReadOnlyFunction`

```typescript
// lib/strategy/operations.ts
import { getApi } from '@/lib/stacks-api';
import { serializeCV, deserializeCV, uintCV, cvToValue } from '@stacks/transactions';

export const getTreasuryBalance = async (
  network: Network
): Promise<number> => {
  const api = getApi(network).smartContractsApi;
  const strategyContract = getStrategyContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      contractAddress: strategyContract.contractAddress,
      contractName: strategyContract.contractName,
      functionName: 'get-treasury-balance',
      readOnlyFunctionArgs: {
        sender: strategyContract.contractAddress,
        arguments: [], // No args for this function
      },
    });

    // Parse response
    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue) return 0;

    // Extract uint from (ok uint) response
    if (clarityValue.type === 'response-ok') {
      return Number(cvToValue(clarityValue.value));
    }

    return 0;
  } catch (error) {
    console.error('Failed to fetch treasury balance:', error);
    return 0;
  }
};

// Helper to parse read-only responses
const parseReadOnlyResponse = ({ result }: { result?: string }) => {
  if (!result) return undefined;
  const hex = result.slice(2); // Remove '0x' prefix
  const buffer = Buffer.from(hex, 'hex');
  return deserializeCV(buffer);
};
```

**Custom hook for read-only calls**:
```typescript
// hooks/useReadOnly.ts
import { useState, useEffect } from 'react';
import { Network } from '@/lib/network';

export const useReadOnly = <T>(
  fetchFn: (network: Network) => Promise<T>,
  network: Network | null,
  refreshInterval?: number
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!network) return;

    const fetch = async () => {
      try {
        setLoading(true);
        const result = await fetchFn(network);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetch();

    if (refreshInterval) {
      const interval = setInterval(fetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [network, refreshInterval]);

  return { data, loading, error, refetch: () => fetchFn(network!) };
};
```

**Usage in component**:
```typescript
// components/strategy/TreasuryDisplay.tsx
import { useReadOnly } from '@/hooks/useReadOnly';
import { getTreasuryBalance } from '@/lib/strategy/operations';
import { useNetwork } from '@/lib/use-network';

const TreasuryDisplay = () => {
  const network = useNetwork();
  const { data: balance, loading } = useReadOnly(
    getTreasuryBalance,
    network,
    10000 // Refresh every 10 seconds
  );

  if (loading) return <Spinner />;

  return (
    <Box>
      <Text>Treasury Balance</Text>
      <Text fontSize="2xl">{(balance || 0) / 1_000_000} STX</Text>
    </Box>
  );
};
```

**Fetching marketplace floor**:
```typescript
// lib/marketplace/operations.ts
export const getFloorPrice = async (
  network: Network,
  collectionContract: string
): Promise<{ tokenId: number; price: number } | null> => {
  const api = getApi(network).smartContractsApi;
  const marketplaceContract = getMarketplaceContract(network);

  // Assuming marketplace has get-floor function
  const response = await api.callReadOnlyFunction({
    ...marketplaceContract,
    functionName: 'get-floor',
    readOnlyFunctionArgs: {
      sender: marketplaceContract.contractAddress,
      arguments: [
        `0x${serializeCV(contractPrincipalCV(...collectionContract.split('.'))).toString()}`
      ],
    },
  });

  const clarityValue = parseReadOnlyResponse(response);
  if (!clarityValue || clarityValue.type !== 'response-ok') return null;

  // Parse tuple { token-id: uint, price: uint }
  const tuple = clarityValue.value;
  return {
    tokenId: Number(cvToValue(tuple.data['token-id'])),
    price: Number(cvToValue(tuple.data.price)),
  };
};
```

---

### Event Handling & State Management

Clarity contracts emit events via `(print {...})`. Frontend should listen and react to these events.

**Pattern 1: Polling transaction status**
```typescript
// lib/transaction-utils.ts
import { getApi } from './stacks-api';
import { Network } from './network';

export const waitForTransaction = async (
  txid: string,
  network: Network,
  maxAttempts = 30,
  interval = 2000
): Promise<'success' | 'failed' | 'timeout'> => {
  const api = getApi(network).transactionsApi;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await api.getTransactionById({ txId: txid });

      if (tx.tx_status === 'success') {
        return 'success';
      }
      if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') {
        return 'failed';
      }
    } catch (error) {
      // Transaction not yet in mempool/chain
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return 'timeout';
};
```

**Pattern 2: Extract events from transaction**
```typescript
// lib/transaction-utils.ts
export const extractTransactionEvents = async (
  txid: string,
  network: Network
): Promise<any[]> => {
  const api = getApi(network).transactionsApi;

  try {
    const tx = await api.getTransactionById({ txId: txid });

    if (tx.tx_type !== 'contract_call') return [];

    // Filter print events
    return tx.events
      .filter(event => event.event_type === 'smart_contract_log')
      .map(event => {
        try {
          // Parse Clarity value from hex
          const clarityValue = deserializeCV(
            Buffer.from(event.contract_log.value.hex.slice(2), 'hex')
          );
          return cvToValue(clarityValue);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to extract events:', error);
    return [];
  }
};
```

**Usage: Track swap events**
```typescript
// components/strategy/BurnButton.tsx
const handleBurn = async () => {
  try {
    const result = await executeContractCall(burnTxOptions, currentWallet);

    // Wait for confirmation
    const status = await waitForTransaction(result.txid, network);

    if (status === 'success') {
      // Extract events
      const events = await extractTransactionEvents(result.txid, network);
      const swapEvent = events.find(e => e.event === 'swap');

      if (swapEvent) {
        console.log('Swapped:', swapEvent.ratherOut, 'RATHER tokens');
        // Update UI with burn amount
      }
    }
  } catch (error) {
    console.error('Burn failed:', error);
  }
};
```

**Pattern 3: Real-time updates with WebSockets** (advanced)
```typescript
// lib/stacks-websocket.ts
import { io, Socket } from 'socket.io-client';

export class StacksWebSocket {
  private socket: Socket;

  constructor(apiUrl: string) {
    this.socket = io(apiUrl);
  }

  subscribeToAddress(address: string, callback: (tx: any) => void) {
    this.socket.emit('subscribe', { address });
    this.socket.on('transaction', callback);
  }

  unsubscribe() {
    this.socket.disconnect();
  }
}

// Usage in component
useEffect(() => {
  const ws = new StacksWebSocket(network.getCoreApiUrl());

  ws.subscribeToAddress(strategyContractAddress, (tx) => {
    if (tx.tx_status === 'success') {
      // Refresh treasury balance, holdings, etc.
      refetchTreasury();
    }
  });

  return () => ws.unsubscribe();
}, [network, strategyContractAddress]);
```

---

### Error Handling & UX

**Error types in Stacks.js**:
1. **Network errors**: API unavailable, timeout
2. **Wallet errors**: User rejection, insufficient balance
3. **Contract errors**: Function throws error, post-condition failure
4. **Parsing errors**: Invalid Clarity value format

**Comprehensive error handling**:
```typescript
// lib/error-utils.ts
export class ContractCallError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ContractCallError';
  }
}

export const handleContractCallError = (error: unknown): ContractCallError => {
  if (error instanceof Error) {
    // User rejected transaction
    if (error.message.includes('cancelled') || error.message.includes('rejected')) {
      return new ContractCallError(
        'Transaction was cancelled',
        'USER_REJECTED',
        error
      );
    }

    // Insufficient balance
    if (error.message.includes('insufficient balance')) {
      return new ContractCallError(
        'Insufficient STX balance',
        'INSUFFICIENT_BALANCE',
        error
      );
    }

    // Post-condition failure
    if (error.message.includes('post-condition')) {
      return new ContractCallError(
        'Transaction safety check failed. Please try again.',
        'POST_CONDITION_FAILED',
        error
      );
    }

    // Contract error (e.g., ERR_INSUFFICIENT_BAL from Clarity)
    if (error.message.includes('err ')) {
      const errCode = error.message.match(/err u(\d+)/)?.[1];
      return new ContractCallError(
        `Contract error: ${errCode}`,
        'CONTRACT_ERROR',
        error
      );
    }
  }

  return new ContractCallError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    error
  );
};
```

**User-friendly error messages**:
```typescript
// constants/error-messages.ts
export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // Strategy errors
  'u200': 'Only contract owner can perform this action',
  'u201': 'You do not own this token',
  'u202': 'Insufficient balance for this operation',
  'u203': 'Invalid amount specified',

  // Marketplace errors
  'u2000': 'Listing not found',
  'u2001': 'You are not authorized to cancel this listing',
  'u2002': 'NFT contract mismatch',
  'u2003': 'Cannot buy your own listing',
};

export const getErrorMessage = (error: ContractCallError): string => {
  if (error.code === 'CONTRACT_ERROR') {
    const errCode = error.message.match(/u(\d+)/)?.[0];
    return CONTRACT_ERROR_MESSAGES[errCode] || error.message;
  }

  return error.message;
};
```

**React error boundary for contract calls**:
```typescript
// hooks/useContractCall.ts
import { useState } from 'react';
import { ContractCallRegularOptions } from '@stacks/connect';
import { handleContractCallError, getErrorMessage } from '@/lib/error-utils';

export const useContractCall = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const execute = async (
    txOptions: ContractCallRegularOptions,
    currentWallet: DevnetWallet | null
  ) => {
    setLoading(true);
    setError(null);
    setTxid(null);

    try {
      const result = isDevnetEnvironment()
        ? await executeContractCall(txOptions, currentWallet)
        : await openContractCall(txOptions);

      setTxid(result.txid);
      return result;
    } catch (err) {
      const contractError = handleContractCallError(err);
      const userMessage = getErrorMessage(contractError);
      setError(userMessage);
      throw contractError;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error, txid };
};
```

**Usage with toast notifications**:
```typescript
// components/strategy/BuyFloorButton.tsx
import { useToast } from '@chakra-ui/react';
import { useContractCall } from '@/hooks/useContractCall';

const BuyFloorButton = () => {
  const toast = useToast();
  const { execute, loading, error } = useContractCall();
  const { currentWallet } = useDevnetWallet();
  const network = useNetwork();

  const handleClick = async () => {
    try {
      const txOptions = buyFloorNft(network, currentWallet.stxAddress);
      const result = await execute(txOptions, currentWallet);

      toast({
        title: 'Transaction submitted',
        description: `Transaction ID: ${result.txid}`,
        status: 'success',
        duration: 5000,
      });

      // Wait for confirmation
      const status = await waitForTransaction(result.txid, network);

      if (status === 'success') {
        toast({
          title: 'NFT purchased successfully!',
          status: 'success',
        });
      } else {
        toast({
          title: 'Transaction failed',
          description: 'Please check the explorer for details',
          status: 'error',
        });
      }
    } catch (err) {
      // Error already set by useContractCall
      toast({
        title: 'Transaction failed',
        description: error,
        status: 'error',
        duration: 7000,
      });
    }
  };

  return (
    <Button onClick={handleClick} isLoading={loading}>
      Buy Floor NFT
    </Button>
  );
};
```

---

### Wallet Management

**Devnet wallet provider** (already implemented in `/lib/devnet-wallet-context.ts`):
```typescript
// Provides pre-funded devnet wallets for testing
const DEVNET_WALLETS = [
  {
    mnemonic: 'twice kind fence...',
    stxAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    btcAddress: '...',
  },
  // ... more wallets
];

export const useDevnetWallet = () => {
  const [currentWallet, setCurrentWallet] = useState(DEVNET_WALLETS[0]);

  return { currentWallet, setCurrentWallet, allWallets: DEVNET_WALLETS };
};
```

**Production wallet connection**:
```typescript
// components/ConnectWallet.tsx
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { useState, useEffect } from 'react';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export const useWallet = () => {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then(data => {
        setUserData(data);
      });
    } else if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
  }, []);

  const connect = () => {
    showConnect({
      appDetails: {
        name: 'RATHER Strategy',
        icon: '/logo.png',
      },
      onFinish: () => {
        setUserData(userSession.loadUserData());
      },
      userSession,
    });
  };

  const disconnect = () => {
    userSession.signUserOut();
    setUserData(null);
  };

  return {
    isConnected: !!userData,
    address: userData?.profile?.stxAddress?.mainnet,
    connect,
    disconnect,
  };
};
```

---

### Testing Strategies

**1. Clarinet TS Tests** (for contract logic)
```typescript
// clarity/tests/strategy-token.test.ts
import { Clarinet, Tx, Chain, Account } from '@hirosystems/clarinet-sdk';

Clarinet.test({
  name: 'Strategy contract can buy floor NFT',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const buyer = accounts.get('wallet_1')!;

    // Setup: List NFT
    let block = chain.mineBlock([
      Tx.contractCall(
        'nft-marketplace',
        'list-asset',
        [/* args */],
        buyer.address
      ),
    ]);
    block.receipts[0].result.expectOk();

    // Test: Buy floor
    block = chain.mineBlock([
      Tx.contractCall(
        'strategy-token',
        'buy-floor',
        [],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectOk();

    // Verify NFT transferred
    const nftOwner = chain.callReadOnlyFn(
      'funny-dog',
      'get-owner',
      [types.uint(1)],
      deployer.address
    );
    nftOwner.result.expectSome().expectPrincipal(deployer.address);
  },
});
```

**2. Frontend Unit Tests** (Vitest)
```typescript
// lib/marketplace/operations.test.ts
import { describe, it, expect } from 'vitest';
import { listAsset } from './operations';
import { DEVNET_NETWORK } from '@/constants/devnet';

describe('listAsset', () => {
  it('should create correct contract call options', () => {
    const params = {
      sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      nftContractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      nftContractName: 'funny-dog',
      tokenId: 5,
      price: 1000000,
      expiry: 100,
    };

    const result = listAsset(DEVNET_NETWORK, params);

    expect(result.contractName).toBe('nft-marketplace');
    expect(result.functionName).toBe('list-asset');
    expect(result.functionArgs).toHaveLength(2);
    expect(result.postConditions).toHaveLength(1);
  });
});
```

**3. Integration Tests** (Playwright or Cypress)
```typescript
// e2e/strategy.spec.ts
import { test, expect } from '@playwright/test';

test('User can buy floor NFT via strategy', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Connect devnet wallet
  await page.click('[data-testid="connect-wallet"]');
  await page.click('[data-testid="devnet-wallet-1"]');

  // Navigate to strategy page
  await page.goto('/strategy');

  // Check floor price displayed
  await expect(page.locator('[data-testid="floor-price"]')).toContainText('1.0 STX');

  // Buy floor
  await page.click('[data-testid="buy-floor-button"]');

  // Wait for transaction confirmation
  await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({
    timeout: 30000,
  });

  // Verify NFT appears in holdings
  await expect(page.locator('[data-testid="holdings"]')).toContainText('Token #1');
});
```

---

### Performance Optimization

**1. Batch read-only calls**
```typescript
// lib/batch-read.ts
export const batchReadOnlyCalls = async <T>(
  calls: Array<() => Promise<T>>,
  batchSize = 5
): Promise<T[]> => {
  const results: T[] = [];

  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }

  return results;
};

// Usage: Fetch multiple listings
const listingIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const listings = await batchReadOnlyCalls(
  listingIds.map(id => () => fetchListing(network, id)),
  3 // Fetch 3 at a time to avoid rate limits
);
```

**2. Cache read-only results**
```typescript
// lib/cache.ts
const cache = new Map<string, { data: any; timestamp: number }>();

export const cachedReadOnly = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl = 10000 // 10 seconds
): Promise<T> => {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Usage
const balance = await cachedReadOnly(
  `treasury-balance-${network.chainId}`,
  () => getTreasuryBalance(network),
  15000 // Cache for 15 seconds
);
```

**3. Debounce rapid calls**
```typescript
// hooks/useDebouncedReadOnly.ts
import { useState, useEffect } from 'react';
import { debounce } from 'lodash';

export const useDebouncedReadOnly = <T>(
  fetchFn: () => Promise<T>,
  delay = 500
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const debouncedFetch = debounce(async () => {
    setLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, delay);

  useEffect(() => {
    debouncedFetch();
    return () => debouncedFetch.cancel();
  }, []);

  return { data, loading };
};
```

**4. Lazy load components**
```typescript
// app/strategy/page.tsx
import dynamic from 'next/dynamic';

const TreasuryDashboard = dynamic(() => import('@/components/strategy/TreasuryDashboard'), {
  loading: () => <Spinner />,
  ssr: false, // Disable SSR for wallet-dependent components
});

export default function StrategyPage() {
  return (
    <Container>
      <Suspense fallback={<Spinner />}>
        <TreasuryDashboard />
      </Suspense>
    </Container>
  );
}
```

---

### Implementation Checklist for Strategy Frontend

Use this checklist when implementing the strategy frontend:

**Phase 1: Contract Operations Layer**
- [ ] Create `lib/strategy/operations.ts`
  - [ ] `buyFloorNft()` - Contract call builder
  - [ ] `relistLastNft()` - Contract call builder
  - [ ] `burnTokens()` - Contract call builder
  - [ ] `getTreasuryBalance()` - Read-only call
  - [ ] `getLastPurchase()` - Read-only call
  - [ ] `getFloorPrice()` - Marketplace read-only call

**Phase 2: Custom Hooks**
- [ ] `hooks/useStrategy.ts` - Strategy state management
- [ ] `hooks/useTreasuryBalance.ts` - Treasury polling
- [ ] `hooks/useFloorPrice.ts` - Floor price polling
- [ ] `hooks/useStrategyHoldings.ts` - NFT holdings for strategy contract

**Phase 3: UI Components**
- [ ] `components/strategy/BuyFloorButton.tsx`
- [ ] `components/strategy/RelistButton.tsx`
- [ ] `components/strategy/BurnButton.tsx`
- [ ] `components/strategy/TreasuryDisplay.tsx`
- [ ] `components/strategy/FloorPriceCard.tsx`
- [ ] `components/strategy/HoldingsGrid.tsx`
- [ ] `components/strategy/TransactionHistory.tsx`

**Phase 4: Pages**
- [ ] `app/strategy/page.tsx` - Main strategy dashboard
- [ ] Add navigation link to strategy page

**Phase 5: Testing**
- [ ] Unit tests for operation builders
- [ ] Integration tests for contract calls in devnet
- [ ] E2E tests for user flows

**Phase 6: Error Handling**
- [ ] Add contract error codes to `constants/error-messages.ts`
- [ ] Implement toast notifications for all operations
- [ ] Add loading states and skeletons

---

## References & Resources

### Official Stacks Documentation
- [Stacks.js Documentation](https://docs.stacks.co/docs/stacks.js)
- [Clarity Language Reference](https://docs.stacks.co/docs/clarity)
- [SIP-009 NFT Standard](https://github.com/stacksgov/sips/blob/main/sips/sip-009/sip-009-nft-standard.md)
- [SIP-010 Fungible Token Standard](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md)

### Stacks.js Packages
- [@stacks/transactions](https://github.com/hirosystems/stacks.js/tree/main/packages/transactions)
- [@stacks/connect](https://github.com/hirosystems/connect)
- [@stacks/network](https://github.com/hirosystems/stacks.js/tree/main/packages/network)

### Tools
- [Hiro Platform](https://platform.hiro.so) - Devnet and deployment
- [Clarinet](https://github.com/hirosystems/clarinet) - Local development
- [Stacks Explorer](https://explorer.hiro.so) - Transaction inspection

### Example Projects
- [Stacks NFT Example](https://github.com/hirosystems/stacks-nft-example)
- [Bitcoin NFTs](https://github.com/hirosystems/bitcoin-nfts)
