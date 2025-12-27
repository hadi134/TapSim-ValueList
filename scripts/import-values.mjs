import fs from "fs";

const OUT_FILE = "data/pets.json";
const PETS_FOLDER = "pets";

// helper: normalize pet names so different sources match better
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// median helper
function median(nums) {
  const a = nums.filter(n => typeof n === "number" && !isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

// ----- SOURCE 1: Zack repo (best open source)
// NOTE: If Zack's site doesn't have embedded JSON, this returns empty.
// We'll still keep structure for future.
async function sourceZack() {
  const url = "https://raw.githubusercontent.com/notrealzack/tap-simulator-values/main/index.html";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error("fetch failed");
    const html = await res.text();

    // Try to find embedded JSON array like: const pets = [...]
    const jsonMatch = html.match(/const\s+pets\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[1]);
        const pets = arr
          .filter(p => p?.name)
          .map(p => ({
            name: p.name,
            value: Number(p.value) || 0,
            rarity: p.rarity || null,
            source: "zack"
          }));
        console.log("✅ Zack parsed JSON:", pets.length);
        return pets;
      } catch (e) {}
    }

    console.log("⚠️ Zack had no embedded JSON (skip for now).");
    return [];
  } catch (e) {
    console.log("⚠️ Zack source failed:", e.message);
    return [];
  }
}

// ----- PLACEHOLDERS: MoonValues / Cosmo / ValuesKing
// These need specific endpoints discovered first.
async function sourceMoonValues() { return []; }
async function sourceCosmoValues() { return []; }
async function sourceValuesKing() { return []; }

// MAIN
async function run() {
  console.log("🔍 Importing values (median merge)...");

  // Load sources
  const all = [];
  const sources = [sourceZack, sourceMoonValues, sourceCosmoValues, sourceValuesKing];
  for (const fn of sources) {
    const out = await fn();
    all.push(...out);
  }

  console.log("✅ Total source entries:", all.length);

  // Load local pet images list
  const imageFiles = fs.readdirSync(PETS_FOLDER).filter(f => f.toLowerCase().endsWith(".png"));

  const localPets = imageFiles.map(f => ({
    name: f.replace(/\.png$/i, ""),
    key: normalizeName(f.replace(/\.png$/i, "")),
    image: `pets/${f}`
  }));

  // Map: normalized name -> array of source entries
  const map = new Map();
  for (const entry of all) {
    const key = normalizeName(entry.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }

  // Merge
  const merged = localPets.map(lp => {
    const entries = map.get(lp.key) || [];
    const vals = entries.map(e => Number(e.value) || 0).filter(v => v > 0);
    const finalValue = vals.length ? median(vals) : 0;

    const sourcesObj = {};
    for (const e of entries) sourcesObj[e.source] = Number(e.value) || 0;

    const rarity = entries.find(e => e.rarity)?.rarity || "Unknown";

    return {
      name: lp.name,
      rarity,
      value: finalValue,
      sources: sourcesObj,
      image: lp.image
    };
  });

  const output = {
    updated: new Date().toISOString().slice(0, 10),
    method: "median",
    pets: merged
  };

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  console.log("✅ Saved:", OUT_FILE);
  console.log("✅ Pets written:", merged.length);
}

run();
