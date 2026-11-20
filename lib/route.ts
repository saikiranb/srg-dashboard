// Smart job order for the electrician / plumber.
//
// Plain first-come-first-served makes the worker zig-zag between blocks and floors. Instead we plan a route:
//
//   1. Start where the worker is: the flat currently "In Progress" (or the one just closed in the last 90 min).
//   2. Repeatedly pick the next job with the lowest score:
//         score = travel time from the current flat  −  AGING × minutes the resident has waited
//      travel: same floor = 0, same block = lift wait + per-floor time, other block = down + walk + up.
//      AGING makes every waiting minute count, so older requests steadily move up.
//   3. Fairness guarantee: every request gets a deadline = the later of MAX_WAIT and the time it would have
//      started under plain first-come-first-served. A convenient job is only taken if, after it, everyone left
//      can still be reached oldest-first by their deadline; otherwise the oldest request goes next.
//      => nobody waits past the limit because of the optimisation, and nobody is ever later than under FIFO
//         unless they are still inside the limit.
//   4. If we don't know where the worker is, start with the oldest request.
//
// The plan simulates time (job duration + travel) so the limit is checked against the *expected* start time,
// and every request gets an ETA. The order is a suggestion: staff can still attend any job.

export const ROUTE = {
  MAX_WAIT_MIN: 120,     // nobody should wait longer than this for work to start (if the queue allows it)
  AGING_PER_MIN: 0.15,   // each minute waited is worth 0.15 min of travel (40 min waiting ≈ a 6-min detour)
  FLOOR_MIN: 0.5,        // lift time per floor
  LIFT_WAIT_MIN: 2,      // waiting for the lift whenever floors change
  BLOCK_WALK_MIN: 5,     // walking between blocks
  DEFAULT_JOB_MIN: 25,   // used until there is enough history to measure the real average
} as const;

export type Loc = { block: string; floor: number };

export function locOf(flat: string): Loc | null {
  const m = /^([A-Z])-(G|\d{1,2})[A-Z]$/.exec(flat);
  return m ? { block: m[1], floor: m[2] === "G" ? 0 : Number(m[2]) } : null;
}

const toFloor = (f: number) => (f > 0 ? ROUTE.LIFT_WAIT_MIN + f * ROUTE.FLOOR_MIN : 0);

export function travel(from: Loc | null, to: Loc): number {
  if (!from) return 0;
  if (from.block === to.block) {
    const d = Math.abs(from.floor - to.floor);
    return d === 0 ? 0 : ROUTE.LIFT_WAIT_MIN + d * ROUTE.FLOOR_MIN;
  }
  return toFloor(from.floor) + ROUTE.BLOCK_WALK_MIN + toFloor(to.floor);
}

function describe(from: Loc | null, to: Loc): string {
  if (!from) return "Oldest first";
  if (from.block !== to.block) return `Next block (${to.block})`;
  const d = to.floor - from.floor;
  if (d === 0) return "Same floor";
  return `Same block · ${Math.abs(d)} floor${Math.abs(d) > 1 ? "s" : ""} ${d > 0 ? "up" : "down"}`;
}

export type Planned<T> = { item: T; position: number; etaMin: number; reason: string; priority: boolean };

type Node<T> = { item: T; loc: Loc | null; deadline: number };
const olderFirst = <T extends { id: number; age_min: number }>(a: Node<T>, b: Node<T>) =>
  b.item.age_min - a.item.age_min || a.item.id - b.item.id;

// Do the remaining jobs strictly oldest-first from `here` at time `t`; returns the start wait of each job.
function oldestFirst<T extends { id: number; age_min: number }>(nodes: Node<T>[], here: Loc | null, t: number, jobMin: number) {
  const starts = new Map<Node<T>, number>();
  for (const n of [...nodes].sort(olderFirst)) {
    t += n.loc ? travel(here, n.loc) : 0;
    starts.set(n, n.item.age_min + t);
    t += jobMin;
    if (n.loc) here = n.loc;
  }
  return starts;
}

export function planRoute<T extends { id: number; flat: string; age_min: number }>(
  pending: T[], start: Loc | null, jobMin: number = ROUTE.DEFAULT_JOB_MIN,
  busyFor = 0, // minutes until the worker finishes the current job
): Planned<T>[] {
  const left: Node<T>[] = pending.map((item) => ({ item, loc: locOf(item.flat), deadline: 0 }));
  // per-request deadline: the cap, or its first-come-first-served start if the queue is too long for the cap
  for (const [n, w] of oldestFirst(left, start, busyFor, jobMin)) n.deadline = Math.max(ROUTE.MAX_WAIT_MIN, w);

  const out: Planned<T>[] = [];
  let here = start;
  let t = busyFor; // minutes from now (simulated)
  while (left.length) {
    const score = (n: Node<T>) => (n.loc ? travel(here, n.loc) : 0) - ROUTE.AGING_PER_MIN * (n.item.age_min + t);
    const byScore = [...left].sort((a, b) => score(a) - score(b) || olderFirst(a, b));
    const oldest = [...left].sort(olderFirst)[0];

    // Most convenient job whose choice still lets everyone else start by their deadline (checked oldest-first).
    let pick = oldest;
    for (const c of byScore) {
      const move = c.loc ? travel(here, c.loc) : 0;
      if (c.item.age_min + t + move > c.deadline + 1e-9) continue;
      const rest = oldestFirst(left.filter((n) => n !== c), c.loc ?? here, t + move + jobMin, jobMin);
      if ([...rest].every(([n, w]) => w <= n.deadline + 1e-9)) { pick = c; break; }
    }
    const priority = pick !== byScore[0]; // distance alone would have chosen something else
    const move = pick.loc ? travel(here, pick.loc) : 0;
    out.push({
      item: pick.item, position: out.length + 1, etaMin: Math.round(t + move), priority,
      reason: priority ? `Waiting ${Math.round(pick.item.age_min + t)} min — priority` : !here || !pick.loc ? "Oldest first" : describe(here, pick.loc),
    });
    t += move + jobMin;
    if (pick.loc) here = pick.loc;
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}
