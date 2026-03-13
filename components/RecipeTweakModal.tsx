"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Theme } from "@/lib/theme";
import { RecipeValues } from "./RecipeControls";
import { buildFilterFromValues } from "./RecipeSimulator";

// ─── Re-export types so RecipeGallery can import from one place ───────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FILM_SIMS_GROUPED = [
  { group: "Colour", sims: ["Provia/Standard", "Velvia/Vivid", "Astia/Soft", "Classic Chrome", "Reala Ace", "Pro Neg. Hi", "Pro Neg. Std", "Classic Neg.", "Nostalgic Neg.", "Eterna/Cinema", "Eterna Bleach Bypass"] },
  { group: "Monochrome", sims: ["Acros", "Acros+Ye", "Acros+R", "Acros+G", "Monochrome", "Monochrome+Ye", "Monochrome+R", "Monochrome+G", "Sepia"] },
];

const WB_OPTIONS = [
  "Auto (White Priority)", "Auto (Ambience Priority)",
  "Daylight", "Shade", "Fluorescent 1", "Fluorescent 2", "Fluorescent 3",
  "Incandescent", "Underwater",
  "2500K","3000K","3500K","4000K","4500K","5000K","5500K","6000K","6500K","7000K","7500K","8000K","8500K","9000K","9500K","10000K",
  "Custom 1", "Custom 2", "Custom 3",
];

const MONO_SIMS = ["Acros","Acros+Ye","Acros+R","Acros+G","Monochrome","Monochrome+Ye","Monochrome+R","Monochrome+G","Sepia"];

type ToggleVal = "Off" | "Weak" | "Strong";

// ─── Sub-components ───────────────────────────────────────────────────────────

function CLabel({ children, t }: { children: React.ReactNode; t: Theme }) {
  return <div style={{ fontSize: "0.5rem", color: t.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.3rem" }}>{children}</div>;
}

function SectionHead({ title, t }: { title: string; t: Theme }) {
  return <div style={{ fontSize: "0.48rem", color: t.textFaint, letterSpacing: "0.18em", textTransform: "uppercase", paddingBottom: "0.4rem", borderBottom: `1px solid ${t.border}`, marginBottom: "0.7rem", marginTop: "1.1rem" }}>{title}</div>;
}

function Toggle({ options, value, onChange, disabled, t, isDark }: {
  options: string[]; value: string; onChange: (v: string) => void;
  disabled?: boolean; t: Theme; isDark: boolean;
}) {
  const gold = isDark ? "#c8a96e" : "#b08840";
  return (
    <div style={{ display: "flex", gap: "2px", opacity: disabled ? 0.35 : 1 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} onClick={() => !disabled && onChange(opt)} style={{
            flex: 1, padding: "0.28rem 0", fontSize: "0.55rem", fontFamily: "'DM Mono', monospace",
            borderRadius: "2px", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.12s",
            background: active ? (isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.18)") : "transparent",
            border: `1px solid ${active ? (isDark ? "rgba(200,169,110,0.35)" : "rgba(176,136,64,0.4)") : t.border}`,
            color: active ? gold : t.textMuted,
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

function Slider({ min, max, step = 1, value, onChange, t, isDark }: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; t: Theme; isDark: boolean;
}) {
  const gold = isDark ? "#c8a96e" : "#b08840";
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ fontSize: "0.5rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", width: "22px", textAlign: "right", flexShrink: 0 }}>{min}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, appearance: "none", WebkitAppearance: "none", height: "3px", borderRadius: "2px", outline: "none", cursor: "pointer",
          background: `linear-gradient(to right, ${gold} ${pct}%, ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"} ${pct}%)` }} />
      <span style={{ fontSize: "0.5rem", color: t.textVeryFaint, fontFamily: "'DM Mono', monospace", width: "22px", flexShrink: 0 }}>{max}</span>
      <span style={{ fontSize: "0.65rem", color: gold, fontFamily: "'DM Mono', monospace", width: "34px", textAlign: "right", flexShrink: 0, fontWeight: 600 }}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>{children}</div>;
}

function CameraOnlyBadge({ label, value, t }: { label: string; value: string; t: Theme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0.6rem", border: `1px solid ${t.border}`, borderRadius: "3px", opacity: 0.65 }}>
      <span style={{ fontSize: "0.52rem", color: t.textFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: "0.62rem", color: t.textMuted, fontFamily: "'DM Mono', monospace" }}>{value}</span>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  values: RecipeValues;
  baseValues: RecipeValues;
  onChange: (v: RecipeValues) => void;
  onReset: () => void;
  previewImage: string;
  recipeName: string;
  t: Theme;
  isDark: boolean;
}

export default function RecipeTweakModal({ open, onClose, values, baseValues, onChange, onReset, previewImage, recipeName, t, isDark }: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  const filter = buildFilterFromValues(values);
  const gold = isDark ? "#c8a96e" : "#b08840";
  const isMono = MONO_SIMS.includes(values.filmSimulation);
  const dRangeActive = values.dRangePriority !== "Off";

  const set = (patch: Partial<RecipeValues>) => onChange({ ...values, ...patch });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <style>{`
        input[type=range]::-webkit-slider-thumb { appearance:none; width:13px; height:13px; border-radius:50%; background:${gold}; cursor:pointer; border:none; }
        input[type=range]::-moz-range-thumb { width:13px; height:13px; border-radius:50%; background:${gold}; cursor:pointer; border:none; }
        .tweak-scroll::-webkit-scrollbar { width: 4px; }
        .tweak-scroll::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(200,169,110,0.2)" : "rgba(0,0,0,0.15)"}; border-radius: 2px; }
      `}</style>

      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, backdropFilter: "blur(6px)" }} />

      {/* Modal */}
      <div style={{ position: "fixed", inset: "1.5%", zIndex: 201, display: "flex", borderRadius: "8px", overflow: "hidden", border: `1px solid ${t.borderSidebar}`, animation: "fadeIn 0.18s ease" }}>

        {/* ── Left: sticky live preview ── */}
        <div style={{ flex: "0 0 55%", background: "#0a0806", display: "flex", flexDirection: "column", position: "relative" }}>
          {/* Image area */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            <img
              src={previewImage}
              alt="Preview"
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: showOriginal ? "none" : filter.cssFilter, transition: "filter 0.2s ease" }}
            />
            {/* Overlays */}
            {!showOriginal && filter.shadowLift > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${filter.shadowLift})`, mixBlendMode: "screen", pointerEvents: "none" }} />}
            {!showOriginal && filter.warmthTint !== 0 && <div style={{ position: "absolute", inset: 0, background: filter.warmthTint > 0 ? `rgba(255,200,120,${Math.abs(filter.warmthTint)})` : `rgba(120,160,255,${Math.abs(filter.warmthTint)})`, mixBlendMode: "soft-light", pointerEvents: "none" }} />}
            {!showOriginal && filter.monoTintWarm !== 0 && <div style={{ position: "absolute", inset: 0, background: filter.monoTintWarm > 0 ? `rgba(200,160,100,${Math.abs(filter.monoTintWarm)})` : `rgba(100,140,200,${Math.abs(filter.monoTintWarm)})`, mixBlendMode: "soft-light", pointerEvents: "none" }} />}
            {!showOriginal && filter.monoTintMG !== 0 && <div style={{ position: "absolute", inset: 0, background: filter.monoTintMG > 0 ? `rgba(220,80,180,${Math.abs(filter.monoTintMG)})` : `rgba(60,180,80,${Math.abs(filter.monoTintMG)})`, mixBlendMode: "soft-light", pointerEvents: "none" }} />}
            {!showOriginal && filter.grainOpacity > 0 && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: filter.grainOpacity, pointerEvents: "none", mixBlendMode: "overlay" }} xmlns="http://www.w3.org/2000/svg">
                <filter id="tweak-grain"><feTurbulence type="fractalNoise" baseFrequency={filter.grainSize === "fine" ? "0.75" : "0.35"} numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
                <rect width="100%" height="100%" filter="url(#tweak-grain)" />
              </svg>
            )}
          </div>

          {/* Bottom bar */}
          <div style={{ padding: "0.6rem 1rem", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>{recipeName}</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)}
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", padding: "0.25rem 0.7rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.55rem", fontFamily: "'DM Mono', monospace" }}>
                Hold: Original
              </button>
              <button onClick={onReset}
                style={{ background: "transparent", border: `1px solid rgba(200,169,110,0.3)`, color: gold, padding: "0.25rem 0.7rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.55rem", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
                Reset
              </button>
              <button onClick={onClose}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", width: "28px", height: "28px", borderRadius: "2px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: scrollable controls ── */}
        <div className="tweak-scroll" style={{ flex: 1, overflowY: "auto", background: t.bgSidebar, padding: "1.25rem 1.25rem 2rem" }}>

          {/* ── Film Simulation & Effects ── */}
          <SectionHead title="Film Simulation & Effects" t={t} />

          <Row>
            <CLabel t={t}>Film Simulation</CLabel>
            <select value={values.filmSimulation} onChange={e => set({ filmSimulation: e.target.value })}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.border}`, color: t.text, borderRadius: "3px", padding: "0.4rem 0.6rem", fontSize: "0.7rem", fontFamily: "'DM Mono', monospace", cursor: "pointer", outline: "none" }}
              onFocus={e => e.target.style.borderColor = isDark ? "rgba(200,169,110,0.4)" : "rgba(176,136,64,0.45)"}
              onBlur={e => e.target.style.borderColor = t.border}>
              {FILM_SIMS_GROUPED.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.sims.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
          </Row>

          <Row>
            <CLabel t={t}>Grain — Roughness</CLabel>
            <Toggle options={["Off","Weak","Strong"]} value={values.grainRoughness} onChange={v => set({ grainRoughness: v as ToggleVal })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Grain — Size{values.grainRoughness === "Off" ? " (enable Roughness first)" : ""}</CLabel>
            <Toggle options={["Small","Large"]} value={values.grainSize} onChange={v => set({ grainSize: v as "Small"|"Large" })} disabled={values.grainRoughness === "Off"} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Color Chrome Effect</CLabel>
            <Toggle options={["Off","Weak","Strong"]} value={values.colorChromeEffect} onChange={v => set({ colorChromeEffect: v as ToggleVal })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Color Chrome FX Blue</CLabel>
            <Toggle options={["Off","Weak","Strong"]} value={values.colorChromeFXBlue} onChange={v => set({ colorChromeFXBlue: v as ToggleVal })} t={t} isDark={isDark} />
          </Row>

          {/* ── Light & Color ── */}
          <SectionHead title="Light & Color" t={t} />

          <Row>
            <CLabel t={t}>White Balance</CLabel>
            <select value={values.whiteBalance} onChange={e => set({ whiteBalance: e.target.value })}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.border}`, color: t.text, borderRadius: "3px", padding: "0.4rem 0.6rem", fontSize: "0.7rem", fontFamily: "'DM Mono', monospace", cursor: "pointer", outline: "none" }}
              onFocus={e => e.target.style.borderColor = isDark ? "rgba(200,169,110,0.4)" : "rgba(176,136,64,0.45)"}
              onBlur={e => e.target.style.borderColor = t.border}>
              {WB_OPTIONS.map(wb => <option key={wb} value={wb}>{wb}</option>)}
            </select>
          </Row>

          <Row>
            <CLabel t={t}>WB Shift R: {values.wbShiftR > 0 ? `+${values.wbShiftR}` : values.wbShiftR}</CLabel>
            <Slider min={-9} max={9} value={values.wbShiftR} onChange={v => set({ wbShiftR: v })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>WB Shift B: {values.wbShiftB > 0 ? `+${values.wbShiftB}` : values.wbShiftB}</CLabel>
            <Slider min={-9} max={9} value={values.wbShiftB} onChange={v => set({ wbShiftB: v })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>D-Range Priority</CLabel>
            <Toggle options={["Off","Weak","Strong"]} value={values.dRangePriority} onChange={v => set({ dRangePriority: v as ToggleVal })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Highlight Tone{dRangeActive ? " — disabled (D-Range Priority active)" : `: ${values.highlightTone > 0 ? "+" : ""}${values.highlightTone}`}</CLabel>
            <Slider min={-2} max={4} step={0.5} value={values.highlightTone} onChange={v => set({ highlightTone: v })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Shadow Tone{dRangeActive ? " — disabled (D-Range Priority active)" : `: ${values.shadowTone > 0 ? "+" : ""}${values.shadowTone}`}</CLabel>
            <Slider min={-2} max={4} step={0.5} value={values.shadowTone} onChange={v => set({ shadowTone: v })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Color (Saturation): {values.color > 0 ? `+${values.color}` : values.color}</CLabel>
            <Slider min={-4} max={4} value={values.color} onChange={v => set({ color: v })} t={t} isDark={isDark} />
          </Row>

          {/* ── Detail & Texture ── */}
          <SectionHead title="Detail & Texture" t={t} />

          <Row>
            <CLabel t={t}>Sharpness: {values.sharpness > 0 ? `+${values.sharpness}` : values.sharpness}</CLabel>
            <Slider min={-4} max={4} value={values.sharpness} onChange={v => set({ sharpness: v })} t={t} isDark={isDark} />
          </Row>

          <Row>
            <CLabel t={t}>Clarity: {values.clarity > 0 ? `+${values.clarity}` : values.clarity}</CLabel>
            <Slider min={-5} max={5} value={values.clarity} onChange={v => set({ clarity: v })} t={t} isDark={isDark} />
          </Row>

          {isMono && (
            <>
              <Row>
                <CLabel t={t}>Monochromatic Color WC (Warm/Cool): {values.monoWC > 0 ? `+${values.monoWC}` : values.monoWC}</CLabel>
                <Slider min={-9} max={9} value={values.monoWC} onChange={v => set({ monoWC: v })} t={t} isDark={isDark} />
              </Row>
              <Row>
                <CLabel t={t}>Monochromatic Color MG (Magenta/Green): {values.monoMG > 0 ? `+${values.monoMG}` : values.monoMG}</CLabel>
                <Slider min={-9} max={9} value={values.monoMG} onChange={v => set({ monoMG: v })} t={t} isDark={isDark} />
              </Row>
            </>
          )}

          {/* ── Camera Only ── */}
          <SectionHead title="Camera Settings Only — No Visual Preview Effect" t={t} />
          <div style={{ fontSize: "0.55rem", color: t.textVeryFaint, marginBottom: "0.75rem", lineHeight: 1.6 }}>
            These settings affect how the camera captures the image but have no equivalent CSS filter approximation.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <CameraOnlyBadge label="Smooth Skin Effect" value={values.smoothSkinEffect} t={t} />
            <CameraOnlyBadge label="Dynamic Range" value={values.dynamicRange} t={t} />
            <CameraOnlyBadge label="High ISO NR" value={values.highISONR > 0 ? `+${values.highISONR}` : String(values.highISONR)} t={t} />
          </div>

        </div>
      </div>
    </>
  );
}
