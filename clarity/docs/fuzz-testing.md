# Rendezvous Fuzz Testing Overview

## Scope

- Contracts covered: `strategy-token`, `liquidity-pool`, and `nft-marketplace`
- Test harness: [Rendezvous](https://docs.hiro.so/rendezvous/intro)
- Test modes selected per contract:
  - `strategy-token`: invariant-based checks focusing on accounting guarantees.
  - `liquidity-pool`: invariant-based checks tying stored reserves to live balances.
  - `nft-marketplace`: property-based workflow test covering list → cancel lifecycle.

## Strategy & Implementation

### strategy-token

- **Invariant – fee backing**: `invariant-fee-balance-backed-by-stx` asserts the contract's tracked fee balance never exceeds its actual STX balance.
- **Invariant – supply accounting**: `invariant-burn-tracks-total-supply` ensures total supply plus burned balance always equals the fixed `TOTAL_SUPPLY` (unless supply is zero to avoid trivial overflow).
- Tests access contract `var-get` state directly to avoid self-calls that interfere with deployment.

### liquidity-pool

- Added helper `get-contract-self` to capture the pool's principal without re-entering via `contract-call?`.
- **Invariant – reserves match balances**: `invariant-reserves-track-onchain-balances` compares stored reserve variables with actual STX balance and SIP-010 token balance (via `strategy-token.get-balance`). Fails are guarded with `unwrap-panic` to surface genuine mismatches.

### nft-marketplace

- Precondition guard `can-test-list-and-cancel` filters out zero-price cases (Rendezvous will still try occasional invalid cases, which show up as discards).
- Property `test-list-and-cancel` performs:
  1. Minting a Funny Dog NFT to the caller.
  2. Listing at a fuzzed positive price and validating listing contents (`maker`, `token-id`, `price`, listing nonce alignment).
  3. Canceling the listing, checking success, absence from the map, and restoration of NFT ownership to the lister.
- Extensive use of `unwrap-panic` ensures optional/response values are fully resolved before assertions, keeping the property expressive without running afoul of Rendezvous type inference.

## Execution

Run commands from `clarity/` to ensure the manifest is picked up:

```bash
npx rv . strategy-token invariant
npx rv . liquidity-pool invariant
npx rv . nft-marketplace test
```

Recent runs (Mar 2025) produced the following:

- `strategy-token`: 100 invariant passes (`invariant-fee-balance-backed-by-stx`, `invariant-burn-tracks-total-supply`).
- `liquidity-pool`: 100 invariant passes for `invariant-reserves-track-onchain-balances`. Some swap calls trigger expected errors (e.g., division-by-zero before reserves are seeded); Rendezvous reports these as ignored without breaking the invariant.
- `nft-marketplace`: 100 property runs, zero failures, two discards due to zero-price inputs filtered by the guard.

## Notes & Next Steps

- Division-by-zero events during liquidity pool fuzzing stem from swaps attempted before initialization. The invariant intentionally tolerates these ignored calls because the pool state remains unchanged.
- Additional marketplace properties (e.g., fulfilled purchase flows) can be layered on by following the same `unwrap-panic` pattern to safely interrogate responses/options.
- Keep Clarinet manifest entries at `clarity_version = 2` for all contracts touched by these tests—this is required for `unwrap-panic` and trait interactions used in the harness.
