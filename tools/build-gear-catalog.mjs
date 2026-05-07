import fs from "node:fs/promises";

const BASE = "https://jp.finalfantasyxiv.com";
const USER_AGENT = "Mozilla/5.0";

const jobs = [
  { id: "PLD", label: "ナイト", min: 1, role: "tank", weaponCategories: [2], offhand: true },
  { id: "WAR", label: "戦士", min: 1, role: "tank", weaponCategories: [3] },
  { id: "DRK", label: "暗黒騎士", min: 30, role: "tank", weaponCategories: [87] },
  { id: "GNB", label: "ガンブレイカー", min: 60, role: "tank", weaponCategories: [106] },
  { id: "WHM", label: "白魔道士", min: 1, role: "healer", weaponCategories: [9, 8] },
  { id: "SCH", label: "学者", min: 30, role: "healer", weaponCategories: [98] },
  { id: "AST", label: "占星術師", min: 30, role: "healer", weaponCategories: [89] },
  { id: "MNK", label: "モンク", min: 1, role: "melee", weaponCategories: [1] },
  { id: "DRG", label: "竜騎士", min: 1, role: "melee", weaponCategories: [5] },
  { id: "NIN", label: "忍者", min: 1, role: "melee", weaponCategories: [84] },
  { id: "SAM", label: "侍", min: 50, role: "melee", weaponCategories: [96] },
  { id: "BRD", label: "吟遊詩人", min: 1, role: "ranged", weaponCategories: [4] },
  { id: "MCH", label: "機工士", min: 30, role: "ranged", weaponCategories: [88] },
  { id: "DNC", label: "踊り子", min: 60, role: "ranged", weaponCategories: [107] },
  { id: "BLM", label: "黒魔道士", min: 1, role: "caster", weaponCategories: [7, 6] },
  { id: "SMN", label: "召喚士", min: 1, role: "caster", weaponCategories: [10] },
  { id: "RDM", label: "赤魔道士", min: 50, role: "caster", weaponCategories: [97] }
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

const bands = Array.from({ length: 16 }, (_, index) => {
  const min = index * 5 + 1;
  const max = Math.min(80, min + 4);
  return { key: String(min), min, max, label: `Lv${min}-${max}` };
});

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
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 900));
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
  for (let page = 1; page <= 5; page += 1) {
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

function broadRoleKeywords(job, slot) {
  if (slot.weapon || slot.slot === "OffHand") return [];
  if (["Ears", "Neck", "Wrists", "FingerL"].includes(slot.slot)) {
    if (job.role === "tank") return ["ディフェンダー", "ガーディアン"];
    if (job.role === "healer") return ["ヒーラー", "プロフェッサー"];
    if (job.role === "ranged") return ["レンジャー", "ハンター"];
    if (job.role === "caster") return ["キャスター", "フィロソファー"];
    if (job.id === "DRG") return ["アタッカー", "スレイヤー", "パンクラティアスト"];
    return ["アタッカー", "ストライカー", "スカウト", "パンクラティアスト", "エージェント"];
  }
  if (job.role === "tank") return ["ディフェンダー", "ガーディアン", "ヘヴィ", "プレート"];
  if (job.role === "healer") return ["ヒーラー", "プロフェッサー", "ローブ"];
  if (job.role === "ranged") return ["レンジャー", "ハンター", "アーチャー"];
  if (job.role === "caster") return ["キャスター", "フィロソファー", "ローブ"];
  if (job.id === "DRG") return ["スレイヤー", "パスファインダー", "メイル"];
  if (job.id === "NIN") return ["スカウト", "エージェント"];
  return ["ストライカー", "パンクラティアスト"];
}

function bannedGeneric(item) {
  return /クラフター|ギャザラー|製作|採集|ギャザ|園芸|採掘|漁師|木工|鍛冶|甲冑|彫金|革細工|裁縫|錬金|調理/.test(item.name);
}

function itemScore(item, band, keywords, slot) {
  let score = item.itemLevel * 100 + item.equipLevel;
  if (item.name.endsWith("RE")) score += 50;
  if (item.name.includes("【改】")) score += 50;
  if (item.name.includes("オメガ") || item.name.includes("アレキサンダー") || item.name.includes("エデンモーン")) score -= 20;
  if (item.equipLevel === band.max) score += 10;
  if (keywords.some((keyword) => item.name.includes(keyword))) score += 5000;
  if (!keywords.length || slot.weapon || slot.slot === "OffHand") score += 1000;
  if (bannedGeneric(item)) score -= 10000;
  return score;
}

async function candidatesForSlot(job, band, slot) {
  if (slot.weapon) {
    const rows = [];
    for (const category3 of job.weaponCategories) {
      rows.push(...await fetchItems({
        category2: slot.category2,
        category3,
        min_gear_lv: band.min,
        max_gear_lv: band.max
      }));
    }
    return rows;
  }
  return fetchItems({
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
  const found = pool.sort((a, b) => itemScore(b, band, keywords, slot) - itemScore(a, band, keywords, slot))[0];
  if (!found) return null;
  return { slot: slot.slot, ...found };
}

async function main() {
  const catalog = {};
  const missing = [];
  for (const job of jobs) {
    catalog[job.id] = {};
    for (const band of bands.filter((item) => item.max >= job.min)) {
      const items = [];
      for (const slot of slotCategories.filter((item) => !item.jobs || item.jobs.includes(job.id))) {
        const item = await findItem(job, band, slot);
        if (item) {
          items.push(item);
        } else {
          missing.push(`${job.id} ${band.label} ${slot.slot}`);
        }
      }
      catalog[job.id][band.key] = { ...band, items };
    }
  }
  await fs.writeFile("gear-catalog.json", `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`\nWrote gear-catalog.json for ${Object.keys(catalog).length} jobs and ${bands.length} bands.`);
  if (missing.length) {
    console.error(`Missing ${missing.length} slots`);
    console.error(missing.slice(0, 80).join("\n"));
  }
}

await main();
