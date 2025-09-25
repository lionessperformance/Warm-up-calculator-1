import React, { useMemo, useState } from "react";

// --- Helpers ---
const clamp = (n, min, max) => Math.min(Math.max(n ?? 0, min), max);
const roundTo = (val, step) => (isNaN(val) ? 0 : Math.round(val / step) * step);

function parseScheme(input) {
  // Accepts comma / newline separated tokens like:
  //  "5x30" (kg), "5 x 30", "5x75%" (percent of base), "5@75%", "6x 62.5" etc.
  // Returns array: [{ reps, raw, isPercent, value }]
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

function calcRows({
  scheme, // parsed array
  base, // base weight (either 1RM, TM, or top set) used when items are %
  rounding, // e.g., 2.5
  minLoad, // minimum load to show (>= bar weight)
}) {
  return scheme.map((item) => {
    const weight = item.isPercent ? (base * item.value) / 100 : item.value;
    const rounded = roundTo(weight, rounding);
    return {
      display: `${item.reps} × ${rounded.toFixed(1)} kg`,
      reps: item.reps,
      weight: rounded,
      isPercent: item.isPercent,
      raw: item.raw,
    };
  }).filter((r) => r.weight >= (minLoad ?? 0));
}

export default function LiftCalculator() {
  // --- State ---
  const [lift, setLift] = useState("Squat");
  const [unit] = useState("kg"); // built for kg by request
  const [barWeight, setBarWeight] = useState(20);
  const [rounding, setRounding] = useState(2.5);

  const [useOneRM, setUseOneRM] = useState(true);
  const [oneRM, setOneRM] = useState(80);
  const [trainingMaxPct, setTrainingMaxPct] = useState(90);
  const [topSet, setTopSet] = useState(60);

  const [warmupInput, setWarmupInput] = useState("5x30, 4x40, 3x50");
  const [workInput, setWorkInput] = useState("6x55, 6x60, 6x65");

  const trainingMax = useMemo(() => (useOneRM ? (oneRM * trainingMaxPct) / 100 : topSet), [useOneRM, oneRM, trainingMaxPct, topSet]);

  // Auto-generate warm-ups based on top working set (or TM if using 1RM)
  const generateWarmups = (style) => {
    const base = trainingMax;
    // Common progressions
    const styles = {
      "30-40-50": [
        { reps: 5, pct: 30 },
        { reps: 4, pct: 40 },
        { reps: 3, pct: 50 },
      ],
      "40-50-60-70": [
        { reps: 5, pct: 40 },
        { reps: 4, pct: 50 },
        { reps: 3, pct: 60 },
        { reps: 2, pct: 70 },
      ],
      "Bar-30-50-70": [
        { reps: 8, pct: (barWeight / base) * 100 },
        { reps: 5, pct: 30 },
        { reps: 3, pct: 50 },
        { reps: 1, pct: 70 },
      ],
    };
    const seq = styles[style] || styles["40-50-60-70"];
    const text = seq
      .map((s) => `${s.reps}x${Math.max(0, Math.round(s.pct))}%`)
      .join(", ");
    setWarmupInput(text);
  };

  const warmParsed = useMemo(() => parseScheme(warmupInput), [warmupInput]);
  const workParsed = useMemo(() => parseScheme(workInput), [workInput]);

  const baseForPercent = useMemo(() => {
    // When items are %, we use Training Max (90% of 1RM by default) OR the user-provided top set mode
    return trainingMax;
  }, [trainingMax]);

  const warmRows = useMemo(
    () =>
      calcRows({
        scheme: warmParsed,
        base: baseForPercent,
        rounding,
        minLoad: 0,
      }),
    [warmParsed, baseForPercent, rounding]
  );

  const workRows = useMemo(
    () =>
      calcRows({
        scheme: workParsed,
        base: baseForPercent,
        rounding,
        minLoad: 0,
      }),
    [workParsed, baseForPercent, rounding]
  );

  // Plate math (optional, quick take)
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
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Main Lift Warm‑Up & Working Set Calculator</h1>
        <p className="text-sm text-gray-600 mb-6">Type schemes like <span className="font-mono">5x30</span> (kg) or <span className="font-mono">5x75%</span> (percent of Training Max / Top Set). Use commas or new lines. Rounds to nearest increment.</p>

        {/* Controls */}
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

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Load base</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="base" checked={useOneRM} onChange={() => setUseOneRM(true)} />
                  1RM → TM
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="base" checked={!useOneRM} onChange={() => setUseOneRM(false)} />
                  Top working set (kg)
                </label>
              </div>
            </div>

            {useOneRM ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Estimated 1RM ({unit})</label>
                  <input type="number" min={0} step={0.5} value={oneRM} onChange={(e) => setOneRM(parseFloat(e.target.value))} className="w-full border rounded-2xl p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Training max %</label>
                  <input type="number" min={50} max={100} step={1} value={trainingMaxPct} onChange={(e) => setTrainingMaxPct(clamp(parseFloat(e.target.value), 50, 100))} className="w-full border rounded-2xl p-2" />
                </div>
                <div className="col-span-2 text-xs text-gray-600">We’ll calculate percentages from TM (default 90% of 1RM). Adjust if you program differently.</div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">Top working set ({unit})</label>
                <input type="number" min={0} step={0.5} value={topSet} onChange={(e) => setTopSet(parseFloat(e.target.value))} className="w-full border rounded-2xl p-2" />
                <div className="text-xs text-gray-600 mt-1">Percent-based entries (e.g., 6x80%) will be taken from this number.</div>
              </div>
            )}

            <div className="mt-3 text-sm">Current TM / Base: <span className="font-semibold">{roundTo(trainingMax, 0.5)} {unit}</span></div>
          </div>

          <div className="border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Quick warm‑up presets</span>
              <div className="flex gap-2">
                <button onClick={() => generateWarmups("30-40-50")} className="px-3 py-1 border rounded-full text-xs">30/40/50</button>
                <button onClick={() => generateWarmups("40-50-60-70")} className="px-3 py-1 border rounded-full text-xs">40/50/60/70</button>
                <button onClick={() => generateWarmups("Bar-30-50-70")} className="px-3 py-1 border rounded-full text-xs">Bar/30/50/70</button>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-2">These create <em>percent</em> entries based on your current TM / Top set. Edit as needed.</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">WARM‑UPS (accepts kg or %)</label>
                <textarea rows={3} className="w-full border rounded-2xl p-2 font-mono" value={warmupInput} onChange={(e) => setWarmupInput(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WORKING SETS (accepts kg or %)</label>
                <textarea rows={3} className="w-full border rounded-2xl p-2 font-mono" value={workInput} onChange={(e) => setWorkInput(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-2xl p-4">
            <h2 className="text-lg font-semibold mb-3">{header}: Warm‑ups</h2>
            {warmRows.length === 0 ? (
              <div className="text-sm text-gray-500">No warm‑ups to show yet.</div>
            ) : (
              <ul className="space-y-2">
                {warmRows.map((r, idx) => (
                  <li key={`wup-${idx}`} className="flex items-start justify-between bg-gray-50 rounded-xl p-2">
                    <div className="font-medium">{r.display}</div>
                    <div className="text-xs text-gray-600 text-right">
                      <div>per‑side: {((r.weight - barWeight) / 2).toFixed(1)} {unit}</div>
                      <div className="opacity-80">{plateBreakdown(r.weight).join("  ·  ")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border rounded-2xl p-4">
            <h2 className="text-lg font-semibold mb-3">{header}: Working sets</h2>
            {workRows.length === 0 ? (
              <div className="text-sm text-gray-500">No working sets to show yet.</div>
            ) : (
              <ul className="space-y-2">
                {workRows.map((r, idx) => (
                  <li key={`work-${idx}`} className="flex items-start justify-between bg-gray-50 rounded-xl p-2">
                    <div className="font-medium">{r.display}</div>
                    <div className="text-xs text-gray-600 text-right">
                      <div>per‑side: {((r.weight - barWeight) / 2).toFixed(1)} {unit}</div>
                      <div className="opacity-80">{plateBreakdown(r.weight).join("  ·  ")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 text-sm text-gray-600">
          <p className="mb-2 font-medium">Notes</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Type <span className="font-mono">reps x kg</span> (e.g., <span className="font-mono">5x30</span>) or <span className="font-mono">reps x %</span> (e.g., <span className="font-mono">5x60%</span>).</li>
            <li>Percent entries are taken from current <strong>TM / Top set</strong> shown above.</li>
            <li>Change rounding to match your smallest plates (e.g., 1.25 or 2.5).</li>
            <li>Per‑side and plate suggestions assume symmetric loading and include the bar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
