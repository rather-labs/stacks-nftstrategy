;; Test console calls for liquidity-pool and strategy-token contracts
;; Run these commands in the clarity console after deploying both contracts

;; Mint tokens to the liquidity pool and fund it with STX
(stx-transfer? u50000000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool)
(contract-call? .strategy-token mint)

;; Check balances
(stx-get-balance 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool)
(contract-call? .strategy-token get-balance 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool)

;; Initialize the liquidity pool
(contract-call? .liquidity-pool init)

;; Perform swaps
(contract-call? .liquidity-pool get-quote-stx-for-rather u1000000)
(contract-call? .liquidity-pool swap-stx-for-rather u1000000 u17999)

(contract-call? .liquidity-pool get-quote-rather-for-stx u10000)
(contract-call? .liquidity-pool swap-rather-for-stx u10000 u450000)

;; Check strategy balances after swaps
(stx-get-balance 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.strategy-token)
(contract-call? .strategy-token get-fee-balance)