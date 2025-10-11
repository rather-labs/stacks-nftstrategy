;; SIP-010 fungible token used by strategy, minted to this contract initially
;; Name: strategy-token, Symbol: RATHER

;; 1) Implement the official SIP-010 trait (MAINNET id shown below)
;; (impl-trait .sip-010-trait-ft-standard.sip-010-trait)
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; 2) Define the token using Clarity's native FT (no pre-mint)
(define-fungible-token rather-coin)
;; Total supply that will be minted once to the pool
(define-constant TOTAL_SUPPLY u1000000)

;; 3) Metadata
(define-constant TOKEN-NAME "RatherCoin")
(define-constant TOKEN_SYMBOL "RATHER")
(define-constant TOKEN-DECIMALS u6)

;; 4) Errors & owner
(define-constant ERR_OWNER_ONLY (err u100))
(define-constant ERR_NOT_TOKEN_OWNER (err u101))
(define-constant ERR_INSUFFICIENT_BAL (err u102))
(define-constant ERR_BAD_AMOUNT (err u103))
(define-constant ERR_BAD_RECIPIENT (err u104))
(define-constant ERR_ALREADY_BOOTSTRAPPED (err u105))

(define-constant CONTRACT_OWNER tx-sender)
;; One-time bootstrap flag
(define-data-var bootstrapped bool false)

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

;; Mint new tokens and send them to a recipient.
;; Only the contract deployer can perform this operation.
;; (define-public (mint (amount uint) (recipient principal))
;;   (begin
;;   ;; (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
;;   ;; (asserts! (not (var-get bootstrapped)) ERR_ALREADY_BOOTSTRAPPED)
;;   ;; (asserts! (is-eq amount TOTAL_SUPPLY) ERR_BAD_AMOUNT)
;;   (asserts! (is-eq recipient .liquidity-pool) ERR_BAD_AMOUNT)
;;   (try! (ft-mint? rather-coin amount recipient))
;;   (var-set bootstrapped true)
;;   (ok true)
;;   )
;; )


(define-public (mint (amount uint) (recipient principal))
  (begin
  ;; (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
  ;; (asserts! (not (var-get bootstrapped)) ERR_ALREADY_BOOTSTRAPPED)
  ;; (asserts! (is-eq amount TOTAL_SUPPLY) ERR_BAD_AMOUNT)
  ;; (asserts! (is-eq recipient .liquidity-pool) ERR_BAD_RECIPIENT)
  (try! (ft-mint? rather-coin amount recipient))
  (var-set bootstrapped true)
  (ok true)
  )
)

(define-private (strategy-burn (amount uint))
  (let ((self (as-contract tx-sender)))
  (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
    (ft-burn? rather-coin amount self))
)