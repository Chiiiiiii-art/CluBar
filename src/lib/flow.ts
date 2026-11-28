// Task-level timing for the usability baseline (audit P0-2).
// A flow is one task, e.g. "student lands → RSVPs" or "officer starts an event → publishes it".
// The id is random, lives in sessionStorage for 30 minutes, and is never linked to an account.

export type FlowKind = 'student_rsvp' | 'officer_publish';

const TTL_MS = 30 * 60 * 1000;
const key = (kind: FlowKind) => `clubar_flow_${kind}`;

interface StoredFlow {
  id: string;
  start: number;
}

function read(kind: FlowKind): StoredFlow | null {
  try {
    const raw = window.sessionStorage.getItem(key(kind));
    if (!raw) return null;
    const flow = JSON.parse(raw) as StoredFlow;
    if (typeof flow.id !== 'string' || typeof flow.start !== 'number') return null;
    if (Date.now() - flow.start > TTL_MS) {
      window.sessionStorage.removeItem(key(kind));
      return null;
    }
    return flow;
  } catch {
    return null;
  }
}

function send(body: Record<string, unknown>): void {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/** Start a flow unless one of this kind is already running. Safe to call on every mount. */
export function startFlow(kind: FlowKind, surface: string): void {
  if (typeof window === 'undefined' || read(kind)) return;
  const flow: StoredFlow = { id: crypto.randomUUID(), start: Date.now() };
  try {
    window.sessionStorage.setItem(key(kind), JSON.stringify(flow));
  } catch {
    return;
  }
  send({ event_type: 'flow_start', flow_id: flow.id, source_surface: `${kind}:${surface}`.slice(0, 40) });
}

/** Finish the running flow of this kind (no-op if none) and report elapsed time. */
export function completeFlow(
  kind: FlowKind,
  opts: { surface: string; clubId?: string | null; targetId?: string | null }
): void {
  if (typeof window === 'undefined') return;
  const flow = read(kind);
  if (!flow) return;
  window.sessionStorage.removeItem(key(kind));
  send({
    event_type: 'flow_done',
    flow_id: flow.id,
    flow_elapsed_ms: Math.max(0, Date.now() - flow.start),
    club_id: opts.clubId ?? null,
    target_id: opts.targetId ?? null,
    source_surface: `${kind}:${opts.surface}`.slice(0, 40),
  });
}
