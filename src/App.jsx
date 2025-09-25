import React, { useMemo, useState, useEffect } from "react";

// --- Helpers ---
const clamp = (n, min, max) => Math.min(Math.max(n ?? 0, min), max);
const roundTo = (val, step) => (isNaN(val) ? 0 : Math.round(val / step) * step);

function parseScheme(input) {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^(\d+)\s*[x@]\s*(\d+(?:\.\d+)?)\s*(%)?$/i);
      if (!m) return null;
      const reps = parseInt(m[1], 10);
      const num = parseFloat(m[2]);
      const isPercent = !!m[3];
      return { reps, value: num, isPercent, raw: tok };
    })
    .filter(Boolean);
}

function calcRows({ scheme, base, rounding, minLoad }) {
  return scheme
    .map((item) => {
      const weight = item.isPercent ? (base * item.value) / 100 : item.value;
      const rounded = roundTo(weight, rounding);
      return {
        display: `${item.reps} × ${rounded.toFixed(1)} kg`,
        reps: item.reps,
        weight: rounded,
        isPercent: item.isPercent,
        raw: item.raw
      };
    })
    .filter((r) => r.weight >= (minLoad ?? 0));
}

export default function App() {
  // --- Global ---
  const [lift, setLift] = useState("Squat");
  const [unit] = useState("kg");
  const [barWeight, setBarWeight] = useState(20);
  const [rounding, setRounding] = useState(2.5);

  // ---------- QUICK MODE (based on last week) ----------
  const [quickRepsPattern, setQuickRepsPattern] = useState("3x6"); // or "6-6-6"
  const [lastWeekWeights, setLastWeekWeights] = useState("60, 62.5, 65");
  const [felt, setFelt] = useState("solid"); // easy | solid | hard | missed
  const [progressionMode, setProgressionMode] = useState("kg"); // kg | percent

  const defaultKgIncrements = useMemo(
    () =>
      lift === "Bench"
        ? { easy: 2.5, solid: 1.25, hard: 0, missed: -1.25 }
        : { easy: 5, solid: 2.5, hard: 0, missed: -2.5 },
    [lift]
  );
  const [kgInc, setKgInc] = useState(defaultKgIncrements);
  useEffect(() => setKgInc(defaultKgIncrements), [defaultKgIncrements]);

  const [pctInc, setPctInc] = useState({
    easy: 5,
    solid: 2.5,
    hard: 0,
    missed: -2.5
  });

  function parseSetsPattern(s) {
    const rx = s.trim();
    const m = rx.match(/^(\d+)\s*[xX]\s*(\d+)$/);
    if (m) {
      const sets = parseInt(m[1], 10);
      const reps = Array.from({ length: sets }, () => parseInt(m[2], 10));
      return { sets, reps };
    }
    const parts = rx.split(/[,-]+/).map((t) => t.trim()).filter(Boolean);
    if (parts.every((p) => /^\d+$/.test(p))) {
      const reps = parts.map((p) => parseInt(p, 10));
      return { sets: reps.length, reps };
    }
    return { sets: 0, reps: [] };
  }

  const quickParsed = useMemo(
    () => parseSetsPattern(quickRepsPattern),
    [quickRepsPattern]
  );
  const lastWeights = useMemo(
    () =>
      lastWeekWeights
        .split(/[\n,]+/)
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n)),
    [lastWeekWeights]
  );

  const suggestionDelta = useMemo(() => {
    if (progressionMode === "kg") return kgInc[felt] ?? 0;
    const avg = lastWeights.length
      ? lastWeights.reduce((a, b) => a + b, 0) / lastWeights.length
      : 0;
    return roundTo((avg * (pctInc[felt] ?? 0)) / 100, rounding);
  }, [progressionMode, kgInc, pctInc, felt, lastWeights, rounding]);

  const suggestedWeights = useMemo(() => {
    const sets = quickParsed.sets || lastWeights.length;
    const baseArr = sets
      ? lastWeights.length === sets
        ? lastWeights
        : Array.from({ length: sets }, (_, i) => lastWeights[i] ?? lastWeights[lastWeights.length - 1] ?? 0)
      : lastWeights;
    return baseArr.map((w) => roundTo((w ?? 0) + suggestionDelta, rounding));
  }, [quickParsed, lastWeights, suggestionDelta, rounding]);

  const topSuggested = useMemo(
    () => suggestedWeights.reduce((m, v) => (v > m ? v : m), 0),
    [suggestedWeights]
  );

  function makeWarmupsFromTop(top) {
    if (!top) return [];
    const seq = [
      { reps: 5, pct: 40 },
      { reps: 4, pct: 50 },
      { reps: 3, pct: 60 },
      { reps: 2, pct: 70 }
    ];
    return seq.map((s) => ({
      reps: s.reps,
      weight: roundTo((top * s.pct) / 100, rounding)
    }));
  }
  const autoWarmups = useMemo(
    () => makeWarmupsFromTop(topSuggested),
    [topSuggested, rounding]
  );

  // ---------- OPTIONAL: simple manual fields ----------
  const [useOneRM] = useState(false);
  const [warmupInput, setWarmupInput] = useState("5x30, 4x40, 3x50");
  const [workInput, setWorkInput] = useState("6x55, 6x60, 6x65");

  const warmParsed = useMemo(() => parseScheme(warmupInput), [warmupInput]);
  const workParsed = useMemo(() => parseScheme(workInput), [workInput]);
  const trainingMax = topSuggested || 60;
  const baseForPercent = useMemo(() => trainingMax, [trainingMax]);

  const warmRows = useMemo(
    () => calcRows({ scheme: warmParsed, base: baseForPercent, rounding, minLoad: 0 }),
    [warmParsed, baseForPercent, rounding]
  );
  const workRows = useMemo(
    () => calcRows({ scheme: workParsed, base: baseForPercent, rounding, minLoad: 0 }),
    [workParsed, baseForPercent, rounding]
  );

  function plateBreakdown(total, bar = barWeight) {
    const perSide = (total - bar) / 2;
    if (perSide <= 0) return [];
    const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
    const out = [];
    let rem = perSide;
    for (const p of plates) {
      const count = Math.floor(rem / p);
      if (count > 0) {
        out.push(`${count} × ${p}${unit}`);
        rem = +(rem - count * p).toFixed(3);
      }
    }
    return out;
  }

  const header = `${lift} • ${unit.toUpperCase()}`;

  return (
    <div className="w-full min-h-screen bg-white text-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">
          Main Lift Warm-Up & Working Set Calculator
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Paste <strong>last week’s working weights</strong>, pick how it felt,
          and we’ll suggest <strong>this week</strong> + auto warm-ups.
        </p>

        {/* Global controls */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="col-span-3 md:col-span-1">
            <label className="block text-sm font-medium mb-1">Lift</label>
            <select className="w-full border rounded-2xl p-2" value={lift} onChange={(e) => setLift(e.target.value)}>
              <option>Squat</option>
              <option>Bench</option>
              <option>Deadlift</option>
              <option>Other</option>
            </select>
          </div>
          <div className="col-span-3 md:col-span-1">
            <label className="block text-sm font-medium mb-1">Bar weight ({unit})</label>
            <input type="number" min={0} step={0.5} value={barWeight} onChange={(e) => setBarWeight(parseFloat(e.target.value))} className="w-full border rounded-2xl p-2" />
          </div>
          <div className="col-span-3 md:col-span-1">
            <label className="block text-sm font-medium mb-1">Rounding increment ({unit})</label>
            <input type="number" min={0.25} step={0.25} value={rounding} onChange={(e) => setRounding(parseFloat(e.target.value))} className="w-full border rounded-2xl p-2" />
          </div>
        </div>

        {/* QUICK MODE */}
        <div className="border rounded-2xl p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Quick mode: Start from last week</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Working sets reps</label>
              <input className="w-full border rounded-2xl p-2 font-mono" placeholder="3x6 or 6-6-6" value={quickRepsPattern} onChange={(e) => setQuickRepsPattern(e.target.value)} />
              <p className="text-xs text-gray-600 mt-1">Use <span className="font-mono">sets x reps</span> or a dash list.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last week weights ({unit})</label>
              <input className="w-full border rounded-2xl p-2 font-mono" placeholder="60, 62.5, 65" value={lastWeekWeights} onChange={(e) => setLastWeekWeights(e.target.value)} />
              <p className="text-xs text-gray-600 mt-1">Comma or newline separated; match number of sets.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">How did it feel?</label>
              <div className="flex flex-wrap gap-3 text-sm">
                {["easy","solid","hard","missed"].map((k) => (
                  <label key={k} className={`px-3 py-1 border rounded-full cursor-pointer ${felt===k?"bg-gray-100":""}`}>
                    <input type="radio" name="felt" className="mr-2" checked={felt===k} onChange={() => setFelt(k)} />{k}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Progression rule</label>
              <div className="flex items-center gap-4 mb-2 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={progressionMode==="kg"} onChange={()=>setProgressionMode("kg")} />by kg</label>
                <label className="flex items-center gap-2"><input type="radio" checked={progressionMode==="percent"} onChange={()=>setProgressionMode("percent")} />by %</label>
              </div>
              {progressionMode === "kg" ? (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {["easy","solid","hard","missed"].map((k) => (
                    <div key={k}>
                      <label className="block capitalize mb-1">{k}</label>
                      <input type="number" step={0.25} className="w-full border rounded-xl p-1" value={kgInc[k]} onChange={(e)=>setKgInc({...kgInc, [k]: parseFloat(e.target.value)})} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {["easy","solid","hard","missed"].map((k) => (
                    <div key={k}>
                      <label className="block capitalize mb-1">{k} %</label>
                      <input type="number" step={0.25} className="w-full border rounded-xl p-1" value={pctInc[k]} onChange={(e)=>setPctInc({...pctInc, [k]: parseFloat(e.target.value)})} />
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600 mt-2">Tip: Bench jumps smaller than squat/deadlift. Defaults auto-adjust by lift.</p>
            </div>
          </div>

          {/* Suggested output */}
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="border rounded-2xl p-3">
              <h3 className="font-semibold mb-2">Suggested working sets ({header})</h3>
              {suggestedWeights.length === 0 ? (
                <div className="text-sm text-gray-500">Add last week’s weights to get suggestions.</div>
              ) : (
                <ul className="space-y-2">
                  {suggestedWeights.map((w, i) => (
                    <li key={`sugg-${i}`} className="flex items-start justify-between bg-gray-50 rounded-xl p-2">
                      <div className="font-medium">
                        {(quickParsed.reps[i] ?? quickParsed.reps[0] ?? "?")} × {w.toFixed(1)} {unit}
                      </div>
                      <div className="text-xs text-gray-600 text-right">
                        <div>per-side: {((w - barWeight) / 2).toFixed(1)} {unit}</div>
                        <div className="opacity-80">{plateBreakdown(w).join("  ·  ")}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border rounded-2xl p-3">
              <h3 className="font-semibold mb-2">Auto warm-ups from top set</h3>
              {autoWarmups.length === 0 ? (
                <div className="text-sm text-gray-500">Enter last week + feeling to see warm-ups.</div>
              ) : (
                <ul className="space-y-2">
                  {autoWarmups.map((r, idx) => (
                    <li key={`auto-${idx}`} className="flex items-start justify-between bg-gray-50 rounded-xl p-2">
                      <div className="font-medium">{r.reps} × {r.weight.toFixed(1)} {unit}</div>
                      <div className="text-xs text-gray-600 text-right">
                        <div>per-side: {((r.weight - barWeight) / 2).toFixed(1)} {unit}</div>
                        <div className="opacity-80">{plateBreakdown(r.weight).join("  ·  ")}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* OPTIONAL: simple manual box for kg/% if you want it */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="border rounded-2xl p-4">
            <span className="text-sm font-medium">Manual warm-ups (optional)</span>
            <div className="grid grid-cols-1 gap-3 mt-2">
              <div>
                <label className="block text-sm font-medium mb-1">WARM-UPS</label>
                <textarea rows={3} className="w-full border rounded-2xl p-2 font-mono" value={warmupInput} onChange={(e) => setWarmupInput(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WORKING SETS</label>
                <textarea rows={3} className="w-full border rounded-2xl p-2 font-mono" value={workInput} onChange={(e) => setWorkInput(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="border rounded-2xl p-4">
              <h2 className="text-lg font-semibold mb-3">{header}: Warm-ups (manual)</h2>
              {warmRows.length === 0 ? (
                <div className="text-sm text-gray-500">No warm-ups to show yet.</div>
              ) : (
                <ul className="space-y-2">
                  {warmRows.map((r, idx) => (
                    <li key={`wup-${idx}`} className="flex items-start justify-between bg-gray-50 rounded-xl p-2">
                      <div className="font-medium">{r.display}</div>
                      <div className="text-xs text-gray-600 text-right">
                        <div>per-side: {((r.weight - barWeight) / 2).toFixed(1)} {unit}</div>
                        <div className="opacity-80">{plateBreakdown(r.weight).join("  ·  ")}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border rounded-2xl p-4">
              <h2 className="text-lg font-semibold mb-3">{header}: Working sets (manual)</h2>
              {workRows.length === 0 ? (
                <div className="text-sm text-gray-500">No working sets to show yet.</div>
              ) : (
                <ul className="space-y-2">
                  {workRows.map((r, idx) => (
                    <li key={`work-${idx}`} className="flex items-start justify-between bg-gray-50 rounded-xl p-2">
                      <div className="font-medium">{r.display}</div>
                      <div className="text-xs text-gray-600 text-right">
                        <div>per-side: {((r.weight - barWeight) / 2).toFixed(1)} {unit}</div>
                        <div className="opacity-80">{plateBreakdown(r.weight).join("  ·  ")}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p className="mb-2 font-medium">Notes</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Quick mode: paste last week, choose how it felt → we propose this week + auto warm-ups.</li>
            <li>Adjust rounding to match your smallest plates (e.g., 1.25 or 2.5).</li>
            <li>Per-side and plate suggestions include the bar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
