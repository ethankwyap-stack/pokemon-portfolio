// One owned card in the portfolio grid.

import type { OwnedCard } from '../types'
import { variantLabel } from '../lib/api'
import { usd } from '../lib/format'
import { Badge, Button } from './ui'

interface Props {
  card: OwnedCard
  onQtyChange: (cardId: string, variant: string, qty: number) => void
  onVariantChange: (cardId: string, variant: string, next: string) => void
  onRemove: (cardId: string, variant: string) => void
  onEditManual?: (card: OwnedCard) => void
}

export default function CardTile({
  card,
  onQtyChange,
  onVariantChange,
  onRemove,
  onEditManual,
}: Props) {
  const lineValue = card.priceMarket != null ? card.priceMarket * card.qty : null
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-3">
      {card.imageSmall ? (
        <a href={card.imageLarge} target="_blank" rel="noreferrer" title="View large image">
          <img src={card.imageSmall} alt={card.name} loading="lazy" className="w-full rounded-lg" />
        </a>
      ) : (
        <div className="flex aspect-[5/7] w-full items-center justify-center rounded-lg border border-dashed border-border px-2 text-center text-xs text-muted">
          no photo
        </div>
      )}
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{card.name}</p>
          <p className="truncate text-xs text-muted">
            {card.setName} · #{card.number}
          </p>
        </div>
        {card.manual ? (
          <span className="max-w-[45%] shrink-0" title={`${card.language ?? 'Manual'} · entered by hand`}>
            <Badge tone="neon">{card.language ?? 'Manual'}</Badge>
          </span>
        ) : (
          card.rarity && (
            <span className="max-w-[45%] shrink-0" title={card.rarity}>
              <Badge tone="accent">{card.rarity}</Badge>
            </span>
          )
        )}
      </div>
      {card.note && <p className="mt-1 truncate text-xs text-muted" title={card.note}>{card.note}</p>}

      {card.variants.length > 1 ? (
        <select
          value={card.variant}
          onChange={(e) => onVariantChange(card.cardId, card.variant, e.target.value)}
          className="mt-2 rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-neon"
          title="Printing variant"
        >
          {card.variants.map((v) => (
            <option key={v} value={v}>
              {variantLabel(v)}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2 text-xs text-muted">{variantLabel(card.variant)}</p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-muted">Market</span>
        <span className="font-semibold text-neon">{usd(card.priceMarket)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            variant="subtle"
            className="!px-2 !py-0.5"
            onClick={() => onQtyChange(card.cardId, card.variant, card.qty - 1)}
            aria-label="Decrease quantity"
          >
            −
          </Button>
          <span className="w-6 text-center text-sm text-ink">{card.qty}</span>
          <Button
            variant="subtle"
            className="!px-2 !py-0.5"
            onClick={() => onQtyChange(card.cardId, card.variant, card.qty + 1)}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>
        <span className="text-sm font-semibold text-ink">{usd(lineValue)}</span>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        {card.manual ? (
          <button
            onClick={() => onEditManual?.(card)}
            className="cursor-pointer text-xs text-neon hover:underline"
          >
            Edit details / price
          </button>
        ) : card.tcgplayerUrl ? (
          <a
            href={card.tcgplayerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neon hover:underline"
          >
            View on TCGplayer ↗
          </a>
        ) : (
          <span className="text-xs text-muted">No TCGplayer listing</span>
        )}
        <Button
          variant="danger"
          className="!px-2 !py-0.5 text-xs"
          onClick={() => onRemove(card.cardId, card.variant)}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}
