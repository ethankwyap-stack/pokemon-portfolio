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
}

/** One point on the value-over-time chart. */
export interface HistoryPoint {
  date: string // YYYY-MM-DD
  totalValue: number
}
