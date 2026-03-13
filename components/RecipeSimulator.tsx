"use client";
import React, { useState, useRef, useCallback } from "react";
import { Theme } from "@/lib/theme";
import { RecipeValues } from "./RecipeControls";

interface SimPreset {
  brightness: number; contrast: number; saturate: number;
  hueRotate: number; sepia: number; shadowLift: number; warmth: number;
}

const SIM_PRESETS: Record<string, SimPreset> = {
  "provia/standard":      { brightness: 1.00, contrast: 1.05, saturate: 1.05, hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "velvia/vivid":         { brightness: 1.02, contrast: 1.20, saturate: 1.55, hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0.02  },
  "astia/soft":           { brightness: 1.02, contrast: 0.95, saturate: 0.90, hueRotate: -3, sepia: 0.05, shadowLift: 0.04, warmth: 0.06  },
  "classic chrome":       { brightness: 0.97, contrast: 1.05, saturate: 0.75, hueRotate: 5,  sepia: 0.08, shadowLift: 0,    warmth: -0.05 },
  "reala ace":            { brightness: 1.00, contrast: 1.02, saturate: 1.00, hueRotate: 1,  sepia: 0.03, shadowLift: 0.02, warmth: 0.01  },
  "pro neg. hi":          { brightness: 1.00, contrast: 1.08, saturate: 0.95, hueRotate: -2, sepia: 0.04, shadowLift: 0,    warmth: 0.04  },
  "pro neg. std":         { brightness: 1.00, contrast: 0.95, saturate: 0.85, hueRotate: -2, sepia: 0.05, shadowLift: 0.03, warmth: 0.04  },
  "classic neg.":         { brightness: 0.95, contrast: 0.95, saturate: 0.85, hueRotate: 8,  sepia: 0.10, shadowLift: 0.06, warmth: 0.03  },
  "nostalgic neg.":       { brightness: 0.96, contrast: 0.92, saturate: 0.78, hueRotate: 10, sepia: 0.12, shadowLift: 0.07, warmth: 0.05  },
  "eterna/cinema":        { brightness: 0.98, contrast: 0.88, saturate: 0.80, hueRotate: 2,  sepia: 0.06, shadowLift: 0.08, warmth: 0.02  },
  "eterna bleach bypass": { brightness: 0.96, contrast: 1.25, saturate: 0.45, hueRotate: 0,  sepia: 0.08, shadowLift: 0,    warmth: -0.03 },
  "acros":                { brightness: 0.98, contrast: 1.12, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "acros+ye":             { brightness: 0.98, contrast: 1.14, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "acros+r":              { brightness: 0.98, contrast: 1.18, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "acros+g":              { brightness: 0.98, contrast: 1.10, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "monochrome":           { brightness: 0.99, contrast: 1.05, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "monochrome+ye":        { brightness: 0.99, contrast: 1.07, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "monochrome+r":         { brightness: 0.99, contrast: 1.10, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "monochrome+g":         { brightness: 0.99, contrast: 1.04, saturate: 0,    hueRotate: 0,  sepia: 0,    shadowLift: 0,    warmth: 0     },
  "sepia":                { brightness: 1.00, contrast: 1.00, saturate: 0,    hueRotate: 0,  sepia: 1.0,  shadowLift: 0,    warmth: 0     },
};

const DEFAULT_SIM: SimPreset = { brightness: 1, contrast: 1, saturate: 1, hueRotate: 0, sepia: 0, shadowLift: 0, warmth: 0 };

export interface FilterResult {
  cssFilter: string;
  shadowLift: number;
  warmthTint: number;
  grainOpacity: number;
  grainSize: "fine" | "coarse";
  monoTintWarm: number;
  monoTintMG: number;
}

export function buildFilterFromValues(v: RecipeValues): FilterResult {
  const sim = SIM_PRESETS[v.filmSimulation.toLowerCase()] || DEFAULT_SIM;

  let brightness = sim.brightness;
  let contrast   = sim.contrast;
  let saturate   = sim.saturate;
  let hueRotate  = sim.hueRotate;
  let sepia      = sim.sepia;
  let shadowLift = sim.shadowLift;
  let warmth     = sim.warmth;

  brightness += v.highlightTone * 0.018;
  if (v.shadowTone > 0) shadowLift += v.shadowTone * 0.025;
  else contrast += Math.abs(v.shadowTone) * 0.04;
  saturate  += v.color * 0.1;
  contrast  += v.sharpness * 0.012;
  contrast  += v.clarity * 0.025;

  const ccLevel  = v.colorChromeEffect  === "Strong" ? 2 : v.colorChromeEffect  === "Weak" ? 1 : 0;
  const ccbLevel = v.colorChromeFXBlue  === "Strong" ? 2 : v.colorChromeFXBlue  === "Weak" ? 1 : 0;
  saturate  += ccLevel  * 0.08;  contrast  += ccLevel  * 0.02;
  hueRotate -= ccbLevel * 2;     saturate  += ccbLevel * 0.04;

  const wb = v.whiteBalance.toLowerCase();
  if (wb.includes("incandescent"))      { warmth -= 0.08; hueRotate -= 5; }
  else if (wb.includes("shade"))        { warmth += 0.08; }
  else if (wb.includes("fluorescent"))  { warmth -= 0.04; hueRotate += 3; }
  else if (wb.includes("daylight"))     { warmth += 0.01; }
  else if (wb.includes("underwater"))   { warmth -= 0.06; hueRotate += 8; }
  else if (wb.includes("ambience"))     { warmth += 0.04; }
  const kMatch = wb.match(/(\d+)k/);
  if (kMatch) {
    const k = parseInt(kMatch[1]);
    warmth    += (5500 - k) / 5500 * 0.08;
    hueRotate += (5500 - k) / 5500 * 3;
  }
  hueRotate += v.wbShiftR * 1.5;  warmth += v.wbShiftR * 0.008;
  hueRotate -= v.wbShiftB * 1.5;  warmth -= v.wbShiftB * 0.008;

  if (v.dRangePriority !== "Off") {
    const d = v.dRangePriority === "Strong" ? 0.06 : 0.03;
    brightness -= d;  shadowLift += d;
  }

  const grainOpacity = v.grainRoughness === "Strong" ? 0.35 : v.grainRoughness === "Weak" ? 0.18 : 0;
  const grainSize: "fine" | "coarse" = v.grainSize === "Large" ? "coarse" : "fine";
  const monoTintWarm = v.monoWC / 9 * 0.06;
  const monoTintMG   = v.monoMG / 9 * 0.04;

  brightness = Math.max(0.6,  Math.min(1.5,  brightness));
  contrast   = Math.max(0.6,  Math.min(1.8,  contrast));
  saturate   = Math.max(0,    Math.min(2.5,  saturate));
  sepia      = Math.max(0,    Math.min(1,    sepia));

  const cssFilter = [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    hueRotate !== 0 ? `hue-rotate(${hueRotate.toFixed(1)}deg)` : "",
    sepia > 0 ? `sepia(${sepia.toFixed(3)})` : "",
  ].filter(Boolean).join(" ");

  return {
    cssFilter,
    shadowLift: Math.max(0, Math.min(0.2, shadowLift)),
    warmthTint: Math.max(-0.15, Math.min(0.15, warmth)),
    grainOpacity, grainSize, monoTintWarm, monoTintMG,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  values: RecipeValues;
  recipeName: string;
  t: Theme;
  isDark: boolean;
  previewImage: string | null;
  onImageUpload: (dataUrl: string) => void;
  compact?: boolean;
}

export default function RecipeSimulator({ values, recipeName, t, isDark, previewImage, onImageUpload, compact }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const filter = buildFilterFromValues(values);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => { if (e.target?.result) onImageUpload(e.target.result as string); };
    reader.readAsDataURL(file);
  }, [onImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const Overlays = () => (
    <>
      {filter.shadowLift > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${filter.shadowLift})`, mixBlendMode: "screen", pointerEvents: "none", transition: "opacity 0.25s" }} />}
      {filter.warmthTint !== 0 && <div style={{ position: "absolute", inset: 0, background: filter.warmthTint > 0 ? `rgba(255,200,120,${Math.abs(filter.warmthTint)})` : `rgba(120,160,255,${Math.abs(filter.warmthTint)})`, mixBlendMode: "soft-light", pointerEvents: "none", transition: "opacity 0.25s" }} />}
      {filter.monoTintWarm !== 0 && <div style={{ position: "absolute", inset: 0, background: filter.monoTintWarm > 0 ? `rgba(200,160,100,${Math.abs(filter.monoTintWarm)})` : `rgba(100,140,200,${Math.abs(filter.monoTintWarm)})`, mixBlendMode: "soft-light", pointerEvents: "none" }} />}
      {filter.monoTintMG !== 0 && <div style={{ position: "absolute", inset: 0, background: filter.monoTintMG > 0 ? `rgba(220,80,180,${Math.abs(filter.monoTintMG)})` : `rgba(60,180,80,${Math.abs(filter.monoTintMG)})`, mixBlendMode: "soft-light", pointerEvents: "none" }} />}
      {filter.grainOpacity > 0 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: filter.grainOpacity, pointerEvents: "none", mixBlendMode: "overlay" }} xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-sim">
            <feTurbulence type="fractalNoise" baseFrequency={filter.grainSize === "fine" ? "0.75" : "0.35"} numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-sim)" />
        </svg>
      )}
    </>
  );

  if (compact && previewImage) {
    return (
      <div style={{ position: "relative", width: "100%", paddingBottom: "66%", overflow: "hidden", background: t.bgCard }}>
        <img src={previewImage} alt={recipeName} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: filter.cssFilter, transition: "filter 0.25s" }} />
        <Overlays />
      </div>
    );
  }

  const borderColor = isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.2)";

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <div style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.6rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Preview Simulator</span>
        {previewImage && (
          <button onClick={() => fileRef.current?.click()}
            style={{ background: "transparent", border: `1px solid ${borderColor}`, color: t.textFaint, padding: "0.15rem 0.5rem", borderRadius: "2px", cursor: "pointer", fontSize: "0.52rem", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.gold; e.currentTarget.style.color = t.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.color = t.textFaint; }}>
            Change photo
          </button>
        )}
      </div>

      {!previewImage ? (
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
          style={{ border: `1px dashed ${dragging ? t.gold : borderColor}`, borderRadius: "4px", padding: "2.5rem 2rem", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: dragging ? t.goldDim : "transparent" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", opacity: 0.4 }}>↑</div>
          <div style={{ fontSize: "0.68rem", color: t.textMuted, marginBottom: "0.25rem" }}>Upload a photo to preview this recipe</div>
          <div style={{ fontSize: "0.58rem", color: t.textFaint }}>Click or drag & drop · Stays in your browser, never uploaded</div>
        </div>
      ) : (
        <div style={{ position: "relative", borderRadius: "4px", overflow: "hidden", background: "#000" }}>
          <img src={previewImage} alt="Preview" style={{ width: "100%", display: "block", filter: filter.cssFilter, transition: "filter 0.25s ease" }} />
          <Overlays />
          <div style={{ position: "absolute", bottom: "0.6rem", left: "0.6rem", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: "2px", padding: "0.2rem 0.5rem", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
            {recipeName}
          </div>
          <OriginalToggle src={previewImage} />
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {previewImage && <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, marginTop: "0.4rem", letterSpacing: "0.06em" }}>CSS approximation only — not camera-accurate · Hold "Original" to compare</div>}
    </div>
  );
}

function OriginalToggle({ src }: { src: string }) {
  const [showing, setShowing] = useState(false);
  return (
    <button onMouseDown={() => setShowing(true)} onMouseUp={() => setShowing(false)} onMouseLeave={() => setShowing(false)} onTouchStart={() => setShowing(true)} onTouchEnd={() => setShowing(false)}
      style={{ position: "absolute", bottom: "0.6rem", right: "0.6rem", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "2px", padding: "0.2rem 0.5rem", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
      {showing ? "Original" : "Hold: Original"}
      {showing && <img src={src} alt="Original" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 999, background: "rgba(0,0,0,0.9)", filter: "none", pointerEvents: "none" }} />}
    </button>
  );
}
