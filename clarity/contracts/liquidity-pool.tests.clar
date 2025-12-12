(define-read-only (get-contract-self)
  (as-contract tx-sender)
)

(define-read-only (invariant-reserves-track-onchain-balances)
  (if (not (var-get initialized))
      true
      (let (
          (self (get-contract-self))
          (stored-stx (var-get reserve-stx))
          (stored-rather (var-get reserve-rather))
          (onchain-stx (stx-get-balance self))
          (onchain-rather (unwrap-panic (contract-call? .strategy-token get-balance self)))
        )
        (and
          (is-eq stored-stx onchain-stx)
          (is-eq stored-rather onchain-rather)
        )
      )
  )
)
