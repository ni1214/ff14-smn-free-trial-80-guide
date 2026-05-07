import fs from "node:fs/promises";

const BASE = "https://jp.finalfantasyxiv.com";
const USER_AGENT = "Mozilla/5.0";

const jobs = [
  { id: "PLD", label: "ナイト", min: 1, role: "tank", weaponCategory: 2, offhand: true },
  { id: "WAR", label: "戦士", min: 1, role: "tank", weaponCategory: 3 },
  { id: "DRK", label: "暗黒騎士", min: 30, role: "tank", weaponCategory: 87 },
  { id: "GNB", label: "ガンブレイカー", min: 60, role: "tank", weaponCategory: 106 },
  { id: "WHM", label: "白魔道士", min: 1, role: "healer", weaponCategory: 9 },
  { id: "SCH", label: "学者", min: 30, role: "healer", weaponCategory: 98 },
  { id: "AST", label: "占星術師", min: 30, role: "healer", weaponCategory: 89 },
  { id: "MNK", label: "モンク", min: 1, role: "melee", weaponCategory: 1 },
  { id: "DRG", label: "竜騎士", min: 1, role: "melee", weaponCategory: 5 },
  { id: "NIN", label: "忍者", min: 1, role: "melee", weaponCategory: 84 },
  { id: "SAM", label: "侍", min: 50, role: "melee", weaponCategory: 96 },
  { id: "BRD", label: "吟遊詩人", min: 1, role: "ranged", weaponCategory: 4 },
  { id: "MCH", label: "機工士", min: 30, role: "ranged", weaponCategory: 88 },
  { id: "DNC", label: "踊り子", min: 60, role: "ranged", weaponCategory: 107 },
  { id: "BLM", label: "黒魔道士", min: 1, role: "caster", weaponCategory: 7 },
  { id: "SMN", label: "召喚士", min: 1, role: "caster", weaponCategory: 10 },
  { id: "RDM", label: "赤魔道士", min: 50, role: "caster", weaponCategory: 97 }
];

const tiers = [
  { min: 50, label: "ガーロンドRE", ilvl: 130, keyword: "ガーロンド" },
  { min: 60, label: "イディルRE", ilvl: 270, keyword: "イディル" },
  { min: 70, label: "スカエウァRE", ilvl: 400, keyword: "スカエウァ" },
  { min: 80, label: "クリプトラーカーRE", ilvl: 530, keyword: "クリプトラーカー" }
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

function roleKeyword(job, tier, slot = "") {
  if (["Ears", "Neck", "Wrists", "FingerL"].includes(slot)) {
    if (job.id === "DRG") return tier.min === 60 ? "パンクラティアスト" : "アタッカー";
    if (job.role === "melee") return tier.min === 60 && job.id !== "DRG" ? "パンクラティアスト" : "アタッカー";
  }
  if (tier.min === 60) {
    if (job.role === "tank") return "ガーディアン";
    if (job.role === "healer") return "プロフェッサー";
    if (job.role === "ranged") return "ハンター";
    if (job.role === "caster") return "フィロソファー";
    if (job.id === "DRG") return "パスファインダー";
    if (job.id === "NIN") return "エージェント";
    return "パンクラティアスト";
  }
  if (job.role === "tank") return "ディフェンダー";
  if (job.role === "healer") return "ヒーラー";
  if (job.role === "ranged") return "レンジャー";
  if (job.role === "caster") return "キャスター";
  if (job.id === "DRG") return tier.min === 60 ? "パスファインダー" : "スレイヤー";
  if (job.id === "NIN") return "スカウト";
  return "ストライカー";
}

function dbItemUrl(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  return `${BASE}/lodestone/playguide/db/item/?${search.toString()}`;
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
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
  const all = [];
  for (let page = 1; page <= 4; page += 1) {
    const html = await fetchHtml(dbItemUrl({ ...params, page }));
    const rows = parseRows(html);
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < 50) break;
  }
  return all.filter((item, index, array) => array.findIndex((other) => other.href === item.href) === index);
}

function scoreItem(item, tier, keyword, slot) {
  let score = 0;
  if (item.name.includes(tier.keyword)) score += 20;
  if (item.name.includes(keyword)) score += 10;
  if (item.name.endsWith("RE")) score += 5;
  if (item.name.includes("【改】")) score += 5;
  if (slot.weapon && item.name.includes("マジテック")) score += tier.min === 50 || tier.min === 70 ? 1 : 0;
  return score;
}

async function findItem(job, tier, slot) {
  const category3 = slot.weapon ? job.weaponCategory : slot.category3;
  const params = {
    category2: slot.category2,
    category3,
    min_gear_lv: tier.min,
    max_gear_lv: tier.min,
    min_item_lv: tier.ilvl,
    max_item_lv: tier.ilvl
  };
  const keyword = slot.weapon ? tier.keyword : roleKeyword(job, tier, slot.slot);
  const rows = await fetchItems(params);
  const matches = rows
    .filter((item) => item.itemLevel === tier.ilvl && item.equipLevel === tier.min)
    .filter((item) => (item.name.includes(tier.keyword) || (job.id === "SAM" && tier.min === 60 && item.name.includes("新都刀"))))
    .filter((item) => slot.slot === "OffHand" || (job.id === "SAM" && tier.min === 60 && slot.slot === "MainHand") || item.name.includes(keyword))
    .sort((a, b) => scoreItem(b, tier, keyword, slot) - scoreItem(a, tier, keyword, slot));
  const found = matches[0];
  if (!found) {
    throw new Error(`Missing ${job.id} Lv${tier.min} ${slot.slot} (${keyword})`);
  }
  return { slot: slot.slot, ...found };
}

async function main() {
  const catalog = {};
  const errors = [];
  for (const job of jobs) {
    catalog[job.id] = {};
    for (const tier of tiers.filter((item) => item.min >= job.min)) {
      const items = [];
      for (const slot of slotCategories.filter((item) => !item.jobs || item.jobs.includes(job.id))) {
        try {
          items.push(await findItem(job, tier, slot));
          process.stdout.write(".");
        } catch (error) {
          errors.push(error.message);
          process.stdout.write("x");
        }
      }
      catalog[job.id][String(tier.min)] = items;
    }
  }
  await fs.writeFile("gear-catalog.json", `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`\nWrote gear-catalog.json for ${Object.keys(catalog).length} jobs.`);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}

await main();
