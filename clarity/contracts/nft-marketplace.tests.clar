(define-constant ERR_LISTING_ID (err u700001))
(define-constant ERR_LISTING_PRESENT (err u700002))
(define-constant ERR_OWNER_AFTER_CANCEL (err u700003))
(define-constant ERR_LISTING_PRICE (err u700004))
(define-constant ERR_LISTING_MAKER (err u700005))
(define-constant ERR_LISTING_TOKEN (err u700006))
(define-constant ERR_CANCEL_FAILED (err u700007))

(define-read-only (can-test-list-and-cancel (price uint))
  (> price u0)
)

(define-public (test-list-and-cancel (price uint))
  (if (<= price u0)
      (ok false)
      (let ((nonce (unwrap-panic (get-listing-nonce))))
        (match (contract-call? .funny-dog mint tx-sender)
          token-id
            (match (list-asset .funny-dog { token-id: token-id, price: price })
              listing-id
                (let ((listing-opt (get-listing listing-id)))
                  (if (is-none listing-opt)
                      (ok false)
                      (let (
                          (listing (unwrap-panic listing-opt))
                          (cancel-result (cancel-listing listing-id .funny-dog))
                        )
                        (asserts! (is-eq listing-id nonce) ERR_LISTING_ID)
                        (asserts! (is-eq (get maker listing) tx-sender) ERR_LISTING_MAKER)
                        (asserts! (is-eq (get token-id listing) token-id) ERR_LISTING_TOKEN)
                        (asserts! (is-eq (get price listing) price) ERR_LISTING_PRICE)
                        (match cancel-result
                          cancel-response
                            (begin
                              (asserts! cancel-response ERR_CANCEL_FAILED)
                              (let (
                                  (listing-after (get-listing listing-id))
                                  (owner-response (contract-call? .funny-dog get-owner token-id))
                                )
                                (asserts! (is-none listing-after) ERR_LISTING_PRESENT)
                                (let (
                                    (owner-opt (unwrap-panic owner-response))
                                    (owner (unwrap-panic owner-opt))
                                  )
                                  (asserts! (is-eq owner tx-sender) ERR_OWNER_AFTER_CANCEL)
                                  (ok true)
                                )
                              )
                            )
                          err
                            (ok false)
                        )
                      )
                  )
                )
              err
                (ok false)
            )
          err
            (ok false)
        )
      )
  )
)
