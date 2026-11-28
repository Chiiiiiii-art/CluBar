import {
  Camera,
  Cpu,
  Dices,
  Drama,
  Gamepad2,
  HandHeart,
  Languages,
  Mountain,
  Music,
  Palette,
  Shapes,
  TrendingUp,
  Volleyball,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/components/ui';

/** One glyph per interest domain (slugs from INTEREST_DOMAINS) so a chip reads in a glance. */
const DOMAIN_ICONS: Record<string, LucideIcon> = {
  'game-dev': Gamepad2,
  'photo-film': Camera,
  'music-live': Music,
  'craft-design': Palette,
  'software-ai': Cpu,
  'outdoor-mountain': Mountain,
  'social-service': HandHeart,
  'finance-research': TrendingUp,
  'boardgame-esports': Dices,
  'dance-stage': Drama,
  'sports-fitness': Volleyball,
  'language-culture': Languages,
};

export function DomainIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = DOMAIN_ICONS[slug] ?? Shapes;
  return <Icon className={cn('h-4 w-4 shrink-0', className)} aria-hidden="true" strokeWidth={2.25} />;
}
