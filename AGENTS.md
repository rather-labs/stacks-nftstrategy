# AGENTS.md

Quick orientation for AI coding agents or new contributors.

## Current stack

- **Front-end** (`front-end/`)
  - Next.js 14 (App Router) with Chakra UI theming.
  - Screens: landing, strategy dashboard, marketplace, liquidity metrics, admin utilities.
  - Marketplace/holdings imagery resolved through SIP-009 token URIs.
  - Testnet admin access is restricted to the deployer principal (navbar link + page gate).
  - Wallet UX supports browser wallets via Stacks Connect and a devnet seed switcher.

- **Clarity contracts** (`clarity/contracts/`)
  - `funny-dog.clar`: SIP-009 NFT collection with sequential minting and Placedog metadata.
  - `nft-marketplace.clar`: STX-based listings (list, cancel, fulfill).
  - `strategy-token.clar`: SIP-010 token (RATHER) with treasury bookkeeping, buy/relist helper, burn routine, and fee accrual from swaps.
  - `liquidity-pool.clar`: XYK pool for STX⇄RATHER, forwards swap fees to the strategy token.
  - `traits/liquidity-pool-trait.clar`: shared trait for the pool interface.

- **Documentation**
  - Root guide: [`README.md`](README.md)
  - UI details: [`front-end/README.md`](front-end/README.md)
  - Contract details: [`clarity/README.md`](clarity/README.md)

## Essential commands

| Target        | Command(s)                                                                            |
| ------------- | ------------------------------------------------------------------------------------- |
| Install deps  | `npm install` (root) → `cd clarity && npm install` → `cd ../front-end && npm install` |
| Front-end dev | `cd front-end && npm run dev`                                                         |
| Clarity check | `cd clarity && clarinet check`                                                        |
| Clarity tests | `cd clarity && npm test` (vitest stubs)                                               |
| Next lint     | `cd front-end && npm run lint` (resolve React Hooks infra warnings manually)          |

### Environment variables

Front-end expects an `.env` with at least:

```env
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_TESTNET_DEPLOYER=<principal>
NEXT_PUBLIC_TESTNET_NFT_CONTRACT_NAME=funny-dog
NEXT_PUBLIC_TESTNET_MARKETPLACE_CONTRACT_NAME=nft-marketplace
NEXT_PUBLIC_TESTNET_STRATEGY_CONTRACT_NAME=strategy-token
NEXT_PUBLIC_TESTNET_POOL_CONTRACT_NAME=liquidity-pool
```

Optional helpers:

- `NEXT_PUBLIC_PLATFORM_HIRO_API_KEY` for Hiro devnet RPC access.
- `NEXT_PUBLIC_DEVNET_HOST` to toggle between `platform` and `local` devnet endpoints.

Clarinet deployments read from `clarity/settings/Testnet.toml`; update the mnemonic before committing if you rotate wallets.

### Testnet redeploy loop

1. Pick new contract names in `clarity/deployments/default.testnet-plan.yaml` (Stacks forbids overwriting existing names).
2. `clarinet deployments check -p deployments/default.testnet-plan.yaml`
3. `clarinet deployments apply --testnet -p deployments/default.testnet-plan.yaml`
4. Record the resulting principals and mirror them into the front-end `.env`.
5. Restart the Next.js dev server so it consumes the new env values.

## Working guidelines

- Favour small, reviewable diffs; keep explanatory comments concise and purposeful.
- Run the relevant command (`clarinet check`, `npm run dev`, etc.) before finishing a change.
- Update documentation/diagrams when architecture meaningfully shifts.
- Do not revert user-originated changes unless explicitly told to.
- If unexpected workspace edits appear, pause and ask for direction.

Stay synced with the package READMEs for deeper architecture notes; this file should remain short and accurate.
const response = await broadcastTransaction({
transaction,
network: DEVNET_NETWORK,
});

if ('error' in response) {
throw new Error(response.error);
}

return { txid: response.txid };
};

````

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
````

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
import { Pc, Cl } from "@stacks/transactions";

// STX transfers
const stxCondition = Pc.principal(sender)
  .willSendEq(1000000) // Exact amount in microSTX
  .ustx();

// NFT transfers
const nftCondition = Pc.principal(sender)
  .willSendAsset()
  .nft(`${contractAddress}.${contractName}::${assetName}`, Cl.uint(tokenId));

// Fungible token transfers
const ftCondition = Pc.principal(sender)
  .willSendLte(5000000) // Less than or equal to amount
  .ft(`${contractAddress}.${contractName}::${tokenName}`, Cl.uint(5000000));

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
  const [contractAddress, contractName] = listing.nftAssetContract.split(".");

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
    functionName: "fulfill-listing-stx",
    functionArgs: [
      uintCV(listing.id),
      contractPrincipalCV(contractAddress, contractName),
    ],
    postConditions: [stxCondition, nftCondition],
    postConditionMode: PostConditionMode.Deny,
  };
};
```

**Testing post-conditions**:

```typescript
// In Clarinet tests or integration tests
it("should fail if post-condition mismatches", async () => {
  const wrongPrice = 999999; // Different from actual price
  const stxCondition = Pc.principal(buyer).willSendEq(wrongPrice).ustx();

  await expect(
    executeContractCall({
      ...txOptions,
      postConditions: [stxCondition],
      postConditionMode: PostConditionMode.Deny,
    })
  ).rejects.toThrow("Post-condition check failed");
});
```

---

### Read-Only Function Calls

Read-only calls fetch data from contracts without broadcasting transactions. They're free and instant.

**Pattern**: Use Stacks API's `callReadOnlyFunction`

```typescript
// lib/strategy/operations.ts
import { getApi } from "@/lib/stacks-api";
import {
  serializeCV,
  deserializeCV,
  uintCV,
  cvToValue,
} from "@stacks/transactions";

export const getTreasuryBalance = async (network: Network): Promise<number> => {
  const api = getApi(network).smartContractsApi;
  const strategyContract = getStrategyContract(network);

  try {
    const response = await api.callReadOnlyFunction({
      contractAddress: strategyContract.contractAddress,
      contractName: strategyContract.contractName,
      functionName: "get-treasury-balance",
      readOnlyFunctionArgs: {
        sender: strategyContract.contractAddress,
        arguments: [], // No args for this function
      },
    });

    // Parse response
    const clarityValue = parseReadOnlyResponse(response);
    if (!clarityValue) return 0;

    // Extract uint from (ok uint) response
    if (clarityValue.type === "response-ok") {
      return Number(cvToValue(clarityValue.value));
    }

    return 0;
  } catch (error) {
    console.error("Failed to fetch treasury balance:", error);
    return 0;
  }
};

// Helper to parse read-only responses
const parseReadOnlyResponse = ({ result }: { result?: string }) => {
  if (!result) return undefined;
  const hex = result.slice(2); // Remove '0x' prefix
  const buffer = Buffer.from(hex, "hex");
  return deserializeCV(buffer);
};
```

**Custom hook for read-only calls**:

```typescript
// hooks/useReadOnly.ts
import { useState, useEffect } from "react";
import { Network } from "@/lib/network";

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
    functionName: "get-floor",
    readOnlyFunctionArgs: {
      sender: marketplaceContract.contractAddress,
      arguments: [
        `0x${serializeCV(contractPrincipalCV(...collectionContract.split("."))).toString()}`,
      ],
    },
  });

  const clarityValue = parseReadOnlyResponse(response);
  if (!clarityValue || clarityValue.type !== "response-ok") return null;

  // Parse tuple { token-id: uint, price: uint }
  const tuple = clarityValue.value;
  return {
    tokenId: Number(cvToValue(tuple.data["token-id"])),
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
import { getApi } from "./stacks-api";
import { Network } from "./network";

export const waitForTransaction = async (
  txid: string,
  network: Network,
  maxAttempts = 30,
  interval = 2000
): Promise<"success" | "failed" | "timeout"> => {
  const api = getApi(network).transactionsApi;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await api.getTransactionById({ txId: txid });

      if (tx.tx_status === "success") {
        return "success";
      }
      if (
        tx.tx_status === "abort_by_response" ||
        tx.tx_status === "abort_by_post_condition"
      ) {
        return "failed";
      }
    } catch (error) {
      // Transaction not yet in mempool/chain
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return "timeout";
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

    if (tx.tx_type !== "contract_call") return [];

    // Filter print events
    return tx.events
      .filter((event) => event.event_type === "smart_contract_log")
      .map((event) => {
        try {
          // Parse Clarity value from hex
          const clarityValue = deserializeCV(
            Buffer.from(event.contract_log.value.hex.slice(2), "hex")
          );
          return cvToValue(clarityValue);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error("Failed to extract events:", error);
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

    if (status === "success") {
      // Extract events
      const events = await extractTransactionEvents(result.txid, network);
      const swapEvent = events.find((e) => e.event === "swap");

      if (swapEvent) {
        console.log("Swapped:", swapEvent.ratherOut, "RATHER tokens");
        // Update UI with burn amount
      }
    }
  } catch (error) {
    console.error("Burn failed:", error);
  }
};
```

**Pattern 3: Real-time updates with WebSockets** (advanced)

```typescript
// lib/stacks-websocket.ts
import { io, Socket } from "socket.io-client";

export class StacksWebSocket {
  private socket: Socket;

  constructor(apiUrl: string) {
    this.socket = io(apiUrl);
  }

  subscribeToAddress(address: string, callback: (tx: any) => void) {
    this.socket.emit("subscribe", { address });
    this.socket.on("transaction", callback);
  }

  unsubscribe() {
    this.socket.disconnect();
  }
}

// Usage in component
useEffect(() => {
  const ws = new StacksWebSocket(network.getCoreApiUrl());

  ws.subscribeToAddress(strategyContractAddress, (tx) => {
    if (tx.tx_status === "success") {
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
    this.name = "ContractCallError";
  }
}

export const handleContractCallError = (error: unknown): ContractCallError => {
  if (error instanceof Error) {
    // User rejected transaction
    if (
      error.message.includes("cancelled") ||
      error.message.includes("rejected")
    ) {
      return new ContractCallError(
        "Transaction was cancelled",
        "USER_REJECTED",
        error
      );
    }

    // Insufficient balance
    if (error.message.includes("insufficient balance")) {
      return new ContractCallError(
        "Insufficient STX balance",
        "INSUFFICIENT_BALANCE",
        error
      );
    }

    // Post-condition failure
    if (error.message.includes("post-condition")) {
      return new ContractCallError(
        "Transaction safety check failed. Please try again.",
        "POST_CONDITION_FAILED",
        error
      );
    }

    // Contract error (e.g., ERR_INSUFFICIENT_BAL from Clarity)
    if (error.message.includes("err ")) {
      const errCode = error.message.match(/err u(\d+)/)?.[1];
      return new ContractCallError(
        `Contract error: ${errCode}`,
        "CONTRACT_ERROR",
        error
      );
    }
  }

  return new ContractCallError(
    "An unexpected error occurred",
    "UNKNOWN_ERROR",
    error
  );
};
```

**User-friendly error messages**:

```typescript
// constants/error-messages.ts
export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // Strategy errors
  u200: "Only contract owner can perform this action",
  u201: "You do not own this token",
  u202: "Insufficient balance for this operation",
  u203: "Invalid amount specified",

  // Marketplace errors
  u2000: "Listing not found",
  u2001: "You are not authorized to cancel this listing",
  u2002: "NFT contract mismatch",
  u2003: "Cannot buy your own listing",
};

export const getErrorMessage = (error: ContractCallError): string => {
  if (error.code === "CONTRACT_ERROR") {
    const errCode = error.message.match(/u(\d+)/)?.[0];
    return CONTRACT_ERROR_MESSAGES[errCode] || error.message;
  }

  return error.message;
};
```

**React error boundary for contract calls**:

```typescript
// hooks/useContractCall.ts
import { useState } from "react";
import { ContractCallRegularOptions } from "@stacks/connect";
import { handleContractCallError, getErrorMessage } from "@/lib/error-utils";

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
    mnemonic: "twice kind fence...",
    stxAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    btcAddress: "...",
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
import { AppConfig, UserSession, showConnect } from "@stacks/connect";
import { useState, useEffect } from "react";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

export const useWallet = () => {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((data) => {
        setUserData(data);
      });
    } else if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
  }, []);

  const connect = () => {
    showConnect({
      appDetails: {
        name: "RATHER Strategy",
        icon: "/logo.png",
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
import { Clarinet, Tx, Chain, Account } from "@hirosystems/clarinet-sdk";

Clarinet.test({
  name: "Strategy contract can buy floor NFT",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const buyer = accounts.get("wallet_1")!;

    // Setup: List NFT
    let block = chain.mineBlock([
      Tx.contractCall(
        "nft-marketplace",
        "list-asset",
        [
          /* args */
        ],
        buyer.address
      ),
    ]);
    block.receipts[0].result.expectOk();

    // Test: Buy floor
    block = chain.mineBlock([
      Tx.contractCall("strategy-token", "buy-floor", [], deployer.address),
    ]);

    block.receipts[0].result.expectOk();

    // Verify NFT transferred
    const nftOwner = chain.callReadOnlyFn(
      "funny-dog",
      "get-owner",
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
import { describe, it, expect } from "vitest";
import { listAsset } from "./operations";
import { DEVNET_NETWORK } from "@/constants/devnet";

describe("listAsset", () => {
  it("should create correct contract call options", () => {
    const params = {
      sender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      nftContractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      nftContractName: "funny-dog",
      tokenId: 5,
      price: 1000000,
      expiry: 100,
    };

    const result = listAsset(DEVNET_NETWORK, params);

    expect(result.contractName).toBe("nft-marketplace");
    expect(result.functionName).toBe("list-asset");
    expect(result.functionArgs).toHaveLength(2);
    expect(result.postConditions).toHaveLength(1);
  });
});
```

**3. Integration Tests** (Playwright or Cypress)

```typescript
// e2e/strategy.spec.ts
import { test, expect } from "@playwright/test";

test("User can buy floor NFT via strategy", async ({ page }) => {
  await page.goto("http://localhost:3000");

  // Connect devnet wallet
  await page.click('[data-testid="connect-wallet"]');
  await page.click('[data-testid="devnet-wallet-1"]');

  // Navigate to strategy page
  await page.goto("/strategy");

  // Check floor price displayed
  await expect(page.locator('[data-testid="floor-price"]')).toContainText(
    "1.0 STX"
  );

  // Buy floor
  await page.click('[data-testid="buy-floor-button"]');

  // Wait for transaction confirmation
  await expect(page.locator('[data-testid="success-toast"]')).toBeVisible({
    timeout: 30000,
  });

  // Verify NFT appears in holdings
  await expect(page.locator('[data-testid="holdings"]')).toContainText(
    "Token #1"
  );
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
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }

  return results;
};

// Usage: Fetch multiple listings
const listingIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const listings = await batchReadOnlyCalls(
  listingIds.map((id) => () => fetchListing(network, id)),
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
import { useState, useEffect } from "react";
import { debounce } from "lodash";

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
