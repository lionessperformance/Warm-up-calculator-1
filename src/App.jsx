import React, { useMemo, useState, useEffect } from "react";

const roundTo = (val, step) => (isNaN(val) ? 0 : Math.round(val / step) * step);

export default function App() {
  const [lift, setLift] = useState("Squat");
  const [unit] = useState("kg");
  const [barWeight, setBarWeight] = useState(20);
  const [rounding, setRounding] = useState(2.5);

  const [quickRepsPattern, setQuickRepsPattern] = useState("3x6");
  const [lastWeekWeights, setLastWeekWeights] = useState("60, 62.5, 65");
  const [felt, setFelt] = useState("solid");
  const [progressionMode, setProgressionMode] = useState("kg");

  const defaultKgIncrements = useMemo(
    () => (lift === "Bench"
      ? { easy: 2.5, solid: 1.25, hard: 0, missed: -1.25 }
      : { easy: 5, solid: 2.5, hard: 0, missed: -2.5 }),
    [lift]
  );
  const [kgInc, setKgInc] = useState(defaultKgIncrements);
  useEffect(() => setKgInc(defaultKgIncrements), [defaultKgIncrements]);
  const [pctInc, setPctInc] = useState({ easy: 5, solid: 2.5, hard: 0, missed: -2.5 });

  const [wuOffset, setWuOffset] = useState(7.5);
  const [superHeavy, setSuperHeavy] = useState(false);

  function parseSetsPattern(s) {
    const m = s.match(/^(\d+)\s*[xX]\s*(\d+)$/);
    if (m) {
      const sets = parseInt(m[1], 10);
      const reps = Array.from({ length: sets }, () => parseInt(m[2], 10));
      return { sets, reps };
    }
    const parts = s.split(/[,-]+/).map((t) => t.trim()).filter(Boolean);
    if (parts.every((p) => /^\d+$/.test(p))) {
      const reps = parts.map((p) => parseInt(p, 10));
      return { sets: reps.length, reps };
    }
    return { sets: 0, reps: [] };
  }

  const quickParsed = useMemo(() => parseSetsPattern(quickRepsPattern), [quickRepsPattern]);
  const lastWeights = useMemo(
    () => lastWeekWeights.split(/[\n,]+/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)),
    [lastWeekWeights]
  );

  const suggestionDelta = useMemo(() => {
    if (progressionMode === "kg") return kgInc[felt] ?? 0;
    const avg = lastWeights.length ? lastWeights.reduce((a, b) => a + b, 0) / lastWeights.length : 0;
    return roundTo((avg * (pctInc[felt] ?? 0)) / 100, rounding);
  }, [progressionMode, kgInc, pctInc, felt, lastWeights, rounding]);

  const suggestedWeights = useMemo(() => {
    const sets = quickParsed.sets || lastWeights.length;
    const baseArr = sets
      ? (lastWeights.length === sets ? lastWeights : Array.from({ length: sets }, (_, i) => lastWeights[i] ?? lastWeights[lastWeights.length - 1] ?? 0))
      : lastWeights;
    return baseArr.map((w) => roundTo((w ?? 0) + suggestionDelta, rounding));
  }, [quickParsed, lastWeights, suggestionDelta, rounding]);

  const firstWorking = suggestedWeights[0] || 0;

  function generateGymWarmups(firstSet, roundingStep, isHeavy, bar, offsetKg) {
    if (!firstSet) return [];
    const offset = Math.max(5, Math.min(10, offsetKg));
    const lastWU = roundTo(Math.max(bar, firstSet - offset), roundingStep);
    const s1 = roundTo(Math.max(bar, firstSet * 0.4), roundingStep);
    const s2 = roundTo(Math.max(bar, firstSet * 0.6), roundingStep);

    const seq = [
      { reps: 5, weight: s1 },
      { reps: 3, weight: s2 },
      { reps: 1, weight: lastWU }
    ];
    if (isHeavy) {
      const s3 = roundTo(Math.min(lastWU, Math.max(bar, firstSet * 0.82)), roundingStep);
      if (s3 < lastWU) seq.splice(2, 0, { reps: 1, weight: s3 });
    }
    return seq.sort((a, b) => a.weight - b.weight);
  }

  const autoWarmups = useMemo(
    () => generateGymWarmups(firstWorking, rounding, superHeavy, barWeight, wuOffset),
    [firstWorking, rounding, superHeavy, barWeight, wuOffset]
  );

  const header = `${lift} • ${unit.toUpperCase()}`;

  return (
    <div className="w-full min-h-screen bg-white text-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl md:text-3xl font-semibold brand-heading">Main Lift Warm‑Up & Working Set Calculator</h1>
          <span className="hidden md:inline-flex px-3 py-1 rounded-full text-xs brand-chip border brand-border">Lioness Performance</span>
        </div>
        <p className="text-sm text-gray-700 mb-6">
          Paste <strong>last week’s working weights</strong>, pick how it felt → we suggest <strong>this week</strong>. Warm‑ups: <strong>3 sets</strong> (unless heavy). Last warm‑up is <strong>5–10 kg below</strong> the first working set.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Lift</label>
            <select className="w-full border rounded-2xl p-2" value={lift} onChange={(e) => setLift(e.target.value)}>
              <option>Squat</option>
              <option>Bench</option>
              <option>Deadlift</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bar weight ({unit})</label>
            <input type="number" min={0} step={0.5} value={barWeight} onChange={(e) => setBarWeight(parseFloat(e.target.value))} className="w-full border rounded-2xl p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rounding increment ({unit})</label>
            <input type="number" min={0.25} step={0.25} value={rounding} onChange={(e) => setRounding(parseFloat(e.target.value))} className="w-full border rounded-2xl p-2" />
          </div>
        </div>

        <div className="border rounded-2xl p-4 mb-6 border-[color:var(--brand-soft)]">
          <h2 className="text-lg font-semibold mb-3">Quick mode</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Working sets reps</label>
              <input className="w-full border rounded-2xl p-2 font-mono" placeholder="3x6 or 6-6-6" value={quickRepsPattern} onChange={(e) => setQuickRepsPattern(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last week weights ({unit})</label>
              <input className="w-full border rounded-2xl p-2 font-mono" placeholder="60, 62.5, 65" value={lastWeekWeights} onChange={(e) => setLastWeekWeights(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">How did it feel?</label>
              <div className="flex flex-wrap gap-3 text-sm">
                {["easy","solid","hard","missed"].map((k) => (
                  <label key={k} className={`px-3 py-1 rounded-full cursor-pointer border ${felt===k?"brand-chip":"bg-white"}`}>
                    <input type="radio" name="felt" className="mr-2" checked={felt===k} onChange={() => setFelt(k)} />{k}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={superHeavy} onChange={(e)=>setSuperHeavy(e.target.checked)} />
              Super heavy today (adds an extra ramp)
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span>Last warm‑up offset</span>
              <input type="number" step={0.5} min={5} max={10} value={wuOffset} onChange={(e)=>setWuOffset(parseFloat(e.target.value)||7.5)} className="w-20 border rounded-xl p-1" />
              <span className="text-xs text-gray-600">kg under first working set</span>
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="border rounded-2xl p-3">
              <h3 className="font-semibold mb-2">Suggested working sets ({header})</h3>
              {suggestedWeights.length === 0 ? (
                <div className="text-sm text-gray-500">Add last week’s weights to get suggestions.</div>
              ) : (
                <ul className="space-y-2">
                  {suggestedWeights.map((w, i) => (
                    <li key={`sugg-${i}`} className="flex items-start justify-between bg-white rounded-xl p-2 border brand-border">
                      <div className="font-medium">
                        {(quickParsed.reps[i] ?? quickParsed.reps[0] ?? "?")} × {w.toFixed(1)} {unit}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border rounded-2xl p-3">
              <h3 className="font-semibold mb-2">Auto warm‑ups (gym standard)</h3>
              {autoWarmups.length === 0 ? (
                <div className="text-sm text-gray-500">Enter last week + feeling to see warm‑ups.</div>
              ) : (
                <ul className="space-y-2">
                  {autoWarmups.map((r, idx) => (
                    <li key={`auto-${idx}`} className="flex items-start justify-between bg-white rounded-xl p-2 border brand-border">
                      <div className="font-medium">{r.reps} × {r.weight.toFixed(1)} {unit}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
