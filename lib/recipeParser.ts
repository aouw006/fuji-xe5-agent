export interface ParsedRecipe {
  name: string;
  author: string;
  mood: string;
  bestFor: string;
  settings: { label: string; value: string }[];
}

const SETTING_KEYS = [
  "Film Simulation",
  "Grain Effect",
  "Grain",
  "Color Chrome Effect",
  "Color Chrome FX Blue",
  "Color Chrome FX",
  "White Balance",
  "Highlight Tone",
  "Shadow Tone",
  "Color",
  "Sharpness",
  "Noise Reduction",
  "Clarity",
  "Dynamic Range",
  "Tone Curve",
  "ISO",
];

export function parseRecipeFromText(text: string): ParsedRecipe | null {
  try {
    // Must contain film simulation settings to be a recipe
    const hasFilmSim = /film simulation/i.test(text);
    const hasSettings = SETTING_KEYS.filter(k =>
      new RegExp(k, "i").test(text)
    ).length >= 4;

    if (!hasFilmSim || !hasSettings) return null;

    // Extract recipe name — look for bold header or ## header
    let name = "Untitled Recipe";
    const nameMatch =
      text.match(/\*\*([^*]+(?:Recipe|Look|Style|Film|Chrome|Neg|Velvia|Provia|Eterna|Acros)[^*]*)\*\*/i) ||
      text.match(/##\s+([^\n]+)/m) ||
      text.match(/\*\*([A-Z][^*]{3,40})\*\*/);
    if (nameMatch) name = nameMatch[1].trim();

    // Extract author
    let author = "XE5 Research Agent";
    const authorMatch = text.match(/(?:by|recipe by|created by|from|via|source:?)\s+([^\n,\.]+)/i);
    if (authorMatch) author = authorMatch[1].trim();
    if (/fuji\s*x\s*weekly/i.test(text)) author = "Fuji X Weekly";
    if (/ritchie\s*roesch/i.test(text)) author = "Ritchie Roesch / Fuji X Weekly";

    // Extract mood/description
    let mood = "";
    const moodMatch =
      text.match(/mood:?\s*([^\n]+)/i) ||
      text.match(/\*([^*]{20,120})\*/m) ||
      text.match(/look[:\s]+([^\n]{20,100})/i);
    if (moodMatch) mood = moodMatch[1].trim().replace(/^["']|["']$/g, "");

    // Extract "best for"
    let bestFor = "";
    const bestForMatch = text.match(/best\s+for:?\s*([^\n]+)/i);
    if (bestForMatch) bestFor = bestForMatch[1].trim().replace(/^\*+|\*+$/g, "");

    // Extract settings
    const settings: { label: string; value: string }[] = [];
    for (const key of SETTING_KEYS) {
      const regex = new RegExp(`${key}[:\\s*]+([^\\n\\|]+)`, "i");
      const match = text.match(regex);
      if (match) {
        const value = match[1]
          .trim()
          .replace(/^\*+|\*+$/g, "")
          .replace(/\s*[|:]\s*.*$/, "")
          .trim();
        if (value && value.length < 60) {
          settings.push({ label: key, value });
        }
      }
    }

    if (settings.length < 3) return null;

    return { name, author, mood, bestFor, settings };
  } catch {
    return null;
  }
}

// ─── Parse multiple recipes from a single response ───────────────────────────

export function parseAllRecipesFromText(text: string): ParsedRecipe[] {
  // Split on recipe boundaries — bold headers, ## headers, or "---" dividers
  // Strategy: find all bold-header positions that look like recipe names, then
  // slice the text between them and parse each chunk individually.

  const results: ParsedRecipe[] = [];

  // Must have film simulation at all to bother
  if (!/film simulation/i.test(text)) return results;

  // Find split points: lines starting with ** or ## that contain a recipe-like name
  // Also split on --- dividers
  const splitRegex = /(?=\n\*\*[^*\n]{3,60}\*\*|\n##\s+[^\n]+|\n---+\n)/g;
  const chunks = text.split(splitRegex).filter(c => c.trim().length > 0);

  if (chunks.length <= 1) {
    // No splits found — try parsing the whole thing as one recipe
    const single = parseRecipeFromText(text);
    if (single) results.push(single);
    return results;
  }

  for (const chunk of chunks) {
    // Only parse chunks that contain film simulation settings
    if (/film simulation/i.test(chunk)) {
      const recipe = parseRecipeFromText(chunk);
      if (recipe) results.push(recipe);
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}
