import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { RecipeCard } from '@/components/RecipeCard';
import { cardTitle, parseFood, parseMaker, parsePalette, parseRecipe, recipeImagePath } from '@/lib/recipe';
import { ButtonLink, EmptyState } from '@/components/ui';

type SearchParams = Promise<{ r?: string; f?: string; p?: string; n?: string }>;

async function readCard(searchParams: SearchParams) {
  const sp = await searchParams;
  return {
    parts: parseRecipe(sp.r),
    food: parseFood(sp.f),
    palette: parsePalette(sp.p),
    maker: parseMaker(sp.n),
  };
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const card = await readCard(searchParams);
  const title = `${cardTitle(card.maker, card.food)}｜社團聚`;
  const description = card.parts.length
    ? `${card.parts.map((p) => `${p.name} ${p.count} 份`).join('、')}。你也來調一份？`
    : '點幾下你喜歡的興趣，調出你的社團特調。';
  const image = recipeImagePath(card);
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** Landing page for a shared quiz card: the friend's recipe, then one loud call to make your own. */
export default async function MixPage({ searchParams }: { searchParams: SearchParams }) {
  const card = await readCard(searchParams);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {card.parts.length > 0 ? (
        <RecipeCard parts={card.parts} food={card.food} palette={card.palette} maker={card.maker || '朋友'} />
      ) : (
        <EmptyState title="這份配方讀不到" description="可能是連結不完整。自己調一份看看吧。" />
      )}
      <div className="tactile-card space-y-3 rounded-2xl bg-spark p-5 text-center">
        <p className="font-display text-lg font-bold text-fg">你的會是什麼口味？</p>
        <ButtonLink
          href="/onboarding"
          size="lg"
          block
          icon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
          className="flex-row-reverse text-lg"
        >
          我也來調一份
        </ButtonLink>
        <p className="text-sm text-fg-secondary">點幾下就好，不用註冊。</p>
      </div>
    </div>
  );
}
