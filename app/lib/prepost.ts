// Laporan selisih pre/post: per peserta dan per topik. Murni (tanpa database) supaya mudah diuji.
export type TopicScore = { skill?: string | null; topic?: string | null; correct?: number | null; total?: number | null };
export type AttemptLite = { userId: string; scoreEst?: number | null; topicScores?: TopicScore[] | null; finishedAt?: Date | null };
export type PrePostRow = {
  userId: string; pre: number | null; post: number | null; delta: number | null;
  topics: { skill: string; topic: string; pre: number | null; post: number | null; delta: number | null }[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const key = (t: TopicScore) => `${t.skill ?? ""}\u0000${t.topic ?? ""}`;

/** Percobaan terbaik (skor tertinggi) per peserta; dasar perbandingan agar satu kali gagal tidak menutupi hasil sebenarnya. */
export function bestPerUser(list: AttemptLite[]) {
  const best = new Map<string, AttemptLite>();
  for (const a of list) {
    if (a.scoreEst == null) continue;
    const cur = best.get(a.userId);
    if (!cur || (a.scoreEst ?? 0) > (cur.scoreEst ?? 0)) best.set(a.userId, a);
  }
  return best;
}

const topicPct = (a: AttemptLite | undefined) => new Map((a?.topicScores ?? []).filter((t) => (t.total ?? 0) > 0).map((t) => [key(t), { t, pct: r1(((t.correct ?? 0) / t.total!) * 100) }]));

export function buildPrePost(pre: AttemptLite[], post: AttemptLite[]) {
  const bp = bestPerUser(pre), bq = bestPerUser(post);
  const rows: PrePostRow[] = [...new Set([...bp.keys(), ...bq.keys()])].map((userId) => {
    const a = bp.get(userId), b = bq.get(userId);
    const ta = topicPct(a), tb = topicPct(b);
    const topics = [...new Set([...ta.keys(), ...tb.keys()])].map((k) => {
      const x = ta.get(k), y = tb.get(k), ref = (x ?? y)!.t;
      return { skill: ref.skill ?? "", topic: ref.topic ?? "", pre: x?.pct ?? null, post: y?.pct ?? null, delta: x && y ? r1(y.pct - x.pct) : null };
    }).sort((p, q) => (p.delta ?? 0) - (q.delta ?? 0));
    return { userId, pre: a?.scoreEst ?? null, post: b?.scoreEst ?? null, delta: a && b ? r1((b.scoreEst ?? 0) - (a.scoreEst ?? 0)) : null, topics };
  });
  // Ringkasan kohort: hanya peserta yang punya kedua hasil.
  const both = rows.filter((r) => r.delta !== null);
  const avg = (f: (r: PrePostRow) => number) => (both.length ? r1(both.reduce((n, r) => n + f(r), 0) / both.length) : null);
  const byTopic = new Map<string, { skill: string; topic: string; pre: number[]; post: number[] }>();
  for (const r of both) for (const t of r.topics) {
    if (t.pre === null || t.post === null) continue;
    const e = byTopic.get(`${t.skill}\u0000${t.topic}`) ?? { skill: t.skill, topic: t.topic, pre: [], post: [] };
    e.pre.push(t.pre); e.post.push(t.post); byTopic.set(`${t.skill}\u0000${t.topic}`, e);
  }
  const mean = (a: number[]) => r1(a.reduce((n, x) => n + x, 0) / a.length);
  const topics = [...byTopic.values()].map((e) => ({ skill: e.skill, topic: e.topic, n: e.pre.length, pre: mean(e.pre), post: mean(e.post), delta: r1(mean(e.post) - mean(e.pre)) })).sort((x, y) => x.delta - y.delta);
  return {
    rows,
    summary: { participants: rows.length, withBoth: both.length, avgPre: avg((r) => r.pre!), avgPost: avg((r) => r.post!), avgDelta: avg((r) => r.delta!), improved: both.filter((r) => r.delta! > 0).length, declined: both.filter((r) => r.delta! < 0).length },
    topics,
  };
}
