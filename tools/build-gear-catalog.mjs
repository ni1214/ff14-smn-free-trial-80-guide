import fs from "node:fs/promises";
import { mapLimit } from "./gear-detail-utils.mjs";

const BASE = "https://jp.finalfantasyxiv.com";
const USER_AGENT = "Mozilla/5.0";
const MAX_LEVEL = 100;

const jobs = [
  { id: "PLD", label: "ナイト", min: 1, role: "tank", classjob: 19, classId: 1, weaponCategories: [2], offhand: true },
  { id: "WAR", label: "戦士", min: 1, role: "tank", classjob: 21, classId: 3, weaponCategories: [3] },
  { id: "DRK", label: "暗黒騎士", min: 30, role: "tank", classjob: 32, weaponCategories: [87] },
  { id: "GNB", label: "ガンブレイカー", min: 60, role: "tank", classjob: 37, weaponCategories: [106] },
  { id: "WHM", label: "白魔道士", min: 1, role: "healer", classjob: 24, classId: 6, weaponCategories: [9, 8] },
  { id: "SCH", label: "学者", min: 30, role: "healer", classjob: 28, weaponCategories: [98] },
  { id: "AST", label: "占星術師", min: 30, role: "healer", classjob: 33, weaponCategories: [89] },
  { id: "MNK", label: "モンク", min: 1, role: "melee", classjob: 20, classId: 2, weaponCategories: [1] },
  { id: "DRG", label: "竜騎士", min: 1, role: "melee", classjob: 22, classId: 4, weaponCategories: [5] },
  { id: "NIN", label: "忍者", min: 1, role: "melee", classjob: 30, classId: 29, weaponCategories: [84] },
  { id: "SAM", label: "侍", min: 50, role: "melee", classjob: 34, weaponCategories: [96] },
  { id: "RPR", label: "リーパー", min: 70, role: "melee", classjob: 39, weaponCategories: [108] },
  { id: "BRD", label: "吟遊詩人", min: 1, role: "ranged", classjob: 23, classId: 5, weaponCategories: [4] },
  { id: "MCH", label: "機工士", min: 30, role: "ranged", classjob: 31, weaponCategories: [88] },
  { id: "DNC", label: "踊り子", min: 60, role: "ranged", classjob: 38, weaponCategories: [107] },
  { id: "VPR", label: "ヴァイパー", min: 80, role: "melee", classjob: 41, weaponCategories: [110] },
  { id: "BLM", label: "黒魔道士", min: 1, role: "caster", classjob: 25, classId: 7, weaponCategories: [7, 6] },
  { id: "SMN", label: "召喚士", min: 1, role: "caster", classjob: 27, classId: 26, weaponCategories: [10] },
  { id: "RDM", label: "赤魔道士", min: 50, role: "caster", classjob: 35, weaponCategories: [97] },
  { id: "PCT", label: "ピクトマンサー", min: 80, role: "caster", classjob: 42, weaponCategories: [111] },
  { id: "SGE", label: "賢者", min: 70, role: "healer", classjob: 40, weaponCategories: [109] }
];

const slotCategories = [
  { slot: "MainHand", label: "武器", category2: 1, weapon: true },
  { slot: "OffHand", label: "盾", category2: 3, category3: 11, jobs: ["PLD"] },
  { slot: "Head", label: "頭", category2: 3, category3: 34 },
  { slot: "Body", label: "胴", category2: 3, category3: 35 },
  { slot: "Gloves", label: "手", category2: 3, category3: 37 },
  { slot: "Legs", label: "脚", category2: 3, category3: 36 },
  { slot: "Feet", label: "足", category2: 3, category3: 38 },
  { slot: "Ears", label: "耳", category2: 4, category3: 41 },
  { slot: "Neck", label: "首", category2: 4, category3: 40 },
  { slot: "Wrists", label: "腕", category2: 4, category3: 42 },
  { slot: "FingerL", label: "指", category2: 4, category3: 43 }
];

const bands = Array.from({ length: Math.ceil(MAX_LEVEL / 5) }, (_, index) => {
  const min = index * 5 + 1;
  const max = Math.min(MAX_LEVEL, min + 4);
  return { key: String(min), min, max, label: `Lv${min}-${max}` };
});

const recommendedSeriesByBand = {
  46: "ガーロンド",
  56: "イディル",
  66: "スカエウァ",
  76: "クリプトラーカー",
  86: "クレデンダム",
  96: "キングダムブラス"
};

const preferredItemFragments = {
  "SAM:56:MainHand": ["新都刀"]
};

const rowCache = new Map();

function dbItemUrl(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  return `${BASE}/lodestone/playguide/db/item/?${search.toString()}`;
}

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Fetch failed after retries: ${url}\n${lastError?.message || lastError}`);
}

function parseRows(html) {
  const tableIndex = html.indexOf('<table id="character"');
  if (tableIndex < 0) return [];
  const table = html.slice(tableIndex, html.indexOf("</table>", tableIndex) + 8);
  return [...table.matchAll(/<tr>[\s\S]*?<\/tr>/g)]
    .map((match) => {
      const row = match[0];
      const name = row.match(/db-table__txt--detail_link">([^<]+)/)?.[1];
      const href = row.match(/href="(\/lodestone\/playguide\/db\/item\/[^"]+)/)?.[1];
      const icon = row.match(/<img src="([^"]+)"[^>]*db-list__item__icon__item_image/)?.[1];
      const cells = [...row.matchAll(/db-table__body--(?:dark|light) db-table__body--center">([^<]*)/g)].map((cell) => cell[1]);
      if (!name || !href || !icon) return null;
      return {
        name,
        icon,
        href: `${BASE}${href}`,
        itemLevel: Number(cells[0]) || 0,
        equipLevel: Number(cells[1]) || 0
      };
    })
    .filter(Boolean);
}

async function fetchItems(params) {
  const cacheKey = JSON.stringify(params);
  if (rowCache.has(cacheKey)) return rowCache.get(cacheKey);
  const all = [];
  for (let page = 1; page <= 2; page += 1) {
    const html = await fetchHtml(dbItemUrl({ ...params, page }));
    const rows = parseRows(html);
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < 50) break;
  }
  const unique = all.filter((item, index, array) => array.findIndex((other) => other.href === item.href) === index);
  rowCache.set(cacheKey, unique);
  process.stdout.write(".");
  return unique;
}

function classJobForBand(job, band) {
  if (job.classId && band.max < 30) return job.classId;
  return job.classjob;
}

async function fetchItemsForJob(job, band, params) {
  const classjob = classJobForBand(job, band);
  if (!classjob) return fetchItems(params);

  const filtered = await fetchItems({ ...params, classjob });
  if (filtered.length) return filtered;

  return fetchItems(params);
}

function broadRoleKeywords(job, slot) {
  if (slot.weapon || slot.slot === "OffHand") return [];
  if (["Ears", "Neck", "Wrists", "FingerL"].includes(slot.slot)) {
    if (job.role === "tank") return ["ディフェンダー", "ガーディアン"];
    if (job.role === "healer") return ["ヒーラー", "プロフェッサー"];
    if (job.role === "ranged") return ["レンジャー", "ハンター"];
    if (job.role === "caster") return ["キャスター", "フィロソファー"];
    if (job.id === "DRG" || job.id === "RPR") return ["アタッカー", "スレイヤー", "パンクラティアスト"];
    return ["アタッカー", "ストライカー", "スカウト", "パンクラティアスト", "エージェント"];
  }
  if (job.role === "tank") return ["ディフェンダー", "ガーディアン", "ヘヴィ", "プレート"];
  if (job.role === "healer") return ["ヒーラー", "プロフェッサー", "ローブ"];
  if (job.role === "ranged") return ["レンジャー", "ハンター", "アーチャー"];
  if (job.role === "caster") return ["キャスター", "フィロソファー", "ローブ"];
  if (job.id === "DRG" || job.id === "RPR") return ["スレイヤー", "パスファインダー", "メイル"];
  if (job.id === "NIN" || job.id === "VPR") return ["スカウト", "エージェント"];
  return ["ストライカー", "パンクラティアスト"];
}

function bannedGeneric(item) {
  return /クラフター|ギャザラー|製作|採集|ギャザ|園芸|採掘|漁師|木工|鍛冶|甲冑|彫金|革細工|裁縫|錬金|調理/.test(item.name);
}

function itemScore(item, band, keywords, slot, job) {
  let score = item.itemLevel * 100 + item.equipLevel;
  const recommended = recommendedSeriesByBand[band.key];
  const preferred = [
    ...(preferredItemFragments[`${job.id}:${band.key}:${slot.slot}`] || []),
    ...(band.key === "86" && slot.weapon ? ["ルナエンヴォイ"] : []),
    ...(band.key === "96" ? ["キングダムブラス"] : [])
  ];
  if (preferred.some((fragment) => item.name.includes(fragment))) score += 30000;
  if (recommended && item.name.includes(recommended)) score += 30000;
  if (item.name.endsWith("RE")) score += 50;
  if (item.name.includes("【改】")) score += 50;
  if (item.name.includes("オメガ") || item.name.includes("アレキサンダー") || item.name.includes("エデンモーン")) score -= 2500;
  if (band.key === "96" && item.name.includes("グランドチャンピオン")) score -= 5000;
  if (item.name.includes("コヴン") || item.name.includes("ゴブコン") || item.name.includes("ゼータ")) score -= recommended ? 5000 : 0;
  if (item.equipLevel === band.max) score += 10;
  if (keywords.some((keyword) => item.name.includes(keyword))) score += 5000;
  if (!keywords.length || slot.weapon || slot.slot === "OffHand") score += 1000;
  if (bannedGeneric(item)) score -= 10000;
  return score;
}

function lv100AlternativeLabel(item) {
  if (item.name.includes("グランドチャンピオン")) return "高難度最強";
  if (item.name.includes("キングダムブラス") && item.name.endsWith("RE")) return "現実的最終";
  if (item.name.includes("キングダムブラス")) return "週制限トークン";
  if (item.name.includes("コートリーラヴァー") && item.name.endsWith("RE")) return "製作RE";
  if (item.name.includes("キングダムテール") && item.name.endsWith("RE")) return "旧トークンRE";
  if (item.name.includes("オールドキングダム") && item.name.endsWith("RE")) return "製作RE";
  return "";
}

function alternativesForItem(pool, found, band) {
  if (band.key !== "96") return [];
  const labels = ["現実的最終", "高難度最強", "週制限トークン", "製作RE", "旧トークンRE"];
  const alternatives = [];
  for (const label of labels) {
    const candidate = pool
      .filter((item) => item.href !== found.href && lv100AlternativeLabel(item) === label)
      .sort((a, b) => b.itemLevel - a.itemLevel || b.equipLevel - a.equipLevel)[0];
    if (candidate) {
      alternatives.push({
        label,
        name: candidate.name,
        icon: candidate.icon,
        href: candidate.href,
        itemLevel: candidate.itemLevel,
        equipLevel: candidate.equipLevel
      });
    }
  }
  return alternatives.slice(0, 4);
}

async function candidatesForSlot(job, band, slot) {
  if (slot.weapon) {
    const rows = [];
    for (const category3 of job.weaponCategories) {
      rows.push(...await fetchItemsForJob(job, band, {
        category2: slot.category2,
        category3,
        min_gear_lv: band.min,
        max_gear_lv: band.max
      }));
    }
    return rows;
  }
  return fetchItemsForJob(job, band, {
    category2: slot.category2,
    category3: slot.category3,
    min_gear_lv: band.min,
    max_gear_lv: band.max
  });
}

async function findItem(job, band, slot) {
  const rows = (await candidatesForSlot(job, band, slot))
    .filter((item) => item.equipLevel >= band.min && item.equipLevel <= band.max)
    .filter((item) => item.itemLevel > 0);
  const keywords = broadRoleKeywords(job, slot);
  const roleMatches = rows.filter((item) => keywords.length === 0 || keywords.some((keyword) => item.name.includes(keyword)));
  const pool = roleMatches.length ? roleMatches : rows.filter((item) => !bannedGeneric(item));
  const sortedPool = [...pool].sort((a, b) => itemScore(b, band, keywords, slot, job) - itemScore(a, band, keywords, slot, job));
  const found = sortedPool[0];
  if (!found) return null;
  const alternatives = alternativesForItem(pool, found, band);
  return alternatives.length ? { slot: slot.slot, ...found, alternatives } : { slot: slot.slot, ...found };
}

async function main() {
  const catalog = {};
  const missing = [];
  for (const job of jobs) {
    catalog[job.id] = {};
    console.log(`Building ${job.id}`);
    for (const band of bands.filter((item) => item.max >= job.min)) {
      const slots = slotCategories.filter((item) => !item.jobs || item.jobs.includes(job.id));
      const foundItems = await mapLimit(slots, 5, async (slot) => {
        const item = await findItem(job, band, slot);
        if (!item) {
          missing.push(`${job.id} ${band.label} ${slot.slot}`);
        }
        return item;
      });
      const items = foundItems.filter(Boolean);
      catalog[job.id][band.key] = { ...band, items };
    }
    rowCache.clear();
  }
  await fs.writeFile("gear-catalog.json", `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`\nWrote gear-catalog.json for ${Object.keys(catalog).length} jobs and ${bands.length} bands.`);
  if (missing.length) {
    console.error(`Missing ${missing.length} slots`);
    console.error(missing.slice(0, 80).join("\n"));
  }
}

await main();
