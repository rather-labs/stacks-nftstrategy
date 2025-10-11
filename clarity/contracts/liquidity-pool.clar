;; liquidity-pool.clar
;; Minimal XYK pool for STX <-> RATHER swaps (no protocol fees here).
;; Token-level fee-on-transfer in RATHER should enforce strategy treasury accrual.

(define-constant ERR_NOT_OWNER (err u100))
(define-constant ERR_ALREADY_INIT (err u101))
(define-constant ERR_NOT_INIT (err u102))
(define-constant ERR_BAD_TOKEN (err u103))
(define-constant ERR_BAD_INPUT (err u104))
(define-constant ERR_MIN_OUT (err u105))
(define-constant ERR_INSUFF_LIQ (err u106))

(define-data-var owner principal tx-sender)
(define-data-var initialized bool false)

(define-data-var reserve-stx uint u0)
(define-data-var reserve-rather uint u0)

(define-read-only (get-reserves)
  { stx: (var-get reserve-stx), rather: (var-get reserve-rather) }
)

;; Hardcoded RATHER token contract in this workspace
(define-constant TOKEN .strategy-token)

(define-read-only (get-token)
  (ok TOKEN)
)

(define-read-only (get-status)
  (ok (var-get initialized))
)

;; Initialize reserves: owner provides initial STX (pulled in this call) and declares initial token reserve.
(define-public (init)
  (begin
    (asserts! (not (var-get initialized)) ERR_ALREADY_INIT)
    (let ((self (as-contract tx-sender)))
      (let (
            (stx-bal (stx-get-balance self))
             (r-bal (unwrap! (contract-call? .strategy-token get-balance self) ERR_BAD_INPUT))
        )
        (var-set reserve-stx stx-bal)
        (var-set reserve-rather r-bal)
        (var-set initialized true)
        (ok { stx: stx-bal, rather: r-bal })
      )
    )
  )
)


(define-read-only (get-quote-stx-for-rather (amount-in uint))
  (begin
    (asserts! (var-get initialized) ERR_NOT_INIT)
    (asserts! (> amount-in u0)      ERR_BAD_INPUT)
    (let ((r-stx (var-get reserve-stx))
          (r-r   (var-get reserve-rather)))
      (asserts! (and (> r-stx u0) (> r-r u0)) ERR_NOT_INIT)
      (ok (/ (* amount-in r-r) (+ r-stx amount-in)))
    )
  )
)

(define-public (swap-stx-for-rather (amount-in uint) (min-out uint))
  (begin
    (asserts! (var-get initialized) ERR_NOT_INIT)
    (asserts! (> amount-in u0) ERR_BAD_INPUT)

    (let (
        (recipient tx-sender)
        (self  (as-contract tx-sender))                        ;; contract principal
        (r-stx (var-get reserve-stx))
        (r-r   (var-get reserve-rather))
        (out   (/ (* amount-in r-r) (+ r-stx amount-in)))      ;; XYK, no fee
      )

      (asserts! (and (> r-stx u0) (> r-r u0)) ERR_NOT_INIT)
      (asserts! (>= out min-out) ERR_MIN_OUT)
      (asserts! (<= out r-r) ERR_INSUFF_LIQ)

      ;; 1) pull STX in (caller -> contract)
      (try! (stx-transfer? amount-in recipient self))

      ;; 2) send RATHER out (contract -> tx-sender)
      (try! (as-contract (contract-call? .strategy-token transfer out self recipient none)))

      ;; 3) update reserves only after both transfers succeed
      (var-set reserve-stx    (+ r-stx amount-in))
      (var-set reserve-rather (- r-r   out))

      (print {event: "swap", stxIn: amount-in, ratherOut: out, to: recipient})
      (ok out)
    )
  )
)


(define-read-only (get-quote-rather-for-stx (amount-in uint))
  (begin
    (asserts! (var-get initialized) ERR_NOT_INIT)
    (asserts! (> amount-in u0)      ERR_BAD_INPUT)
    (let ((r-stx (var-get reserve-stx))
          (r-r   (var-get reserve-rather)))
      (asserts! (and (> r-stx u0) (> r-r u0)) ERR_NOT_INIT)
      (ok (/ (* amount-in r-stx) (+ r-r amount-in)))
    )
  )
)

(define-public (swap-rather-for-stx (amount-in uint) (min-out uint))
  (begin
    (asserts! (var-get initialized) ERR_NOT_INIT)
    (asserts! (> amount-in u0) ERR_BAD_INPUT)

    (let (
        (recipient tx-sender)
        (self  (as-contract tx-sender))                        ;; contract principal
        (r-stx (var-get reserve-stx))
        (r-r   (var-get reserve-rather))
        (out   (/ (* amount-in r-stx) (+ r-r amount-in)))      ;; XYK, no fee
      )

      (asserts! (and (> r-stx u0) (> r-r u0)) ERR_NOT_INIT)
      (asserts! (>= out min-out) ERR_MIN_OUT)
      (asserts! (<= out r-stx) ERR_INSUFF_LIQ)

      ;; 1) pull RATHER in (tx-sender -> contract)
      (try! (contract-call? .strategy-token transfer amount-in recipient self none))

      ;; ;; 2) send STX out (contract -> tx-sender)
      (try! (as-contract (stx-transfer? out self recipient)))

      ;; 3) update reserves only after both transfers succeed
      (var-set reserve-rather (+ r-r amount-in))
      (var-set reserve-stx (- r-stx out))

      (print {event: "swap", ratherIn: amount-in, stxOut: out, to: recipient})
      (ok out)
    )
  )
)
