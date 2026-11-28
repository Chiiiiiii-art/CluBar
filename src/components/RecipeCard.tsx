import { DomainIcon } from './DomainIcon';
import { RecipeFood, TOKEN_PALETTE, domainColorVar } from './RecipeFood';
import { FOODS, foodLabel, type Food, type RecipePart } from '@/lib/recipe';
import { FilterChip, cn } from '@/components/ui';

/** The quiz result as a self-made food card: the picture plus its ingredient list in 份. */
export function RecipeCard({
  parts,
  food,
  onFoodChange,
  title,
  className,
}: {
  parts: RecipePart[];
  food: Food;
  /** Owner view: lets them pick which food stands for them. */
  onFoodChange?: (food: Food) => void;
  title?: string;
  className?: string;
}) {
  const name = foodLabel(food);
  const recipeText = parts.map((p) => `${p.name} ${p.count} 份`).join('、');
  return (
    <div className={cn('tactile-card rounded-2xl bg-surface p-5 sm:p-6', className)}>
      <h2 className="font-display text-xl font-bold text-fg">{title ?? `我的社團${name}`}</h2>
      {onFoodChange && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="用哪種食物代表你">
          {FOODS.map((f) => (
            <FilterChip key={f.id} selected={food === f.id} onClick={() => onFoodChange(f.id)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0">
          <RecipeFood
            food={food}
            parts={parts.map((p) => ({ color: domainColorVar(p.slug), count: p.count }))}
            palette={TOKEN_PALETTE}
            width={food === 'pizza' ? 220 : 190}
            label={`${name}：${recipeText}`}
          />
        </div>
        <ul className="w-full min-w-0 space-y-2" aria-label="配方">
          {parts.map((p) => (
            <li key={p.slug} className="flex items-center gap-2.5 text-sm text-fg">
              <span
                className="h-5 w-5 shrink-0 rounded-md border-2 border-border-ink"
                style={{ backgroundColor: domainColorVar(p.slug) }}
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
