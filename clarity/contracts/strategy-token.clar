;; SIP-010 fungible token used by strategy, minted to this contract initially
;; Name: strategy-token, Symbol: RATHER

(use-trait pool-trait .liquidity-pool-trait.liquidity-pool-trait)

;; 1) Implement the official SIP-010 trait (MAINNET id shown below)
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; 2) Define the token using Clarity's native FT (no pre-mint)
(define-fungible-token rather-coin)
;; Total supply that will be minted once to the pool
(define-constant TOTAL_SUPPLY u1000000000000)
;; Define strategy NFT contract
;; (define-constant STRATEGY_NFT .funny-dog)
;; Define NFT marketplace contract
;; (define-constant NFT_MARKETPLACE .nft-marketplace)

;; 3) Metadata
(define-constant TOKEN-NAME "RatherCoin")
(define-constant TOKEN_SYMBOL "RATHER")
(define-constant TOKEN-DECIMALS u6)

;; 4) Errors & owner
(define-constant ERR_OWNER_ONLY (err u200))
(define-constant ERR_NOT_TOKEN_OWNER (err u201))
(define-constant ERR_INSUFFICIENT_BAL (err u202))
(define-constant ERR_BAD_AMOUNT (err u203))
(define-constant ERR_BAD_RECIPIENT (err u204))
(define-constant ERR_ALREADY_BOOTSTRAPPED (err u205))
(define-constant ERR_LP_ONLY (err u206))
(define-constant ERR_UNKNOWN_LISTING (err u300))

(define-constant CONTRACT_OWNER tx-sender)
;; One-time bootstrap flag
(define-data-var bootstrapped bool false)

;; Fee balance (in RATHER) collected from swaps
(define-data-var fee-balance uint u0)

(define-public (get-fee-balance) (ok (var-get fee-balance)))

;; 5) Required SIP-010 entrypoints

;; SIP-010 function: Transfers tokens to a recipient
;; Sender must be the same as the caller to prevent principals from transferring tokens they do not own.
(define-public (transfer
  (amount uint)
  (sender principal)
  (recipient principal)
  (memo (optional (buff 34)))
)
  (begin
    ;; #[filter(amount, recipient)]
  (asserts! (is-eq tx-sender sender) ERR_NOT_TOKEN_OWNER)
  (try! (ft-transfer? rather-coin amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name) (ok TOKEN-NAME))
(define-read-only (get-symbol) (ok TOKEN_SYMBOL))
(define-read-only (get-decimals) (ok TOKEN-DECIMALS))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance rather-coin who)))
(define-read-only (get-total-supply) (ok (ft-get-supply rather-coin)))
(define-read-only (get-token-uri) (ok none))

;; bootstrap-once flow is enforced via mint's guards (see above)

(define-public (mint)
  (begin
  (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
  (asserts! (not (var-get bootstrapped)) ERR_ALREADY_BOOTSTRAPPED)
  (try! (ft-mint? rather-coin TOTAL_SUPPLY .liquidity-pool))
  (var-set bootstrapped true)
  (ok true)
  )
)

(define-public (add-fees (amount uint))
  (begin
    (asserts! (is-eq tx-sender .liquidity-pool) ERR_LP_ONLY)
    (asserts! (> amount u0) ERR_BAD_AMOUNT)
    (let ((self (as-contract tx-sender)))
      (try! (stx-transfer? amount tx-sender self))
      (var-set fee-balance (+ (var-get fee-balance) amount))
      (ok true)
    )
  )
)

(define-public (buy-and-relist-nft (listing_id uint))
  (begin
    (let (
      (listing
        (unwrap!
          (contract-call? .nft-marketplace get-listing listing_id)
          ERR_UNKNOWN_LISTING
        )
      )
    )
      ;; Ensure the buyer has enough STX to cover the listing price
      (asserts! (<= (get price listing) (var-get fee-balance)) ERR_INSUFFICIENT_BAL)
      ;; Buy NFT via marketplace contract
      (try! (as-contract (contract-call? .nft-marketplace fulfill-listing-stx listing_id .funny-dog)))
      ;; Deduct the listing price from the fee balance
      (var-set fee-balance (- (var-get fee-balance) (get price listing)))
      ;; Relist the NFT at 10% higher price than the purchase price
      (try! (as-contract (contract-call? .nft-marketplace list-asset
        .funny-dog
        {
          token-id: (get token-id listing),
          price: (/ (* (get price listing) u11) u10) ;; 10% markup
        }
      )))
      (ok true)
    )
  )
)

(define-private (strategy-burn (amount uint))
  (let ((self (as-contract tx-sender)))
  (ft-burn? rather-coin amount self))
)

;; Check STX balance - fee-balance is greater than 0, buy RATHER at market price and burn it
(define-public (buy-token-and-burn (liquidity-pool <pool-trait>))
  (let (
    (self (as-contract tx-sender))
    (stx-amount (- (stx-get-balance self) (var-get fee-balance)))
  )
    (asserts! (> stx-amount u0) ERR_INSUFFICIENT_BAL)
    (let (
      (rather-amount
        (try! (as-contract (contract-call? liquidity-pool swap-stx-for-rather stx-amount u0)))
      )
    )
      ;; Burn all RATHER held by this contract
      (try! (strategy-burn rather-amount))
      (ok true)
    )
  )
)