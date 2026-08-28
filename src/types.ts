// Shared types for the Pokémon card portfolio.

/** Price data for one printing variant, as returned by pokemontcg.io (TCGplayer prices). */
export interface VariantPrices {
  low: number | null
  mid: number | null
  high: number | null
  market: number | null
  directLow: number | null
}

/** The `tcgplayer` object on an API card. Prices are keyed by printing variant
 *  (e.g. "holofoil", "normal", "reverseHolofoil", "1stEditionHolofoil"). */
export interface TcgplayerData {
  url: string
  updatedAt: string
  prices?: Record<string, VariantPrices>
}

export interface CardmarketData {
  url: string
  updatedAt: string
  prices?: { averageSellPrice?: number; trendPrice?: number; lowPrice?: number }
}

/** A card as returned by the pokemontcg.io /v2/cards endpoint (fields we use). */
export interface ApiCard {
  id: string
  name: string
  number: string
  rarity?: string
  set: {
    id: string
    name: string
    series: string
    printedTotal: number
    releaseDate: string
  }
  images: { small: string; large: string }
  tcgplayer?: TcgplayerData
  cardmarket?: CardmarketData
}

/** A set as returned by /v2/sets (fields we use). */
export interface ApiSet {
  id: string
  name: string
  series: string
  printedTotal: number
  releaseDate: string
}

/** One owned card in the portfolio, persisted to localStorage.
 *  Stores a metadata snapshot so the grid renders instantly offline;
 *  price fields are refreshed from the API on load. */
export interface OwnedCard {
  cardId: string
  name: string
  number: string
  setId: string
  setName: string
  rarity?: string
  imageSmall: string
  imageLarge: string
  tcgplayerUrl?: string
  /** Which printing this copy is (a key of tcgplayer.prices). */
  variant: string
  /** All variants seen for this card, so the dropdown works offline. */
  variants: string[]
  qty: number
  priceMarket: number | null
  priceUpdatedAt?: string
  addedAt: string
  /** True for a hand-entered card (Japanese cards, promos, anything the
   *  pokemontcg.io API does not carry). Manual cards are skipped by the price
   *  refresh — their price is whatever the user typed, and only the user
   *  changes it. */
  manual?: boolean
  /** Free-text language for manual cards, e.g. "Japanese". */
  language?: string
  /** Free-text note for manual cards (condition, grading, where it came from). */
  note?: string
}

/** One point on the value-over-time chart. */
export interface HistoryPoint {
  date: string // YYYY-MM-DD
  totalValue: number
}

/** A cash offer a vendor made at a show. Logged from the Sell tab so offers can
 *  be compared before committing — the "shop it around" rule. */
export interface Offer {
  id: string
  /** Vendor / table name, free text. */
  vendor: string
  /** What they offered, in dollars, for this card at the logged qty. */
  amount: number
  note?: string
  at: string // ISO timestamp
}

/** Everything the Sell tab tracks for one owned entry. Kept in a side map keyed
 *  by `cardId|variant` rather than on OwnedCard, so a collection restored from
 *  an older backup still loads cleanly. */
export interface SellInfo {
  forSale: boolean
  /** Optional manual floor; when unset the ladder percentages are used. */
  askPrice?: number | null
  offers: Offer[]
}

/** The whole persisted app state — one object, one cloud file, one backup file. */
export interface AppData {
  version: 2
  collection: OwnedCard[]
  history: HistoryPoint[]
  sell: Record<string, SellInfo>
  updatedAt: string
}
