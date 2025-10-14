;; Mint tokens to the liquidity pool and fund it with STX
(stx-transfer? u50000000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool)
(contract-call? .strategy-token mint)

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

;; Mint an NFT to an address
(contract-call? .funny-dog mint 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)


;; List the NFT for sale in the marketplace
(contract-call? .nft-marketplace list-asset 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog { token-id: u1, price: u100000 })

;; Buy and relist the NFT at 10% higher price
(contract-call? .strategy-token buy-and-relist-nft u0)

;; Check fee balance, buy RATHER at market price and burn it
(contract-call? .strategy-token get-fee-balance)

;; User fulfills the listing (buy the NFT)
(contract-call? .nft-marketplace fulfill-listing-stx u1 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog)

;; Check strategy balances after selling re-listed NFT
(stx-get-balance 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.strategy-token)
(contract-call? .strategy-token get-fee-balance)

;; Buy token and burn it
(contract-call? .strategy-token buy-token-and-burn 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool)

;; Check strategy balances after selling re-listed NFT
(stx-get-balance 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.strategy-token)
(contract-call? .strategy-token get-fee-balance)
(contract-call? .strategy-token get-balance 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.strategy-token)