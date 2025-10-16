![Rather Labs](./front-end/public/images/rather-white.svg#gh-dark-mode-only)
![Rather Labs](./front-end/public/images/rather-dark.svg#gh-light-mode-only)
# Rather Strategy Monorepo

Full-stack reference implementation of the “Rather Strategy Protocol” on Stacks. The repository bundles:

- A Next.js 14 front-end (Chakra UI + Stacks.js) for the marketplace, liquidity dashboard, and admin tooling.
- A suite of Clarity contracts (NFT collection, marketplace, SIP-010 token/strategy, and liquidity pool) managed with Clarinet.

The codebase targets the Stacks testnet by default and is designed for fast iteration on devnet.

This project has been created for the [Stacks Vibe Coding Hackathon](https://dorahacks.io/hackathon/stacks-vibe-coding).

## Repository layout

```
├── AGENTS.md              # Contributor guide for AI/dev teammates
├── README.md              # You are here
├── clarity/               # Clarity workspace (contracts, tests, deployments)
├── front-end/             # Next.js application
└── turbo.json, package.json, etc.
```

Complementary documentation:

- [front-end/README.md](front-end/README.md) – UI architecture, env vars, scripts, diagram.
- [clarity/README.md](clarity/README.md) – Contract overview, deployment flow, diagram.

## Quick start

### Prerequisites

- Node.js 18+
- npm (comes with Node)
- [Clarinet CLI](https://github.com/hirosystems/clarinet) ≥ 1.10
- A funded Stacks deployer (for testnet deployments)

### Install dependencies

```bash
npm install                 # installs workspace root deps (Turbo, etc.)
cd clarity && npm install   # installs Clarinet TypeScript tooling
cd ../front-end && npm install
```

### Environment setup

Front-end requires an `.env` file (see `front-end/.env.example`) with at minimum:

```env
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_PLATFORM_HIRO_API_KEY=...   # optional for devnet helpers
NEXT_PUBLIC_TESTNET_DEPLOYER=...        # principal that deployed contracts
```

Clarity deployments use `clarity/settings/Testnet.toml`—replace the mnemonic there if you deploy from a different wallet.

### Run the dev servers

```bash
# 1. (optional) open a terminal for smart-contract checks
cd clarity
clarinet check

# 2. start the Next.js app
cd ../front-end
npm run dev
```

Visit http://localhost:3000. Switch between devnet/testnet in the navbar and connect either the built-in devnet wallet switcher or your Stacks wallet extension.

## Tests & tooling

- **Clarity**: `cd clarity && npm test` (vitest + Clarinet SDK)
- **Front-end**: currently no automated tests; rely on manual smoke testing.
- **Formatting/Lint**: project uses ESLint/Prettier defaults; run `npm run lint` inside `front-end` if configured.

## Deploying to testnet

1. Fund the deployer from the [Stacks testnet faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet).
2. Update `clarity/deployments/default.testnet-plan.yaml` if you need new contract names (Stacks does not allow overwriting).
3. Apply the plan:

   ```bash
   cd clarity
   clarinet deployments check -p deployments/default.testnet-plan.yaml
   clarinet deployments apply --testnet -p deployments/default.testnet-plan.yaml
   ```

4. Record the resulting principals and update front-end env variables (`NEXT_PUBLIC_TESTNET_*`).
5. Restart `npm run dev` so the UI picks up the new configuration.

## Production checklist

- [ ] Review contract logic with a qualified auditor.
- [ ] Add unit/integration tests for both contracts and UI.
- [ ] Harden wallet/post-condition handling for mainnet.
- [ ] Mirror deployment plan for mainnet and update env vars accordingly.

## Additional resources

- [Stacks docs](https://docs.stacks.co/)
- [Clarinet manual](https://docs.hiro.so/clarinet/)
- [Stacks Explorer](https://explorer.hiro.so/)

See the per-package READMEs for deeper details and architecture diagrams.
