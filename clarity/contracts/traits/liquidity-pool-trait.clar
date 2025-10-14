(define-trait liquidity-pool-trait
  (
    (swap-stx-for-rather (uint uint) (response uint uint))
    (swap-rather-for-stx (uint uint) (response uint uint))
  )
)