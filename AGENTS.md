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
