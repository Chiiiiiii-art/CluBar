import { DomainIcon } from './DomainIcon';
import { RecipeFood, TOKEN_PALETTE } from './RecipeFood';
import { FOODS, PALETTES, cardTitle, foodLabel, partColor, type Food, type PaletteId, type RecipePart } from '@/lib/recipe';
import { FilterChip, cn } from '@/components/ui';

/** The quiz result as a self-made food card: the picture plus its ingredient list in 份. */
export function RecipeCard({
  parts,
  food,
  palette,
  maker,
  onFoodChange,
  onPaletteChange,
  className,
}: {
  parts: RecipePart[];
  food: Food;
  palette: PaletteId;
  maker: string;
  /** Owner view: pick the food and colours that stand for them. */
  onFoodChange?: (food: Food) => void;
  onPaletteChange?: (palette: PaletteId) => void;
  className?: string;
}) {
  const recipeText = parts.map((p) => `${p.name} ${p.count} 份`).join('、');
  return (
    <div className={cn('tactile-card rounded-2xl bg-surface p-5 sm:p-6', className)}>
      <h2 className="break-words font-display text-xl font-bold text-fg">{cardTitle(maker, food)}</h2>
      {onFoodChange && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="用哪種食物代表你">
          {FOODS.map((f) => (
            <FilterChip key={f.id} selected={food === f.id} onClick={() => onFoodChange(f.id)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      )}
      {onPaletteChange && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="配色">
          {PALETTES.map((pal) => (
            <FilterChip key={pal.id} selected={palette === pal.id} onClick={() => onPaletteChange(pal.id)}>
              <span className="flex" aria-hidden="true">
                {pal.colors.slice(0, 3).map((c) => (
                  <span key={c} className="-ml-1 h-3.5 w-3.5 rounded-full border-2 border-border-ink first:ml-0" style={{ backgroundColor: c }} />
                ))}
              </span>
              {pal.label}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0">
          <RecipeFood
            food={food}
            parts={parts.map((p, i) => ({ color: partColor(palette, i), count: p.count }))}
            palette={TOKEN_PALETTE}
            width={food === 'pizza' ? 220 : 190}
            label={`${foodLabel(food)}：${recipeText}`}
          />
        </div>
        <ul className="w-full min-w-0 space-y-2" aria-label="配方">
          {parts.map((p, i) => (
            <li key={p.slug} className="flex items-center gap-2.5 text-sm text-fg">
              <span
                className="h-5 w-5 shrink-0 rounded-md border-2 border-border-ink"
                style={{ backgroundColor: partColor(palette, i) }}
                aria-hidden="true"
              />
              <DomainIcon slug={p.slug} className="text-fg-muted" />
              <span className="min-w-0 flex-1 break-words font-medium">{p.name}</span>
              <span className="shrink-0 font-display font-bold">{p.count} 份</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
