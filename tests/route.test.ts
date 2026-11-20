import { planRoute, locOf, travel, ROUTE } from "../lib/route.ts";
type R = { id: number; flat: string; age_min: number };
const show = (title: string, p: ReturnType<typeof planRoute<R>>) => {
  console.log("\n" + title);
  for (const x of p) console.log(`  #${x.position} ${x.item.flat.padEnd(6)} waited ${String(x.item.age_min).padStart(3)}m  starts in ~${String(x.etaMin).padStart(3)}m  (total ~${x.item.age_min + x.etaMin}m)  ${x.reason}`);
};
let ok = true; const expect = (c: boolean, m: string) => { if (!c) ok = false; console.log(`  ${c ? "✓" : "✗"} ${m}`); };

// 1) Your example: worker busy in A-10I; requests arrive B-8J, then A-14H, then A-10A
const ex: R[] = [{ id: 1, flat: "B-8J", age_min: 15 }, { id: 2, flat: "A-14H", age_min: 10 }, { id: 3, flat: "A-10A", age_min: 5 }];
const p1 = planRoute(ex, locOf("A-10I")); show("Example — worker at A-10I", p1);
expect(p1.map((x) => x.item.flat).join(" → ") === "A-10A → A-14H → B-8J", "order is A-10A → A-14H → B-8J");

// 2) B-8J has already waited 100 min -> it must go first even though it is in the other block
const p2 = planRoute([{ ...ex[0], age_min: 100 }, ex[1], ex[2]], locOf("A-10I")); show("B-8J already waited 100 min", p2);
expect(p2[0].item.flat === "B-8J", "long-waiting B-8J goes first");

// 3) Starvation: B-12C asked first, then 12 neighbours of the worker keep asking
const stream: R[] = [{ id: 100, flat: "B-12C", age_min: 12 }];
for (let i = 0; i < 12; i++) stream.push({ id: i + 1, flat: `A-${10 + (i % 3)}${"ABCDEFGHIJKL"[i]}`, age_min: 11 - i });
const p3 = planRoute(stream, locOf("A-10I")); show("Starvation test — first 5 of 13", p3.slice(0, 5));
const far = p3.find((x) => x.item.flat === "B-12C")!;
expect(far.item.age_min + far.etaMin <= ROUTE.MAX_WAIT_MIN, `B-12C is not pushed to the end: starts at #${far.position}, total wait ~${far.item.age_min + far.etaMin} min (limit ${ROUTE.MAX_WAIT_MIN})`);

// 4) Worker location unknown -> oldest first
const p4 = planRoute(ex, null); show("Worker location unknown", p4);
expect(p4[0].item.flat === "B-8J", "falls back to oldest first");

// 5) 20,000 random queues: per-resident fairness + efficiency vs plain FIFO
const rand = (n: number) => Math.random() * n | 0;
let personal = 0, capBreaks = 0, smartTravel = 0, fifoTravel = 0;
for (let run = 0; run < 20000; run++) {
  const q: R[] = Array.from({ length: 2 + rand(6) }, (_, i) => ({ id: i + 1, flat: `${"AB"[rand(2)]}-${rand(16) || "G"}${"ABCDEFGHIJ"[rand(10)]}`, age_min: rand(60) }));
  const start = locOf(`${"AB"[rand(2)]}-${rand(16) || "G"}A`);
  const fifo = [...q].sort((a, b) => b.age_min - a.age_min || a.id - b.id);
  let here = start, t = 0, fifoWorst = 0; const fifoStart = new Map<number, number>();
  for (const x of fifo) { const l = locOf(x.flat)!; const m = travel(here, l); fifoTravel += m; t += m; fifoStart.set(x.id, x.age_min + t); fifoWorst = Math.max(fifoWorst, x.age_min + t); t += ROUTE.DEFAULT_JOB_MIN; here = l; }
  const smart = planRoute(q, start);
  here = start; for (const x of smart) { const l = locOf(x.item.flat)!; smartTravel += travel(here, l); here = l; }
  const smartWorst = Math.max(...smart.map((x) => x.item.age_min + x.etaMin));
  if (fifoWorst <= ROUTE.MAX_WAIT_MIN && smartWorst > ROUTE.MAX_WAIT_MIN + 0.6) capBreaks++;
  for (const x of smart) if (x.item.age_min + x.etaMin > Math.max(ROUTE.MAX_WAIT_MIN, fifoStart.get(x.item.id)!) + 0.6) personal++;
}
console.log("\n20,000 random queues (2–7 jobs, waits 0–59 min, worker anywhere):");
expect(capBreaks === 0, `never breaks the ${ROUTE.MAX_WAIT_MIN}-min limit when first-come-first-served would keep it (${capBreaks} cases)`);
expect(personal === 0, `no resident ever waits longer than max(${ROUTE.MAX_WAIT_MIN} min, their first-come-first-served turn) (${personal} cases)`);
console.log(`  lift + walking time: ${Math.round(100 - (100 * smartTravel) / fifoTravel)}% less than first-come-first-served`);
console.log(ok ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED"); if (!ok) process.exit(1);
