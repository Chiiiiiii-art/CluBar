import type { Food } from '@/lib/recipe';

export interface FoodPalette {
  ink: string;
  paper: string;
  accent: string;
  spark: string;
}

/** UI colours via tokens; the OG routes pass literals because Satori cannot read CSS variables. */
export const TOKEN_PALETTE: FoodPalette = {
  ink: 'var(--color-border-ink)',
  paper: 'var(--color-surface)',
  accent: 'var(--color-brand)',
  spark: 'var(--color-spark)',
};

export function domainColorVar(slug: string): string {
  return `var(--color-domain-${slug})`;
}

interface Part {
  color: string;
  count: number;
}

/**
 * The quiz result drawn as food: each interest is an ingredient sized by how many times it
 * was tapped. Plain SVG with no clip paths or filters, so the same markup renders in Satori.
 */
export function RecipeFood({
  food,
  parts,
  palette,
  width,
  label,
}: {
  food: Food;
  parts: Part[];
  palette: FoodPalette;
  width: number;
  label: string;
}) {
  const total = parts.reduce((s, p) => s + p.count, 0) || 1;
  return food === 'pizza' ? (
    <Pizza parts={parts} total={total} p={palette} width={width} label={label} />
  ) : (
    <Drink parts={parts} total={total} p={palette} width={width} label={label} />
  );
}

type ShapeProps = { parts: Part[]; total: number; p: FoodPalette; width: number; label: string };

/** Tall glass, biggest share at the bottom. */
function Drink({ parts, total, p, width, label }: ShapeProps) {
  const TOP = 60;
  const BOTTOM = 260;
  const LIQUID_TOP = 88;
  const xl = (y: number) => 40 + (24 * (y - TOP)) / (BOTTOM - TOP);
  const xr = (y: number) => 180 - (24 * (y - TOP)) / (BOTTOM - TOP);
  let y = BOTTOM;
  const layers = parts.map((part) => {
    const y2 = y - ((BOTTOM - LIQUID_TOP) * part.count) / total;
    const pts = `${xl(y)},${y} ${xr(y)},${y} ${xr(y2)},${y2} ${xl(y2)},${y2}`;
    const layer = { pts, y2, color: part.color };
    y = y2;
    return layer;
  });
  const glass = `${xl(TOP)},${TOP} ${xr(TOP)},${TOP} ${xr(BOTTOM)},${BOTTOM} ${xl(BOTTOM)},${BOTTOM}`;
  return (
    <svg width={width} height={(width * 280) / 220} viewBox="0 0 220 280" role="img" aria-label={label}>
      <polygon points={glass} fill={p.paper} />
      {layers.map((l, i) => (
        <polygon key={i} points={l.pts} fill={l.color} />
      ))}
      {layers.slice(0, -1).map((l, i) => (
        <line key={i} x1={xl(l.y2)} y1={l.y2} x2={xr(l.y2)} y2={l.y2} stroke={p.ink} strokeWidth={3} />
      ))}
      <line x1={xl(LIQUID_TOP)} y1={LIQUID_TOP} x2={xr(LIQUID_TOP)} y2={LIQUID_TOP} stroke={p.ink} strokeWidth={3} />
      <rect x={74} y={74} width={30} height={30} rx={7} fill={p.paper} fillOpacity={0.6} stroke={p.ink} strokeWidth={3} transform="rotate(-14 89 89)" />
      <rect x={108} y={84} width={26} height={26} rx={6} fill={p.paper} fillOpacity={0.6} stroke={p.ink} strokeWidth={3} transform="rotate(10 121 97)" />
      <line x1={132} y1={236} x2={164} y2={18} stroke={p.ink} strokeWidth={15} strokeLinecap="round" />
      <line x1={132} y1={236} x2={164} y2={18} stroke={p.accent} strokeWidth={8} strokeLinecap="round" />
      <polygon points={glass} fill="none" stroke={p.ink} strokeWidth={6} strokeLinejoin="round" />
      <circle cx={46} cy={58} r={24} fill={p.spark} stroke={p.ink} strokeWidth={4} />
      <circle cx={46} cy={58} r={14} fill="none" stroke={p.ink} strokeWidth={2.5} />
      <line x1={32} y1={58} x2={60} y2={58} stroke={p.ink} strokeWidth={2.5} />
      <line x1={46} y1={44} x2={46} y2={72} stroke={p.ink} strokeWidth={2.5} />
    </svg>
  );
}

/** Round pizza, one slice per interest sized by its share. */
function Pizza({ parts, total, p, width, label }: ShapeProps) {
  const C = 130;
  const R = 100;
  const at = (a: number, r: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  let a = -Math.PI / 2;
  const slices = parts.map((part) => {
    const span = (2 * Math.PI * part.count) / total;
    const [x1, y1] = at(a, R);
    const [x2, y2] = at(a + span, R);
    const d = `M${C},${C} L${x1},${y1} A${R},${R} 0 ${span > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`;
    const slice = { d, start: a, span, color: part.color };
    a += span;
    return slice;
  });
  const single = slices.length === 1;
  return (
    <svg width={width} height={width} viewBox="0 0 260 260" role="img" aria-label={label}>
      <circle cx={C} cy={C} r={118} fill={p.spark} stroke={p.ink} strokeWidth={6} />
      {slices.map((s, i) =>
        single ? <circle key={i} cx={C} cy={C} r={R} fill={s.color} /> : <path key={i} d={s.d} fill={s.color} />
      )}
      {!single &&
        slices.map((s, i) => {
          const [x, y] = at(s.start, 118);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={p.ink} strokeWidth={4} strokeLinecap="round" />;
        })}
      {slices.flatMap((s, i) => {
        const mid = s.start + s.span / 2;
        const spots = s.span > 1.2 ? [[mid - s.span / 5, 70], [mid + s.span / 6, 42], [mid, 82]] : s.span > 0.6 ? [[mid, 70], [mid, 40]] : [[mid, 66]];
        return spots.map(([ang, r], j) => {
          const [x, y] = at(ang!, r!);
          return <circle key={`${i}-${j}`} cx={x} cy={y} r={8} fill={p.paper} fillOpacity={0.7} stroke={p.ink} strokeWidth={2.5} />;
        });
      })}
      <circle cx={C} cy={C} r={R} fill="none" stroke={p.ink} strokeWidth={4} />
    </svg>
  );
}
