import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { RecipeCard } from '@/components/RecipeCard';
import { encodeRecipe, foodLabel, parseFood, parseRecipe } from '@/lib/recipe';
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';

type SearchParams = Promise<{ r?: string; f?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const parts = parseRecipe(sp.r);
  const food = parseFood(sp.f);
  const title = `我的社團${foodLabel(food)}｜社團聚`;
  const description = parts.length
    ? `${parts.map((p) => `${p.name} ${p.count} 份`).join('、')}。你也來調一份？`
    : '點幾下你喜歡的興趣，調出你的社團特調。';
  const image = `/api/og/mix?r=${encodeURIComponent(encodeRecipe(parts))}&f=${food}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** Landing page for a shared quiz card: show the friend's recipe, then invite them to make one. */
export default async function MixPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parts = parseRecipe(sp.r);
  const food = parseFood(sp.f);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {parts.length > 0 ? (
        <>
          <PageHeader
            eyebrow="朋友傳來的配方"
            title={`這是一份社團${foodLabel(food)}`}
            description="喜歡哪些興趣就點幾下，就能調出你自己的一份。不用註冊。"
          />
          <RecipeCard parts={parts} food={food} title={`朋友的社團${foodLabel(food)}`} />
        </>
      ) : (
        <EmptyState title="這份配方讀不到" description="可能是連結不完整。自己調一份看看吧。" />
      )}
      <ButtonLink
        href="/onboarding"
        size="lg"
        icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
        className="flex-row-reverse"
      >
        調一份我的
      </ButtonLink>
    </div>
  );
}
