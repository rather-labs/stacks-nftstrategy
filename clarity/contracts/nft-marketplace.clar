;; A tiny NFT marketplace that allows users to list NFT for sale. They can specify the following:
;; - The NFT token to sell.
;; - The NFT price in STX.

(use-trait nft-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)

;; listing errors
(define-constant ERR_PRICE_ZERO (err u1000))

;; cancelling and fulfiling errors
(define-constant ERR_UNKNOWN_LISTING (err u2000))
(define-constant ERR_UNAUTHORISED (err u2001))
(define-constant ERR_NFT_ASSET_MISMATCH (err u2002))
(define-constant ERR_MAKER_TAKER_EQUAL (err u2003))

;; Define a map data structure for the asset listings
(define-map listings
  uint
  {
    maker: principal,
    token-id: uint,
    nft-asset-contract: principal,
    price: uint
  }
)

;; Used for unique IDs for each listing
(define-data-var listing-nonce uint u0)

;; Floor price tracking
(define-map floor-prices principal uint)

;; Public function to get the current listing nonce
(define-read-only (get-listing-nonce)
  (ok (var-get listing-nonce))
)

;; Get floor price for a specific NFT contract
(define-read-only (get-floor-price (nft-contract principal))
  (ok (map-get? floor-prices nft-contract))
)

;; Private function to recalculate floor price after removal
(define-private (recalculate-floor-price (nft-contract principal))
  (let ((nonce (var-get listing-nonce)))
    (if (is-eq nonce u0)
      (map-delete floor-prices nft-contract)
      (let ((min-price (fold check-listing-price 
                            (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9) 
                            {nft-contract: nft-contract, min: none})))
        (match (get min min-price)
          price (map-set floor-prices nft-contract price)
          (map-delete floor-prices nft-contract)
        )
      )
    )
  )
)

;; Helper to check each listing
(define-private (check-listing-price (listing-id uint) (acc {nft-contract: principal, min: (optional uint)}))
  (match (map-get? listings listing-id)
    listing 
      (if (is-eq (get nft-asset-contract listing) (get nft-contract acc))
        (match (get min acc)
          current-min 
            (if (< (get price listing) current-min)
              {nft-contract: (get nft-contract acc), min: (some (get price listing))}
              acc)
          {nft-contract: (get nft-contract acc), min: (some (get price listing))}
        )
        acc)
    acc
  )
)

;; Internal function to transfer an NFT asset from a sender to a given recipient.
(define-private (transfer-nft
    (token-contract <nft-trait>)
    (token-id uint)
    (sender principal)
    (recipient principal)
  )
  (contract-call? token-contract transfer token-id sender recipient)
)

;; Public function to list an asset along with its contract
(define-public (list-asset
    (nft-asset-contract <nft-trait>)
    (nft-asset {
      token-id: uint,
      price: uint
    })
  )
  (let ((listing-id (var-get listing-nonce))
        (nft-contract (contract-of nft-asset-contract))
        (listing-price (get price nft-asset)))
    ;; Verify that the asset price is greater than zero
    (asserts! (> listing-price u0) ERR_PRICE_ZERO)

    ;; Transfer the NFT ownership to this contract's principal
    (try! (transfer-nft nft-asset-contract (get token-id nft-asset) tx-sender
      (as-contract tx-sender)
    ))
    ;; List the NFT in the listings map
    (map-set listings listing-id
      (merge {
        maker: tx-sender,
        nft-asset-contract: nft-contract,
      }
        nft-asset
      ))
    ;; Update floor price if necessary
    (match (map-get? floor-prices nft-contract)
      current-floor
        (if (< listing-price current-floor)
          (map-set floor-prices nft-contract listing-price)
          true)
      ;; No floor price set yet
      (map-set floor-prices nft-contract listing-price)
    )
    ;; Increment the nonce to use for the next unique listing ID
    (var-set listing-nonce (+ listing-id u1))
    ;; Return the created listing ID
    (ok listing-id)
  )
)

;; Public read-only function to retrieve a listing by its ID
(define-read-only (get-listing (listing-id uint))
  (map-get? listings listing-id)
)

;; Public function to cancel a listing using an asset contract.
;; This function can only be called by the NFT's creator, and must use the same asset contract that
;; the NFT uses.
(define-public (cancel-listing
    (listing-id uint)
    (nft-asset-contract <nft-trait>)
  )
  (let (
      (listing (unwrap! (map-get? listings listing-id) ERR_UNKNOWN_LISTING))
      (maker (get maker listing))
    )
    ;; Verify that the caller of the function is the creator of the NFT to be cancelled
    (asserts! (is-eq maker tx-sender) ERR_UNAUTHORISED)
    ;; Verify that the asset contract to use is the same one that the NFT uses
    (asserts!
      (is-eq (get nft-asset-contract listing) (contract-of nft-asset-contract))
      ERR_NFT_ASSET_MISMATCH
    )
    ;; Delete the listing
    (map-delete listings listing-id)
    ;; Recalculate floor price
    (recalculate-floor-price (get nft-asset-contract listing))
    ;; Transfer the NFT from this contract's principal back to the creator's principal
    (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender maker))
  )
)

;; Private function to validate that a purchase can be fulfilled
(define-private (assert-can-fulfill
    (nft-asset-contract principal)
    (listing {
      maker: principal,
      token-id: uint,
      nft-asset-contract: principal,
      price: uint,
    })
  )
  (begin
    ;; Verify that the buyer is not the same as the NFT creator
    (asserts! (not (is-eq (get maker listing) tx-sender)) ERR_MAKER_TAKER_EQUAL)
    ;; Verify the asset contract used to purchase the NFT is the same as the one set on the NFT
    (asserts! (is-eq (get nft-asset-contract listing) nft-asset-contract)
      ERR_NFT_ASSET_MISMATCH
    )
    (ok true)
  )
)

;; Public function to purchase a listing using STX as payment
(define-public (fulfill-listing-stx
    (listing-id uint)
    (nft-asset-contract <nft-trait>)
  )
  (let (
      ;; Verify the given listing ID exists
      (listing (unwrap! (map-get? listings listing-id) ERR_UNKNOWN_LISTING))
      ;; Set the NFT's taker to the purchaser (caller of the_function)
      (taker tx-sender)
    )
    ;; Validate that the purchase can be fulfilled
    (try! (assert-can-fulfill (contract-of nft-asset-contract) listing))
    ;; Transfer the NFT to the purchaser (caller of the function)
    (try! (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender taker)))
    ;; Transfer the STX payment from the purchaser to the creator of the NFT
    (try! (stx-transfer? (get price listing) taker (get maker listing)))
    ;; Remove the NFT from the marketplace listings
    (map-delete listings listing-id)
    ;; Recalculate floor price
    (recalculate-floor-price (get nft-asset-contract listing))
    ;; Return the listing ID that was just purchased
    (ok listing-id)
  )
)