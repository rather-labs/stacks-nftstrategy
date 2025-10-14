;; Test console calls for nft-marketplace and funny-dog contracts
;; Run these commands in the clarity console after deploying both contracts

;; Mint an NFT to an address
(contract-call? .funny-dog mint 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

;; Check the NFT owner
(contract-call? .funny-dog get-owner u1)

;; Get last minted token ID
(contract-call? .funny-dog get-last-token-id)

;; Get token URI
(contract-call? .funny-dog get-token-uri u1)

;; Transfer the NFT to another address
(contract-call? .funny-dog transfer u1 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)

;; List the NFT for sale in the marketplace
(contract-call? .nft-marketplace list-asset 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog { token-id: u1, price: u100000 })

;; Get the listing details
(contract-call? .nft-marketplace get-listing u0)

;; Cancel the listing
(contract-call? .nft-marketplace cancel-listing u0 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog)

;; Fulfill the listing (buy the NFT)
::set_tx_sender ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
(contract-call? ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-marketplace fulfill-listing-stx u0 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog)

;; Mint new NFT, list it cheaper and check floor price is updated
(contract-call? .nft-marketplace get-floor-price 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog) ;; should be u100000
(contract-call? .funny-dog mint 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
(contract-call? .nft-marketplace list-asset 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog { token-id: u2, price: u90000 })
(contract-call? .nft-marketplace get-floor-price 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.funny-dog) ;; should be u90000