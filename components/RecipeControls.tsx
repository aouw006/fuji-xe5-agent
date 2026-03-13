"use client";
import React from "react";
import { Theme } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecipeValues {
  filmSimulation: string;
  grainRoughness: "Off" | "Weak" | "Strong";
  grainSize: "Small" | "Large";
  colorChromeEffect: "Off" | "Weak" | "Strong";
  colorChromeFXBlue: "Off" | "Weak" | "Strong";
  smoothSkinEffect: "Off" | "Weak" | "Strong";
  whiteBalance: string;
  wbShiftR: number;
  wbShiftB: number;
  dynamicRange: "DR100" | "DR200" | "DR400" | "DR-Auto";
  dRangePriority: "Off" | "Weak" | "Strong";
  highlightTone: number;
  shadowTone: number;
  color: number;
  sharpness: number;
  highISONR: number;
  clarity: number;
  monoWC: number;
  monoMG: number;
}

export const FILM_SIMS = [
  { group: "Colour", sims: ["Provia/Standard", "Velvia/Vivid", "Astia/Soft", "Classic Chrome", "Reala Ace", "Pro Neg. Hi", "Pro Neg. Std", "Classic Neg.", "Nostalgic Neg.", "Eterna/Cinema", "Eterna Bleach Bypass"] },
  { group: "Monochrome", sims: ["Acros", "Acros+Ye", "Acros+R", "Acros+G", "Monochrome", "Monochrome+Ye", "Monochrome+R", "Monochrome+G", "Sepia"] },
];

export const ALL_SIMS = FILM_SIMS.flatMap(g => g.sims);

const WB_OPTIONS = [
  "Auto (White Priority)", "Auto (Ambience Priority)",
  "Daylight", "Shade", "Fluorescent 1", "Fluorescent 2", "Fluorescent 3",
  "Incandescent", "Underwater",
  "2500K", "3000K", "3500K", "4000K", "4500K", "5000K", "5500K", "6000K", "6500K", "7000K", "7500K", "8000K", "8500K", "9000K", "9500K", "10000K",
  "Custom 1", "Custom 2", "Custom 3",
];

export const DEFAULT_VALUES: RecipeValues = {
  filmSimulation: "Provia/Standard",
  grainRoughness: "Off",
  grainSize: "Small",
  colorChromeEffect: "Off",
  colorChromeFXBlue: "Off",
  smoothSkinEffect: "Off",
  whiteBalance: "Auto (White Priority)",
  wbShiftR: 0,
  wbShiftB: 0,
  dynamicRange: "DR100",
  dRangePriority: "Off",
  highlightTone: 0,
  shadowTone: 0,
  color: 0,
  sharpness: 0,
  highISONR: 0,
  clarity: 0,
  monoWC: 0,
  monoMG: 0,
};

// ─── Parse saved settings array → RecipeValues ───────────────────────────────

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function matchSim(val: string): string {
  const v = norm(val);
  for (const sim of ALL_SIMS) {
    if (norm(sim) === v) return sim;
  }
  // fuzzy
  if (v.includes("velvia")) return "Velvia/Vivid";
  if (v.includes("provia") || v.includes("standard")) return "Provia/Standard";
  if (v.includes("astia") || v.includes("soft")) return "Astia/Soft";
  if (v.includes("classicchrome")) return "Classic Chrome";
  if (v.includes("reala")) return "Reala Ace";
  if (v.includes("pronegh") || v.includes("proneghi")) return "Pro Neg. Hi";
  if (v.includes("pronegs") || v.includes("pronegst")) return "Pro Neg. Std";
  if (v.includes("classicneg")) return "Classic Neg.";
  if (v.includes("nostalgic")) return "Nostalgic Neg.";
  if (v.includes("eternab") || v.includes("bleach")) return "Eterna Bleach Bypass";
  if (v.includes("eterna")) return "Eterna/Cinema";
  if (v.includes("acrosr")) return "Acros+R";
  if (v.includes("acrosg")) return "Acros+G";
  if (v.includes("acrosye") || v.includes("acrosy")) return "Acros+Ye";
  if (v.includes("acros")) return "Acros";
  if (v.includes("monor")) return "Monochrome+R";
  if (v.includes("monog")) return "Monochrome+G";
  if (v.includes("monoye") || v.includes("monoy")) return "Monochrome+Ye";
  if (v.includes("mono") || v.includes("monochrome")) return "Monochrome";
  if (v.includes("sepia")) return "Sepia";
  return val || "Provia/Standard";
}

function parseToggle(val: string): "Off" | "Weak" | "Strong" {
  const v = val.toLowerCase();
  if (v.includes("strong")) return "Strong";
  if (v.includes("weak")) return "Weak";
  return "Off";
}

function parseDR(val: string): "DR100" | "DR200" | "DR400" | "DR-Auto" {
  const v = val.toLowerCase();
  if (v.includes("400")) return "DR400";
  if (v.includes("200")) return "DR200";
  if (v.includes("auto")) return "DR-Auto";
  return "DR100";
}

export function settingsToValues(settings: { label: string; value: string }[]): RecipeValues {
  const get = (...keys: string[]) => settings.find(s => keys.some(k => norm(s.label).includes(norm(k))))?.value;

  const filmSim = get("film simulation", "film sim", "filmsim");
  const grainRaw = get("grain effect", "grain");
  const grainSize = grainRaw?.toLowerCase().includes("large") ? "Large" : "Small";

  return {
    filmSimulation: filmSim ? matchSim(filmSim) : DEFAULT_VALUES.filmSimulation,
    grainRoughness: grainRaw ? parseToggle(grainRaw) : DEFAULT_VALUES.grainRoughness,
    grainSize,
    colorChromeEffect: parseToggle(get("color chrome effect", "colour chrome effect") || "off"),
    colorChromeFXBlue: parseToggle(get("color chrome fx blue", "colour chrome fx blue", "fx blue") || "off"),
    smoothSkinEffect: parseToggle(get("smooth skin") || "off"),
    whiteBalance: get("white balance", "wb") || DEFAULT_VALUES.whiteBalance,
    wbShiftR: (() => { const v = get("wb shift", "white balance shift"); if (!v) return 0; const m = v.match(/R[:\s]*([+-]?\d+)/i); return m ? parseInt(m[1]) : 0; })(),
    wbShiftB: (() => { const v = get("wb shift", "white balance shift"); if (!v) return 0; const m = v.match(/B[:\s]*([+-]?\d+)/i); return m ? parseInt(m[1]) : 0; })(),
    dynamicRange: parseDR(get("dynamic range", "dr") || "dr100"),
    dRangePriority: parseToggle(get("d-range priority", "drange priority", "dynamic range priority") || "off"),
    highlightTone: parseFloat(get("highlight tone", "highlight") || "0") || 0,
    shadowTone: parseFloat(get("shadow tone", "shadow") || "0") || 0,
    color: parseFloat(get("color", "colour", "saturation") || "0") || 0,
    sharpness: parseFloat(get("sharpness", "sharp") || "0") || 0,
    highISONR: parseFloat(get("high iso nr", "noise reduction", "nr") || "0") || 0,
    clarity: parseFloat(get("clarity") || "0") || 0,
    monoWC: parseFloat(get("monochromatic color wc", "mono wc", "wc") || "0") || 0,
    monoMG: parseFloat(get("monochromatic color mg", "mono mg", "mg") || "0") || 0,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children, t }: { children: React.ReactNode; t: Theme }) {
  return <div style={{ fontSize: "0.5rem", color: t.textVeryFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.3rem" }}>{children}</div>;
}

function ToggleGroup({ options, value, onChange, disabled, t, isDark }: {
  options: string[]; value: string; onChange: (v: string) => void; disabled?: boolean; t: Theme; isDark: boolean;
}) {
  const gold = isDark ? "#c8a96e" : "#b08840";
  const goldBorder = isDark ? "rgba(200,169,110,0.3)" : "rgba(176,136,64,0.35)";
  return (
    <div style={{ display: "flex", gap: "2px", opacity: disabled ? 0.35 : 1 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} onClick={() => !disabled && onChange(opt)}
            style={{ flex: 1, padding: "0.25rem 0", fontSize: "0.55rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", borderRadius: "2px", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
              background: active ? (isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.18)") : "transparent",
              border: `1px solid ${active ? goldBorder : t.border}`,
              color: active ? gold : t.textMuted,
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ min, max, step = 1, value, onChange, disabled, t, isDark }: {
  min: number; max: number; step?: number; value: number; onChange: (v: number) => void; disabled?: boolean; t: Theme; isDark: boolean;
}) {
  const gold = isDark ? "#c8a96e" : "#b08840";
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: disabled ? 0.35 : 1 }}>
      <span style={{ fontSize: "0.52rem", color: t.textFaint, fontFamily: "'DM Mono', monospace", width: "20px", textAlign: "right", flexShrink: 0 }}>{min}</span>
      <div style={{ flex: 1, position: "relative" }}>
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: "100%", appearance: "none", WebkitAppearance: "none", height: "3px", borderRadius: "2px", cursor: disabled ? "not-allowed" : "pointer", outline: "none",
            background: `linear-gradient(to right, ${gold} ${pct}%, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"} ${pct}%)` }} />
      </div>
      <span style={{ fontSize: "0.52rem", color: t.textFaint, fontFamily: "'DM Mono', monospace", width: "20px", flexShrink: 0 }}>{max}</span>
      <span style={{ fontSize: "0.62rem", color: gold, fontFamily: "'DM Mono', monospace", width: "32px", textAlign: "right", flexShrink: 0 }}>{value > 0 ? `+${value}` : value}</span>
    </div>
  );
}

function Section({ title, children, t }: { title: string; children: React.ReactNode; t: Theme }) {
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ fontSize: "0.5rem", color: t.textFaint, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.6rem", paddingBottom: "0.4rem", borderBottom: `1px solid ${t.border}` }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>{children}</div>
    </div>
  );
}

// ─── Main Controls Component ──────────────────────────────────────────────────

interface Props {
  values: RecipeValues;
  onChange: (values: RecipeValues) => void;
  onReset: () => void;
  t: Theme;
  isDark: boolean;
}

export default function RecipeControls({ values, onChange, onReset, t, isDark }: Props) {
  const set = (patch: Partial<RecipeValues>) => onChange({ ...values, ...patch });
  const isMono = ["Acros", "Acros+Ye", "Acros+R", "Acros+G", "Monochrome", "Monochrome+Ye", "Monochrome+R", "Monochrome+G", "Sepia"].includes(values.filmSimulation);
  const dRangeActive = values.dRangePriority !== "Off";
  const grainOn = values.grainRoughness !== "Off";
  const gold = isDark ? "#c8a96e" : "#b08840";
  const goldBorder = isDark ? "rgba(200,169,110,0.25)" : "rgba(176,136,64,0.3)";

  return (
    <div>
      <style>{`
        input[type=range]::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${gold}; cursor: pointer; border: none; }
        input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${gold}; cursor: pointer; border: none; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Tweak settings — filter updates live</div>
        <button onClick={onReset}
          style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textFaint, padding: "0.15rem 0.5rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = goldBorder; e.currentTarget.style.color = gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textFaint; }}>
          Reset
        </button>
      </div>

      {/* ── Film Sim & Effects ── */}
      <Section title="Film Simulation & Effects" t={t}>
        <div>
          <Label t={t}>Film Simulation</Label>
          <select value={values.filmSimulation} onChange={e => set({ filmSimulation: e.target.value })}
            style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.border}`, color: t.text, borderRadius: "3px", padding: "0.4rem 0.6rem", fontSize: "0.7rem", fontFamily: "'DM Mono', monospace", cursor: "pointer", outline: "none", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = goldBorder}
            onBlur={e => e.target.style.borderColor = t.border}>
            {FILM_SIMS.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.sims.map(sim => <option key={sim} value={sim}>{sim}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <Label t={t}>Grain Effect — Roughness</Label>
          <ToggleGroup options={["Off", "Weak", "Strong"]} value={values.grainRoughness} onChange={v => set({ grainRoughness: v as RecipeValues["grainRoughness"] })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Grain Size{!grainOn && " (enable Roughness first)"}</Label>
          <ToggleGroup options={["Small", "Large"]} value={values.grainSize} onChange={v => set({ grainSize: v as "Small" | "Large" })} disabled={!grainOn} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Color Chrome Effect</Label>
          <ToggleGroup options={["Off", "Weak", "Strong"]} value={values.colorChromeEffect} onChange={v => set({ colorChromeEffect: v as RecipeValues["colorChromeEffect"] })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Color Chrome FX Blue</Label>
          <ToggleGroup options={["Off", "Weak", "Strong"]} value={values.colorChromeFXBlue} onChange={v => set({ colorChromeFXBlue: v as RecipeValues["colorChromeFXBlue"] })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Smooth Skin Effect</Label>
          <ToggleGroup options={["Off", "Weak", "Strong"]} value={values.smoothSkinEffect} onChange={v => set({ smoothSkinEffect: v as RecipeValues["smoothSkinEffect"] })} t={t} isDark={isDark} />
        </div>
      </Section>

      {/* ── Light & Color ── */}
      <Section title="Light & Color" t={t}>
        <div>
          <Label t={t}>White Balance</Label>
          <select value={values.whiteBalance} onChange={e => set({ whiteBalance: e.target.value })}
            style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.border}`, color: t.text, borderRadius: "3px", padding: "0.4rem 0.6rem", fontSize: "0.7rem", fontFamily: "'DM Mono', monospace", cursor: "pointer", outline: "none", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = goldBorder}
            onBlur={e => e.target.style.borderColor = t.border}>
            {WB_OPTIONS.map(wb => <option key={wb} value={wb}>{wb}</option>)}
          </select>
        </div>

        <div>
          <Label t={t}>WB Shift — Red (R): {values.wbShiftR > 0 ? `+${values.wbShiftR}` : values.wbShiftR}</Label>
          <Slider min={-9} max={9} value={values.wbShiftR} onChange={v => set({ wbShiftR: v })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>WB Shift — Blue (B): {values.wbShiftB > 0 ? `+${values.wbShiftB}` : values.wbShiftB}</Label>
          <Slider min={-9} max={9} value={values.wbShiftB} onChange={v => set({ wbShiftB: v })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Dynamic Range</Label>
          <ToggleGroup options={["DR100", "DR200", "DR400", "DR-Auto"]} value={values.dynamicRange} onChange={v => set({ dynamicRange: v as RecipeValues["dynamicRange"] })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>D-Range Priority</Label>
          <ToggleGroup options={["Off", "Weak", "Strong"]} value={values.dRangePriority} onChange={v => set({ dRangePriority: v as RecipeValues["dRangePriority"] })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Highlight Tone{dRangeActive ? " (disabled — D-Range Priority active)" : `: ${values.highlightTone > 0 ? "+" : ""}${values.highlightTone}`}</Label>
          <Slider min={-2} max={4} step={0.5} value={values.highlightTone} onChange={v => set({ highlightTone: v })} disabled={dRangeActive} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Shadow Tone{dRangeActive ? " (disabled — D-Range Priority active)" : `: ${values.shadowTone > 0 ? "+" : ""}${values.shadowTone}`}</Label>
          <Slider min={-2} max={4} step={0.5} value={values.shadowTone} onChange={v => set({ shadowTone: v })} disabled={dRangeActive} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Color (Saturation): {values.color > 0 ? `+${values.color}` : values.color}</Label>
          <Slider min={-4} max={4} value={values.color} onChange={v => set({ color: v })} t={t} isDark={isDark} />
        </div>
      </Section>

      {/* ── Detail & Texture ── */}
      <Section title="Detail & Texture" t={t}>
        <div>
          <Label t={t}>Sharpness: {values.sharpness > 0 ? `+${values.sharpness}` : values.sharpness}</Label>
          <Slider min={-4} max={4} value={values.sharpness} onChange={v => set({ sharpness: v })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>High ISO NR: {values.highISONR > 0 ? `+${values.highISONR}` : values.highISONR}</Label>
          <Slider min={-4} max={4} value={values.highISONR} onChange={v => set({ highISONR: v })} t={t} isDark={isDark} />
        </div>

        <div>
          <Label t={t}>Clarity: {values.clarity > 0 ? `+${values.clarity}` : values.clarity}</Label>
          <Slider min={-5} max={5} value={values.clarity} onChange={v => set({ clarity: v })} t={t} isDark={isDark} />
        </div>

        {isMono && (
          <>
            <div>
              <Label t={t}>Monochromatic Color — WC (Warm/Cool): {values.monoWC > 0 ? `+${values.monoWC}` : values.monoWC}</Label>
              <Slider min={-9} max={9} value={values.monoWC} onChange={v => set({ monoWC: v })} t={t} isDark={isDark} />
            </div>
            <div>
              <Label t={t}>Monochromatic Color — MG (Magenta/Green): {values.monoMG > 0 ? `+${values.monoMG}` : values.monoMG}</Label>
              <Slider min={-9} max={9} value={values.monoMG} onChange={v => set({ monoMG: v })} t={t} isDark={isDark} />
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
