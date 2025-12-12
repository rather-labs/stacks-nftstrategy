(define-read-only (get-contract-self)
  (as-contract tx-sender)
)

(define-read-only (invariant-fee-balance-backed-by-stx)
  (>= (stx-get-balance (get-contract-self)) (var-get fee-balance))
)

(define-read-only (invariant-burn-tracks-total-supply)
  (let ((current-supply (ft-get-supply rather-coin)))
    (if (is-eq current-supply u0)
        true
        (is-eq (+ current-supply (var-get burned-balance)) TOTAL_SUPPLY)
    )
  )
)
