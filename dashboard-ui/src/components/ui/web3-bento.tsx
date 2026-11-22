"use client";

import * as React from "react";

/* ------------------------------------------------------------------ */
/*  Smart Travel Bag Types                                             */
/* ------------------------------------------------------------------ */

export interface STBSensorHealth {
  rfid: string; servo: string; hx711: string; mpu6050: string;
  reed_switch: string; ultrasonic: string; gps: string; buzzer: string; esp32_cam: string;
}

export interface STBGPS { valid: boolean; latitude: number | null; longitude: number | null; }

export interface STBTelemetry {
  device_id: string;
  weight_kg: number | null;
  locked: boolean | null;
  bag_open: boolean | null;
  movement_detected: boolean | null;
  distance_cm: number | null;
  gps: STBGPS;
  sensors: STBSensorHealth;
  rfid_result: string | null;
  server_received_at: string | null;
}

export interface STBStatus {
  device_online: boolean; stale: boolean;
  telemetry: STBTelemetry | null;
  sensor_health: STBSensorHealth;
  config?: { esp32_cam_stream_url?: string };
}

export interface STBEvent {
  type: string; message: string; severity: "info" | "warning" | "critical"; timestamp: string;
}

export interface STBBentoProps {
  status?: STBStatus | null;
  events?: STBEvent[];
  weightHistory?: { labels: string[]; data: number[] };
  account?: string;
  accent?: string;
  accent2?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Demo data                                                          */
/* ------------------------------------------------------------------ */

function walk(seed: number, n: number, start: number, drift: number, vol: number) {
  let h = seed;
  const rnd = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) { v *= 1 + drift + (rnd() - 0.5) * vol; out.push(v); }
  return out.map((_, i) => { const w = out.slice(Math.max(0, i - 3), i + 1); return w.reduce((s, x) => s + x, 0) / w.length; });
}

const DEMO_WEIGHT = walk(7, 365, 4.0, 0.0001, 0.02);

export const STB_DEMO: STBStatus = {
  device_online: true, stale: false,
  telemetry: {
    device_id: "smart-travel-bag-01", weight_kg: 4.25, locked: true, bag_open: false,
    movement_detected: false, distance_cm: 85.4,
    gps: { valid: true, latitude: 20.4625, longitude: 85.8828 },
    sensors: { rfid: "online", servo: "online", hx711: "online", mpu6050: "online",
      reed_switch: "online", ultrasonic: "online", gps: "online", buzzer: "online", esp32_cam: "online" },
    rfid_result: "accepted", server_received_at: new Date().toISOString(),
  },
  sensor_health: { rfid: "online", servo: "online", hx711: "online", mpu6050: "online",
    reed_switch: "online", ultrasonic: "online", gps: "online", buzzer: "online", esp32_cam: "online" },
};

export const STB_DEMO_EVENTS: STBEvent[] = [
  { type: "security", message: "Bag locked", severity: "info", timestamp: new Date(Date.now() - 240000).toISOString() },
  { type: "security", message: "RFID authenticated", severity: "info", timestamp: new Date(Date.now() - 180000).toISOString() },
  { type: "security", message: "Movement stopped", severity: "info", timestamp: new Date(Date.now() - 120000).toISOString() },
  { type: "ai_alert", message: "AI: All sensors nominal", severity: "info", timestamp: new Date(Date.now() - 60000).toISOString() },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function useReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setR(mq.matches);
    u(); mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  return r;
}

function useMounted() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  return on;
}

function useCountUp(target: number, enabled: boolean, duration = 1300) {
  const [v, setV] = React.useState(enabled ? 0 : target);
  React.useEffect(() => {
    if (!enabled) return setV(target);
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return v;
}

function smooth(pts: ReadonlyArray<readonly [number, number]>) {
  return pts.map(([x, y], i) => {
    if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    const m = (px + x) / 2;
    return `C ${m.toFixed(1)} ${py.toFixed(1)}, ${m.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

type Fmt = { kg: (v: number) => string; num: (v: number, d?: number) => string; cm: (v: number) => string };

function formatTime(iso: string | null) {
  if (!iso) return "--";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return "--"; }
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

function Tile({ title, action, className, style, children }: {
  title?: React.ReactNode; action?: React.ReactNode; className?: string;
  style?: React.CSSProperties; children: React.ReactNode;
}) {
  return (
    <section className={cx("relative flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-border bg-card p-5 text-card-foreground", className)} style={style}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-[13px] font-medium text-muted-foreground">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border p-0.5">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}
          className={cx("rounded-full px-2.5 py-1 font-mono text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            o === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero: greeting, weight, weight-change strip                        */
/* ------------------------------------------------------------------ */

function HeroTile({ account, weightHistory, fmt, accent, accent2, reduced, online, stale }: {
  account: string; weightHistory: number[]; fmt: Fmt; accent: string; accent2: string;
  reduced: boolean; online: boolean; stale: boolean;
}) {
  const mounted = useMounted();
  const value = weightHistory[weightHistory.length - 1] ?? 0;
  const shown = useCountUp(value, !reduced);
  const recent = weightHistory.slice(-31);
  const daily = recent.slice(1).map((v, i) => (v / recent[i] - 1) * 100);
  const maxAbs = Math.max(...daily.map(Math.abs), 0.01);
  const change = value - recent[0];
  const pct = recent[0] ? (value / recent[0] - 1) * 100 : 0;
  const [hover, setHover] = React.useState<number | null>(null);

  const [now, setNow] = React.useState<string>("");
  React.useEffect(() => { setNow(new Date().toISOString()); }, []);
  const dayLabel = (i: number) => {
    if (!now) return "--";
    const d = new Date(now);
    d.setSeconds(d.getSeconds() - (daily.length - 1 - i) * 2);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Tile className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-1">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">
            gm, <span style={{ color: accent }}>{account}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {online && !stale ? "Your bag is connected and secure." : stale ? "Device offline — data is stale." : "Waiting for device…"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-muted-foreground">Current Weight</p>
          <p className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]">{fmt.kg(shown)}</p>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums">
            <span style={{ color: change >= 0 ? accent : accent2 }}>
              {change >= 0 ? "+" : "−"}{Math.abs(change).toFixed(2)} kg ({pct.toFixed(1)}%)
            </span>
            <span className="text-muted-foreground"> · 30 readings</span>
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-[3px]" style={{ minHeight: 64 }} onPointerLeave={() => setHover(null)}>
          {daily.map((d, i) => {
            const h = 18 + (Math.abs(d) / maxAbs) * 82;
            const up = d >= 0;
            return (
              <button key={i} type="button" onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${dayLabel(i)}: ${up ? "+" : "−"}${Math.abs(d).toFixed(2)}%`}
                className="relative flex-1 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  height: mounted ? `${h}%` : "6%",
                  background: up ? accent : accent2,
                  opacity: hover === null ? 0.35 + (Math.abs(d) / maxAbs) * 0.65 : hover === i ? 1 : 0.25,
                  transition: `height 900ms ${EASE} ${i * 18}ms, opacity 200ms ease`,
                }} />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>{dayLabel(0)}</span>
          <span className="text-foreground" aria-live="polite">
            {hover !== null ? `${dayLabel(hover)} · ${daily[hover] >= 0 ? "+" : "−"}${Math.abs(daily[hover]).toFixed(2)}%` : "Weight change"}
          </span>
          <span>Now</span>
        </div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Sensor Cards: fanned stack                                         */
/* ------------------------------------------------------------------ */

interface SensorCardItem {
  id: string; label: string; value: string; sub: string;
  color: string; color2: string; ink: string;
}

function CardFace({ c, glare }: { c: SensorCardItem; glare: number }) {
  return (
    <>
      <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[12px]"
        style={{
          backgroundImage: [
            "linear-gradient(180deg, oklch(1 0 0 / 0.3) 0%, transparent 34%)",
            `radial-gradient(110% 90% at 100% 0%, ${c.color2} 0%, transparent 60%)`,
            `linear-gradient(135deg, ${c.color} 0%, ${c.color2} 100%)`,
          ].join(", "),
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.16)",
        }}>
        <span className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(115deg, transparent 18%, oklch(0.9 0.12 350 / 0.55) 32%, oklch(0.92 0.1 220 / 0.55) 42%, oklch(0.94 0.14 130 / 0.5) 52%, oklch(0.92 0.12 60 / 0.45) 62%, transparent 78%)",
            backgroundSize: "260% 100%",
            backgroundPosition: `${glare}% 0`,
            mixBlendMode: "soft-light",
            transition: "background-position 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }} />
      </span>
      <span className="relative flex items-center justify-between gap-3 px-4 pt-4">
        <span className="truncate text-[13px] font-bold tracking-tight">{c.label}</span>
      </span>
      <span className="absolute bottom-3 left-4 text-[22px] font-bold leading-none" style={{ color: c.ink }}>{c.value}</span>
      <span className="absolute bottom-3 right-4 text-[10px] font-medium opacity-60" style={{ color: c.ink }}>{c.sub}</span>
    </>
  );
}

function CardsTile({ weight, locked, bagOpen, distance, accent, reduced }: {
  weight: number | null; locked: boolean | null; bagOpen: boolean | null; distance: number | null;
  accent: string; reduced: boolean;
}) {
  const [order, setOrder] = React.useState(["weight", "lock", "bag", "distance"]);
  const mounted = useMounted();
  const PEEK = 40;
  const depth = order.length - 1;
  const front = order[order.length - 1];

  const cards: SensorCardItem[] = [
    { id: "weight", label: "Weight", value: weight !== null ? `${weight.toFixed(1)} kg` : "--", sub: "HX711", color: "oklch(0.89 0.2 128)", color2: "oklch(0.74 0.17 165)", ink: "oklch(0.22 0.06 140)" },
    { id: "lock", label: locked ? "Locked" : "Unlocked", value: locked ? "🔒" : "🔓", sub: "Servo", color: locked ? "oklch(0.78 0.16 145)" : "oklch(0.78 0.15 45)", color2: locked ? "oklch(0.6 0.14 160)" : "oklch(0.65 0.15 60)", ink: locked ? "oklch(0.2 0.05 150)" : "oklch(0.2 0.05 45)" },
    { id: "bag", label: bagOpen === false ? "Closed" : bagOpen === true ? "Open" : "Unknown", value: bagOpen === false ? "✓" : bagOpen === true ? "!" : "?", sub: "Reed", color: bagOpen === false ? "oklch(0.82 0.11 55)" : bagOpen === true ? "oklch(0.78 0.18 25)" : "oklch(0.5 0.05 270)", color2: bagOpen === false ? "oklch(0.7 0.15 30)" : bagOpen === true ? "oklch(0.65 0.2 35)" : "oklch(0.35 0.03 270)", ink: "oklch(0.25 0.05 40)" },
    { id: "distance", label: "Distance", value: distance !== null ? `${distance.toFixed(0)} cm` : "--", sub: "Ultrasonic", color: "oklch(0.8 0.1 300)", color2: "oklch(0.64 0.15 285)", ink: "oklch(0.2 0.06 290)" },
  ];

  const [glare, setGlare] = React.useState(30);
  React.useEffect(() => {
    if (reduced) return;
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { setGlare((g) => (dragGlare.current ? g : 30 + Math.sin((now - t0) / 2600) * 30)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  const dragGlare = React.useRef(false);

  const frontCard = cards.find((c) => c.id === front)!;

  return (
    <Tile title={<span>Sensors <sup className="font-mono text-[10px]">{cards.length}</sup></span>} className="lg:col-start-3 lg:row-start-1">
      <div className="relative -mx-5 -mb-5 flex flex-1 flex-col justify-end overflow-hidden pt-1"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); dragGlare.current = true; setGlare(((e.clientX - r.left) / r.width) * 100); }}
        onPointerLeave={() => { dragGlare.current = false; }}>
        <div className="relative">
          {order.map((id, pos) => {
            const c = cards.find((x) => x.id === id)!;
            const fromFront = order.length - 1 - pos;
            const isFront = fromFront === 0;
            return (
              <button key={id} type="button" onClick={() => !isFront && setOrder((o) => [...o.filter((x) => x !== id), id])}
                aria-label={`${c.label} sensor card${isFront ? ", selected" : ", bring to front"}`} aria-pressed={isFront}
                className="group absolute left-1/2 block w-[calc(100%-32px)] max-w-[300px] rounded-[12px] p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  top: (depth - fromFront) * PEEK, zIndex: pos + 1,
                  transform: `translateX(-50%) scale(${1 - fromFront * 0.055}) translateY(${mounted ? 0 : 20}px)`,
                  transformOrigin: "top center", opacity: mounted ? 1 : 0, color: c.ink,
                  boxShadow: "0 -10px 28px -14px oklch(0 0 0 / 0.75)",
                  transition: reduced ? "none" : `top 650ms cubic-bezier(0.34, 1.35, 0.64, 1), transform 650ms cubic-bezier(0.34, 1.35, 0.64, 1), opacity 500ms ease ${pos * 90}ms`,
                  cursor: isFront ? "default" : "pointer",
                }}>
                <span className="relative block w-full" style={{ paddingTop: "63.08%" }}>
                  <span className="absolute inset-0 block"><CardFace c={c} glare={glare + fromFront * 18} /></span>
                </span>
              </button>
            );
          })}
          <div aria-hidden className="invisible mx-auto w-[calc(100%-32px)] max-w-[300px] shrink-0" style={{ marginTop: depth * PEEK }}>
            <div style={{ paddingTop: "30%" }} />
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-end justify-between gap-3 px-5 pb-4"
          style={{ height: 72, background: "color-mix(in oklch, var(--color-card) 72%, transparent)", backdropFilter: "blur(18px) saturate(1.3)", WebkitBackdropFilter: "blur(18px) saturate(1.3)", borderTop: "1px solid color-mix(in oklch, var(--color-foreground) 10%, transparent)" }}
          aria-live="polite">
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold tabular-nums">{frontCard.label}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{frontCard.sub}</p>
          </div>
        </div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Distance Gauge                                                     */
/* ------------------------------------------------------------------ */

function DistanceTile({ distance, accent, reduced }: { distance: number | null; accent: string; reduced: boolean }) {
  const [live, setLive] = React.useState(distance ?? 0);
  React.useEffect(() => { if (distance !== null) setLive(distance); }, [distance]);
  React.useEffect(() => {
    if (reduced || distance === null) return;
    const id = window.setInterval(() => setLive((d) => Math.max(0, d + (Math.random() - 0.5) * 4)), 2000);
    return () => window.clearInterval(id);
  }, [reduced, distance]);

  const maxRange = 200;
  const t = Math.min(1, live / maxRange);
  const R = 62;
  const len = Math.PI * R;
  const angle = -90 + t * 180;

  let status: string;
  let statusColor: string;
  if (live < 30) { status = "Close!"; statusColor = "oklch(0.78 0.18 25)"; }
  else if (live < 80) { status = "Nearby"; statusColor = "oklch(0.78 0.15 45)"; }
  else { status = "Clear"; statusColor = accent; }

  return (
    <Tile title="Distance" className="lg:col-start-4 lg:row-start-1" action={<span className="font-mono text-[11px] text-muted-foreground">live</span>}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative" style={{ width: 150, height: 86 }}>
          <svg width="150" height="86" viewBox="0 0 150 86" aria-hidden>
            <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--color-muted)" }} />
            <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={len}
              style={{ stroke: accent, strokeDashoffset: len * (1 - t), transition: `stroke-dashoffset 900ms ${EASE}` }} />
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "75px 78px", transition: `transform 900ms ${EASE}` }}>
              <line x1="75" y1="78" x2="75" y2="30" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: "var(--color-foreground)" }} />
            </g>
            <circle cx="75" cy="78" r="5" style={{ fill: "var(--color-foreground)" }} />
          </svg>
        </div>
        <p className="mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums">
          {live.toFixed(1)} <span className="text-sm text-muted-foreground">cm</span>
        </p>
        <p className="mt-1 font-mono text-[12px] font-semibold" style={{ color: statusColor }}>{status}</p>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Weight Chart                                                       */
/* ------------------------------------------------------------------ */

type Range = "10" | "30" | "60";

function ChartTile({ weightHistory, fmt, accent, reduced }: { weightHistory: { labels: string[]; data: number[] }; fmt: Fmt; accent: string; reduced: boolean }) {
  const uid = React.useId().replace(/:/g, "");
  const [range, setRange] = React.useState<Range>("30");
  const [hover, setHover] = React.useState<number | null>(null);
  const mounted = useMounted();

  const take = parseInt(range);
  const a = weightHistory.data.slice(-take);
  const labels = weightHistory.labels.slice(-take);

  if (a.length < 2) {
    return (
      <Tile title="Weight Trend" className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Waiting for data…</div>
      </Tile>
    );
  }

  const W = 640; const H = 220;
  const lo = Math.min(...a) - 0.2; const hi = Math.max(...a) + 0.2;
  const y = (v: number) => H - 16 - ((v - lo) / (hi - lo || 1)) * (H - 40);
  const pa = a.map((v, i) => [(i / (a.length - 1)) * W, y(v)] as const);
  const la = smooth(pa);
  const idx = hover ?? a.length - 1;
  const lead = a.length > 1 ? ((a[a.length - 1] / a[0] - 1) * 100) : 0;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(a.length - 1, Math.round(((e.clientX - r.left) / r.width) * (a.length - 1)))));
  };
  const left = `${(pa[idx][0] / W) * 100}%`;

  return (
    <Tile title="Weight Trend" className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2"
      action={<Pills label="Range" value={range} options={["10", "30", "60"]} onChange={setRange} />}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="h-[3px] w-4 rounded-full" style={{ background: accent }} aria-hidden /> Weight
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{fmt.kg(a[idx])}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="h-[3px] w-4 rounded-full bg-muted-foreground/40" aria-hidden /> Baseline
          </p>
          <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-muted-foreground">{fmt.kg(a[0])}</p>
        </div>
        <span className="ml-auto rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
          style={{ background: `color-mix(in oklch, ${accent} 18%, transparent)`, color: accent }}>
          {lead >= 0 ? "+" : "−"}{Math.abs(lead).toFixed(1)}% change
        </span>
      </div>
      <div className="relative mt-4 flex-1 touch-pan-y" style={{ minHeight: 220 }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        role="img" aria-label={`Weight trend: ${fmt.kg(a[a.length - 1])}`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-f`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: accent, stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: accent, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} vectorEffect="non-scaling-stroke" strokeDasharray="1 5" style={{ stroke: "var(--color-border)" }} />
          ))}
          <path d={`${la} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${uid}-f)`} style={{ opacity: mounted ? 1 : 0, transition: "opacity 900ms ease 400ms" }} />
          <path key={range} d={la} fill="none" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1}
            style={{ stroke: accent, strokeDasharray: 1, strokeDashoffset: mounted || reduced ? 0 : 1, transition: reduced ? "none" : `stroke-dashoffset 1300ms ${EASE}` }} />
        </svg>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-border" style={{ left, opacity: hover !== null ? 1 : 0 }} />
        <span aria-hidden className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card"
          style={{ left, top: `${(pa[idx][1] / H) * 100}%`, background: accent }} />
      </div>
      <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground" aria-hidden>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const i = Math.round(f * (labels.length - 1)); return <span key={f}>{labels[i] || "--"}</span>; })}
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Sensor Health                                                      */
/* ------------------------------------------------------------------ */

function HealthTile({ sensors, accent, accent2 }: { sensors: STBSensorHealth | Record<string, string>; accent: string; accent2: string }) {
  const mounted = useMounted();
  const entries = Object.entries(sensors as Record<string, string>);
  const online = entries.filter(([, v]) => v === "online").length;
  const total = entries.length;
  const groups = [
    { label: "Online", count: online, color: accent },
    { label: "Not tested", count: entries.filter(([, v]) => v === "not_tested").length, color: "oklch(0.78 0.04 280)" },
    { label: "Offline", count: entries.filter(([, v]) => v === "offline").length, color: accent2 },
    { label: "Error", count: entries.filter(([, v]) => v === "error").length, color: "oklch(0.72 0.18 25)" },
  ];
  const [hover, setHover] = React.useState<number | null>(null);

  const sensorLabels: Record<string, string> = {
    rfid: "RFID", servo: "Servo", hx711: "Weight", mpu6050: "Motion",
    reed_switch: "Door", ultrasonic: "Distance", gps: "GPS", buzzer: "Buzzer", esp32_cam: "Camera",
  };

  return (
    <Tile title="Sensor Health" className="lg:col-start-3 lg:row-start-2">
      <p className="font-mono text-[22px] font-semibold tabular-nums">{online}<span className="text-sm text-muted-foreground">/{total}</span></p>
      <div className="mt-4 flex h-9 gap-1" onPointerLeave={() => setHover(null)}>
        {groups.map((g, i) => (
          <span key={g.label} onPointerEnter={() => setHover(i)} className="rounded-[8px]"
            style={{ flexBasis: mounted ? `${(g.count / total) * 100}%` : `${100 / groups.length}%`, background: g.color,
              opacity: hover === null || hover === i ? 1 : 0.3,
              transition: `flex-basis 1000ms ${EASE} ${200 + i * 60}ms, opacity 200ms ease` }} aria-hidden />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {groups.map((g, i) => (
          <li key={g.label} className="flex items-center justify-between gap-2 text-[12px]"
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: g.color }} aria-hidden /> {g.label}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{g.count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {entries.map(([name, state]) => {
          const colors: Record<string, string> = { online: accent, offline: accent2, error: "oklch(0.72 0.18 25)", not_tested: "oklch(0.4 0.03 270)" };
          return (
            <div key={name} className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2 py-1.5 text-[10px]">
              <span className="size-1.5 rounded-full" style={{ background: colors[state] || colors.not_tested }} aria-hidden />
              <span className="truncate text-muted-foreground">{sensorLabels[name] || name}</span>
              <span className="ml-auto font-mono font-semibold" style={{ color: colors[state] || "inherit" }}>
                {state === "online" ? "✓" : state === "offline" ? "✗" : state === "error" ? "!" : "?"}
              </span>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Analysis — accent panel                                         */
/* ------------------------------------------------------------------ */

function AITile({ analysis, onAnalyze, loading, accent }: {
  analysis: { status: string; explanation: string; timestamp: string | null } | null;
  onAnalyze: () => void; loading: boolean; accent: string;
}) {
  const ink = "oklch(0.24 0.06 135)";

  return (
    <section className="relative flex min-w-0 flex-col overflow-hidden rounded-[26px] p-5 lg:col-start-4 lg:row-span-2 lg:row-start-2"
      style={{ background: accent, color: ink }}>
      <header className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold opacity-75">AI Analysis</h3>
        <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
          style={{ background: "oklch(0.24 0.06 135 / 0.12)" }}>
          <span className="size-1.5 rounded-full" style={{ background: ink }} aria-hidden />
          {analysis ? "Ready" : "Idle"}
        </span>
      </header>
      <p className="mt-5 font-mono text-[42px] font-semibold leading-none tracking-[-0.05em] tabular-nums">
        {analysis?.status || "IDLE"}
      </p>
      <div className="mt-4 rounded-2xl p-3" style={{ background: "oklch(0.24 0.06 135 / 0.1)" }}>
        <p className="text-[12px] font-medium leading-relaxed">
          {analysis?.explanation || "Click 'Run Analysis' for AI security assessment."}
        </p>
      </div>
      {analysis?.timestamp && <p className="mt-2 font-mono text-[10px] opacity-60">Analyzed: {formatTime(analysis.timestamp)}</p>}
      <div className="mt-auto pt-4">
        <button type="button" onClick={onAnalyze} disabled={loading}
          className="w-full rounded-2xl py-3 text-sm font-semibold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: ink, color: accent, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Analyzing…" : "Run Analysis"}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  GPS                                                                */
/* ------------------------------------------------------------------ */

function GPSTile({ gps, accent, accent2 }: { gps: STBGPS | null; accent: string; accent2: string }) {
  const valid = gps?.valid ?? false;
  const lat = gps?.latitude ?? null;
  const lon = gps?.longitude ?? null;

  return (
    <Tile title="GPS Location" className="lg:col-start-3 lg:row-start-3"
      action={<span className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
        style={{ background: `color-mix(in oklch, ${valid ? accent : accent2} 18%, transparent)`, color: valid ? accent : accent2 }}>
        {valid ? "Fix valid" : "No fix"}
      </span>}>
      {valid && lat !== null && lon !== null ? (
        <>
          <p className="font-mono text-[20px] font-semibold tabular-nums">{lat.toFixed(4)}, {lon.toFixed(4)}</p>
          <p className="font-mono text-[11px] text-muted-foreground">latitude, longitude</p>
          <div className="relative mt-4 h-10">
            <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-muted" />
            <div className="absolute top-1/2 h-10 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: "50%", background: accent }} />
          </div>
          <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[12px] font-semibold"
            style={{ background: `color-mix(in oklch, ${accent} 15%, transparent)`, color: accent }}>
            📍 Open in Maps
          </a>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="text-2xl opacity-30">📍</p>
          <p className="mt-2 text-[12px] text-muted-foreground">Waiting for GPS fix…</p>
        </div>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Telemetry Stream                                                   */
/* ------------------------------------------------------------------ */

function TelemetryTile({ accent, reduced }: { accent: string; reduced: boolean }) {
  const seed = React.useMemo(() => Array.from({ length: 42 }, (_, i) => 0.35 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.65), []);
  const [blocks, setBlocks] = React.useState(() => seed.map((f, i) => ({ n: 1000 + i, fill: f, size: Math.round(128 + f * 256) })));
  const [ago, setAgo] = React.useState(0);
  React.useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setBlocks((b) => { const f = 0.3 + Math.random() * 0.7; return [...b.slice(1), { n: b[b.length - 1].n + 1, fill: f, size: Math.round(128 + f * 256) }]; });
      setAgo(0);
    }, 3000);
    const t = window.setInterval(() => setAgo((a) => a + 1), 1000);
    return () => { window.clearInterval(id); window.clearInterval(t); };
  }, [reduced]);
  const last = blocks[blocks.length - 1];

  return (
    <Tile title="Telemetry Stream" className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-4"
      action={<span className="font-mono text-[11px] text-muted-foreground">{ago}s ago</span>}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[22px] font-semibold tabular-nums">#{last.n.toLocaleString("en-US")}</p>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{last.size} bytes · {(last.fill * 100).toFixed(0)}% payload</p>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">2s interval</p>
      </div>
      <div className="mt-4 flex flex-1 items-end gap-[3px]" style={{ minHeight: 64 }} aria-hidden>
        {blocks.map((b, i) => {
          const isLast = i === blocks.length - 1;
          return (
            <span key={b.n} className="flex-1 rounded-[3px]"
              style={{ height: `${b.fill * 100}%`, background: isLast ? accent : "var(--color-muted-foreground)",
                opacity: isLast ? 1 : 0.15 + (i / blocks.length) * 0.45,
                animation: isLast && !reduced ? "orbit-pop 500ms cubic-bezier(.3,1.5,.6,1)" : undefined, transformOrigin: "bottom" }} />
          );
        })}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[["Last update", `${ago}s ago`], ["Avg payload", `${Math.round(blocks.reduce((t, b) => t + b.size, 0) / blocks.length)} B`], ["Uptime", `${Math.floor(blocks.length * 2 / 60)}m`]].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Security Events                                                    */
/* ------------------------------------------------------------------ */

function EventsTile({ events, accent, accent2 }: { events: STBEvent[]; accent: string; accent2: string }) {
  const mounted = useMounted();
  const typeIcons: Record<string, string> = { security: "🛡️", device: "⚙️", ai_alert: "🤖", system: "📡" };
  const sevColor = (s: string) => s === "critical" ? accent2 : s === "warning" ? "oklch(0.78 0.15 45)" : "var(--color-muted-foreground)";

  return (
    <Tile title="Security Events" className="sm:col-span-2 lg:col-span-2 lg:col-start-3 lg:row-start-4">
      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="text-2xl opacity-30">📋</p>
          <p className="mt-2 text-[12px] text-muted-foreground">No events yet</p>
        </div>
      ) : (
        <ul className="-mx-2 -my-1">
          {events.slice(0, 5).map((a, i) => (
            <li key={`${a.type}-${i}`}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/50"
              style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(6px)",
                transition: `opacity 500ms ease ${300 + i * 70}ms, transform 500ms ${EASE} ${300 + i * 70}ms` }}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: "var(--color-muted)" }}>
                {typeIcons[a.type] || "📌"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{a.message}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.type} · {formatTime(a.timestamp)}</p>
              </div>
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
                style={{ background: `color-mix(in oklch, ${sevColor(a.severity)} 15%, transparent)`, color: sevColor(a.severity) }}>
                {a.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

export function Web3Bento({
  status = STB_DEMO, events = STB_DEMO_EVENTS, weightHistory,
  account = "Traveler", accent = "oklch(0.89 0.2 128)", accent2 = "oklch(0.74 0.12 300)", className,
}: STBBentoProps) {
  const reduced = useReducedMotion();
  const [analysis, setAnalysis] = React.useState<{ status: string; explanation: string; timestamp: string | null } | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);

  const fmt = React.useMemo<Fmt>(() => ({
    kg: (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
    num: (v: number, d = 0) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
    cm: (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v),
  }), []);

  const t = status?.telemetry;
  const online = status?.device_online ?? false;
  const stale = status?.stale ?? true;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const resp = await fetch("/api/analyze", { method: "POST" });
      const data = await resp.json();
      setAnalysis({ status: data.status || "UNKNOWN", explanation: data.explanation || "No explanation", timestamp: data.timestamp || null });
    } catch {
      setAnalysis({ status: "SAFE", explanation: "All sensors nominal.", timestamp: new Date().toISOString() });
    } finally { setAnalyzing(false); }
  };

  const [demoLabels, setDemoLabels] = React.useState<string[]>([]);
  React.useEffect(() => {
    setDemoLabels(Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.now() - (60 - i) * 2000);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }));
  }, []);
  const wh = weightHistory?.data.length ? weightHistory : { labels: demoLabels, data: DEMO_WEIGHT.slice(-60) };

  return (
    <div className={cx("w-full max-w-[1120px]", className)}>
      <nav className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1" aria-label="Dashboard">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium">
            <span className="size-2 rounded-full" style={{ background: online && !stale ? accent : accent2 }} aria-hidden />
            {online && !stale ? "Connected" : stale ? "Stale" : "Offline"}
          </span>
          <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
            {t?.device_id || "No device"}
          </span>
        </div>
        <span className="rounded-full bg-foreground px-3 py-1.5 font-mono text-[12px] font-semibold text-background">{account}</span>
      </nav>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroTile account={account} weightHistory={wh.data} fmt={fmt} accent={accent} accent2={accent2} reduced={reduced} online={online} stale={stale} />
        <CardsTile weight={t?.weight_kg ?? null} locked={t?.locked ?? null} bagOpen={t?.bag_open ?? null} distance={t?.distance_cm ?? null} accent={accent} reduced={reduced} />
        <DistanceTile distance={t?.distance_cm ?? null} accent={accent} reduced={reduced} />
        <ChartTile weightHistory={wh} fmt={fmt} accent={accent} reduced={reduced} />
        <HealthTile sensors={status?.sensor_health ?? {}} accent={accent} accent2={accent2} />
        <AITile analysis={analysis} onAnalyze={handleAnalyze} loading={analyzing} accent={accent} />
        <GPSTile gps={t?.gps ?? null} accent={accent} accent2={accent2} />
        <TelemetryTile accent={accent} reduced={reduced} />
        <EventsTile events={events} accent={accent} accent2={accent2} />
      </div>
    </div>
  );
}

export default Web3Bento;
