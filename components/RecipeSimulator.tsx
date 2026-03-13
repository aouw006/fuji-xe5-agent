"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Theme } from "@/lib/theme";

// ─── Film Simulation Base Presets ────────────────────────────────────────────
// Each sim defines a base CSS filter stack that approximates the look.
// Values are deltas applied ON TOP of a neutral image (brightness:1 contrast:1 saturate:1).

interface SimPreset {
  brightness: number;   // 0.8–1.2
  contrast: number;     // 0.8–1.4
  saturate: number;     // 0–2
  hueRotate: number;    // degrees
  sepia: number;        // 0–1
  invert: number;       // 0–1 (for special cases)
  shadowLift: number;   // 0–0.15 (adds rgba overlay for shadow lifting)
  warmth: number;       // -1 to 1 (negative = cool, positive = warm tint opacity)
}

const SIM_PRESETS: Record<string, SimPreset> = {
  "classic chrome":        { brightness: 0.97, contrast: 1.05, saturate: 0.75, hueRotate: 5,   sepia: 0.08, invert: 0, shadowLift: 0,    warmth: -0.05 },
  "classic neg":           { brightness: 0.95, contrast: 0.95, saturate: 0.85, hueRotate: 8,   sepia: 0.10, invert: 0, shadowLift: 0.06, warmth: 0.03  },
  "velvia":                { brightness: 1.02, contrast: 1.20, saturate: 1.55, hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0.02  },
  "velvia/vivid":          { brightness: 1.02, contrast: 1.20, saturate: 1.55, hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0.02  },
  "provia":                { brightness: 1.00, contrast: 1.05, saturate: 1.05, hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "provia/standard":       { brightness: 1.00, contrast: 1.05, saturate: 1.05, hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "astia":                 { brightness: 1.02, contrast: 0.95, saturate: 0.90, hueRotate: -3,  sepia: 0.05, invert: 0, shadowLift: 0.04, warmth: 0.06  },
  "astia/soft":            { brightness: 1.02, contrast: 0.95, saturate: 0.90, hueRotate: -3,  sepia: 0.05, invert: 0, shadowLift: 0.04, warmth: 0.06  },
  "pro neg hi":            { brightness: 1.00, contrast: 1.08, saturate: 0.95, hueRotate: -2,  sepia: 0.04, invert: 0, shadowLift: 0,    warmth: 0.04  },
  "pro neg std":           { brightness: 1.00, contrast: 0.95, saturate: 0.85, hueRotate: -2,  sepia: 0.05, invert: 0, shadowLift: 0.03, warmth: 0.04  },
  "eterna":                { brightness: 0.98, contrast: 0.88, saturate: 0.80, hueRotate: 2,   sepia: 0.06, invert: 0, shadowLift: 0.08, warmth: 0.02  },
  "eterna cinema":         { brightness: 0.98, contrast: 0.88, saturate: 0.80, hueRotate: 2,   sepia: 0.06, invert: 0, shadowLift: 0.08, warmth: 0.02  },
  "eterna bleach bypass":  { brightness: 0.96, contrast: 1.25, saturate: 0.45, hueRotate: 0,   sepia: 0.08, invert: 0, shadowLift: 0,    warmth: -0.03 },
  "reala ace":             { brightness: 1.00, contrast: 1.02, saturate: 1.00, hueRotate: 1,   sepia: 0.03, invert: 0, shadowLift: 0.02, warmth: 0.01  },
  "acros":                 { brightness: 0.98, contrast: 1.12, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "acros+r":               { brightness: 0.98, contrast: 1.18, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "acros+g":               { brightness: 0.98, contrast: 1.10, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "acros+ye":              { brightness: 0.98, contrast: 1.14, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "monochrome":            { brightness: 0.99, contrast: 1.05, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "monochrome+r":          { brightness: 0.99, contrast: 1.10, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "monochrome+g":          { brightness: 0.99, contrast: 1.04, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "monochrome+ye":         { brightness: 0.99, contrast: 1.07, saturate: 0,    hueRotate: 0,   sepia: 0,    invert: 0, shadowLift: 0,    warmth: 0     },
  "sepia":                 { brightness: 1.00, contrast: 1.00, saturate: 0,    hueRotate: 0,   sepia: 1.0,  invert: 0, shadowLift: 0,    warmth: 0     },
  "nostalgic neg":         { brightness: 0.96, contrast: 0.92, saturate: 0.78, hueRotate: 10,  sepia: 0.12, invert: 0, shadowLift: 0.07, warmth: 0.05  },
};

const DEFAULT_SIM: SimPreset = { brightness: 1, contrast: 1, saturate: 1, hueRotate: 0, sepia: 0, invert: 0, shadowLift: 0, warmth: 0 };

// ─── Parameter Parsers ────────────────────────────────────────────────────────

function parseLevel(val: string): number {
  const v = val.toLowerCase();
  if (v.includes("strong")) return 2;
  if (v.includes("weak")) return 1;
  if (v === "off" || v === "0") return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function parseWBShift(val: string): { r: number; b: number } {
  // e.g. "Auto (R: +3, B: -2)" or "Daylight R:+2 B:0"
  const rMatch = val.match(/R[:\s]*([+-]?\d+)/i);
  const bMatch = val.match(/B[:\s]*([+-]?\d+)/i);
  return {
    r: rMatch ? parseInt(rMatch[1]) : 0,
    b: bMatch ? parseInt(bMatch[1]) : 0,
  };
}

function getLabel(settings: { label: string; value: string }[], ...keywords: string[]): string | undefined {
  return settings.find(s => keywords.some(k => s.label.toLowerCase().includes(k.toLowerCase())))?.value;
}

// ─── Main Filter Builder ──────────────────────────────────────────────────────

export interface FilterResult {
  cssFilter: string;
  shadowLift: number;    // 0–0.15, applied as rgba(255,255,255,x) overlay
  warmthTint: number;    // -1 to 1
  grainOpacity: number;  // 0–0.5
  grainSize: "fine" | "coarse";
  hasData: boolean;
}

export function buildFilter(settings: { label: string; value: string }[]): FilterResult {
  if (!settings || settings.length === 0) {
    return { cssFilter: "none", shadowLift: 0, warmthTint: 0, grainOpacity: 0, grainSize: "fine", hasData: false };
  }

  // 1. Film simulation base
  const simVal = getLabel(settings, "film simulation", "film sim");
  const simKey = simVal?.toLowerCase().trim() || "";
  const sim = SIM_PRESETS[simKey] || DEFAULT_SIM;

  let brightness = sim.brightness;
  let contrast = sim.contrast;
  let saturate = sim.saturate;
  let hueRotate = sim.hueRotate;
  let sepia = sim.sepia;
  let shadowLift = sim.shadowLift;
  let warmth = sim.warmth;

  // 2. Highlight Tone (-2 to +4) — affects upper luminance
  const hlRaw = getLabel(settings, "highlight tone", "highlight");
  if (hlRaw !== undefined) {
    const hl = parseFloat(hlRaw);
    if (!isNaN(hl)) brightness += hl * 0.018;
  }

  // 3. Shadow Tone (-2 to +4) — negative = crush, positive = lift
  const shRaw = getLabel(settings, "shadow tone", "shadow");
  if (shRaw !== undefined) {
    const sh = parseFloat(shRaw);
    if (!isNaN(sh)) {
      if (sh > 0) shadowLift += sh * 0.025;
      else contrast += Math.abs(sh) * 0.04;
    }
  }

  // 4. Color (-4 to +4) — saturate mapping
  const colorRaw = getLabel(settings, "color");
  if (colorRaw !== undefined) {
    const c = parseFloat(colorRaw);
    if (!isNaN(c)) saturate += c * 0.1;
  }

  // 5. Sharpness (-4 to +4) — micro contrast nudge
  const sharpRaw = getLabel(settings, "sharpness", "sharp");
  if (sharpRaw !== undefined) {
    const sh = parseFloat(sharpRaw);
    if (!isNaN(sh)) contrast += sh * 0.012;
  }

  // 6. Clarity (-5 to +5) — midtone contrast
  const clarityRaw = getLabel(settings, "clarity");
  if (clarityRaw !== undefined) {
    const cl = parseFloat(clarityRaw);
    if (!isNaN(cl)) contrast += cl * 0.025;
  }

  // 7. Color Chrome Effect (Off/Weak/Strong) — deepen colour separation
  const ccRaw = getLabel(settings, "color chrome effect");
  if (ccRaw !== undefined) {
    const cc = parseLevel(ccRaw);
    saturate += cc * 0.08;
    contrast += cc * 0.02;
  }

  // 8. Color Chrome FX Blue (Off/Weak/Strong) — deepen blues
  const ccbRaw = getLabel(settings, "color chrome fx blue", "fx blue", "chrome fx blue");
  if (ccbRaw !== undefined) {
    const ccb = parseLevel(ccbRaw);
    hueRotate -= ccb * 2;
    saturate += ccb * 0.04;
  }

  // 9. White Balance + R/B shifts
  const wbRaw = getLabel(settings, "white balance");
  if (wbRaw !== undefined) {
    const wbLower = wbRaw.toLowerCase();
    if (wbLower.includes("tungsten") || wbLower.includes("incandescent")) { warmth -= 0.08; hueRotate -= 5; }
    else if (wbLower.includes("shade")) { warmth += 0.08; }
    else if (wbLower.includes("cloudy")) { warmth += 0.04; }
    else if (wbLower.includes("daylight") || wbLower.includes("sunny")) { warmth += 0.01; }
    else if (wbLower.includes("fluorescent")) { warmth -= 0.04; hueRotate += 3; }
    const shifts = parseWBShift(wbRaw);
    hueRotate += shifts.r * 1.5;
    warmth += shifts.r * 0.01;
    hueRotate -= shifts.b * 1.5;
  }

  // 10. Grain — level and size
  const grainRaw = getLabel(settings, "grain");
  let grainOpacity = 0;
  let grainSize: "fine" | "coarse" = "fine";
  if (grainRaw !== undefined) {
    const gl = grainRaw.toLowerCase();
    if (gl.includes("strong")) grainOpacity = 0.35;
    else if (gl.includes("weak")) grainOpacity = 0.18;
    grainSize = gl.includes("large") ? "coarse" : "fine";
  }

  // 11. Noise Reduction — no visual CSS equivalent, skip

  // Clamp values to safe ranges
  brightness = Math.max(0.6, Math.min(1.5, brightness));
  contrast   = Math.max(0.6, Math.min(1.8, contrast));
  saturate   = Math.max(0,   Math.min(2.5, saturate));
  sepia      = Math.max(0,   Math.min(1,   sepia));

  const cssFilter = [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    hueRotate !== 0 ? `hue-rotate(${hueRotate.toFixed(1)}deg)` : "",
    sepia > 0 ? `sepia(${sepia.toFixed(3)})` : "",
  ].filter(Boolean).join(" ");

  return { cssFilter, shadowLift: Math.max(0, Math.min(0.2, shadowLift)), warmthTint: Math.max(-0.15, Math.min(0.15, warmth)), grainOpacity, grainSize, hasData: true };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  settings: { label: string; value: string }[];
  recipeName: string;
  t: Theme;
  isDark: boolean;
  previewImage: string | null; // base64 data URL
  onImageUpload: (dataUrl: string) => void;
  compact?: boolean; // for thumbnail mode in list
}

export default function RecipeSimulator({ settings, recipeName, t, isDark, previewImage, onImageUpload, compact }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const filter = buildFilter(settings);

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

  if (compact && previewImage) {
    // Thumbnail mode — just the filtered image, no controls
    return (
      <div style={{ position: "relative", width: "100%", paddingBottom: "66%", borderRadius: "3px", overflow: "hidden", background: t.bgCard }}>
        <img src={previewImage} alt={recipeName}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: filter.cssFilter }} />
        {filter.shadowLift > 0 && (
          <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${filter.shadowLift})`, mixBlendMode: "screen", pointerEvents: "none" }} />
        )}
        {filter.warmthTint !== 0 && (
          <div style={{ position: "absolute", inset: 0, background: filter.warmthTint > 0 ? `rgba(255,200,120,${Math.abs(filter.warmthTint)})` : `rgba(120,160,255,${Math.abs(filter.warmthTint)})`, mixBlendMode: "soft-light", pointerEvents: "none" }} />
        )}
      </div>
    );
  }

  const borderColor = isDark ? "rgba(200,169,110,0.15)" : "rgba(176,136,64,0.2)";
  const goldBorder = isDark ? "rgba(200,169,110,0.25)" : "rgba(176,136,64,0.3)";

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
        // Upload zone
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `1px dashed ${dragging ? t.gold : borderColor}`,
            borderRadius: "4px",
            padding: "2rem",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            background: dragging ? t.goldDim : "transparent",
          }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", opacity: 0.4 }}>↑</div>
          <div style={{ fontSize: "0.68rem", color: t.textMuted, marginBottom: "0.2rem" }}>Upload a photo to preview this recipe</div>
          <div style={{ fontSize: "0.58rem", color: t.textFaint }}>Click or drag & drop · Stays in your browser, never uploaded</div>
        </div>
      ) : (
        // Preview panel
        <div style={{ position: "relative", borderRadius: "4px", overflow: "hidden", background: "#000" }}>
          {/* Filtered image */}
          <img src={previewImage} alt="Preview"
            style={{ width: "100%", display: "block", filter: filter.cssFilter, transition: "filter 0.4s ease" }} />

          {/* Shadow lift overlay */}
          {filter.shadowLift > 0 && (
            <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${filter.shadowLift})`, mixBlendMode: "screen", pointerEvents: "none", transition: "opacity 0.4s" }} />
          )}

          {/* Warmth/cool tint overlay */}
          {filter.warmthTint !== 0 && (
            <div style={{ position: "absolute", inset: 0, background: filter.warmthTint > 0 ? `rgba(255,200,120,${Math.abs(filter.warmthTint)})` : `rgba(120,160,255,${Math.abs(filter.warmthTint)})`, mixBlendMode: "soft-light", pointerEvents: "none", transition: "opacity 0.4s" }} />
          )}

          {/* Grain overlay */}
          {filter.grainOpacity > 0 && (
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: filter.grainOpacity, pointerEvents: "none", mixBlendMode: "overlay" }} xmlns="http://www.w3.org/2000/svg">
              <filter id="grain-sim">
                <feTurbulence type="fractalNoise" baseFrequency={filter.grainSize === "fine" ? "0.75" : "0.35"} numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#grain-sim)" />
            </svg>
          )}

          {/* Recipe name badge */}
          <div style={{ position: "absolute", bottom: "0.6rem", left: "0.6rem", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: "2px", padding: "0.2rem 0.5rem", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em" }}>
            {recipeName}
          </div>

          {/* Original toggle */}
          <OriginalToggle src={previewImage} filter={filter} />
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {previewImage && (
        <div style={{ fontSize: "0.52rem", color: t.textVeryFaint, marginTop: "0.4rem", letterSpacing: "0.06em" }}>
          CSS approximation only — not camera-accurate · Hold "Original" to compare
        </div>
      )}
    </div>
  );
}

// ─── Hold-to-compare original toggle ─────────────────────────────────────────
function OriginalToggle({ src, filter }: { src: string; filter: FilterResult }) {
  const [showing, setShowing] = useState(false);

  return (
    <button
      onMouseDown={() => setShowing(true)}
      onMouseUp={() => setShowing(false)}
      onMouseLeave={() => setShowing(false)}
      onTouchStart={() => setShowing(true)}
      onTouchEnd={() => setShowing(false)}
      style={{ position: "absolute", bottom: "0.6rem", right: "0.6rem", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "2px", padding: "0.2rem 0.5rem", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", transition: "background 0.1s" }}>
      {showing ? "Original" : "Hold: Original"}
      {showing && (
        <img src={src} alt="Original"
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: 999, background: "rgba(0,0,0,0.9)", filter: "none", pointerEvents: "none" }} />
      )}
    </button>
  );
}
