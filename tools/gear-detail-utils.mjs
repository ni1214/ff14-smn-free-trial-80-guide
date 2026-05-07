const USER_AGENT = "Mozilla/5.0";

const detailCache = new Map();

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function textFromHtml(html) {
  return decodeHtml(String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
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

function parseSpecs(html) {
  const labels = [...html.matchAll(/db-view__item_spec__name[^"]*">([^<]+)/g)].map((match) => textFromHtml(match[1]));
  const values = [...html.matchAll(/db-view__item_spec__value[^"]*"><strong>([^<]+)/g)].map((match) => textFromHtml(match[1]));
  return labels
    .map((label, index) => ({ label, value: values[index] || "" }))
    .filter((item) => item.label && item.value);
}

function parseBonuses(html) {
  const block = html.match(/<ul class="db-view__basic_bonus">([\s\S]*?)<\/ul>/)?.[1] || "";
  return [...block.matchAll(/<li><span>([^<]+)<\/span>\s*([^<]+)<\/li>/g)]
    .map((match) => ({ label: textFromHtml(match[1]), value: textFromHtml(match[2]) }))
    .filter((item) => item.label && item.value);
}

function parseRequirementCell(cell) {
  const names = [...cell.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/g)].map((match) => textFromHtml(match[1]));
  const amounts = [...cell.matchAll(/db-view__data__number">([^<]*)/g)].map((match) => textFromHtml(match[1]));
  return names.map((name, index) => ({
    name,
    amount: amounts[index] || ""
  })).filter((item) => item.name);
}

function parseSourceRows(html) {
  const tableStart = html.indexOf("db-table__item_source");
  if (tableStart < 0) return [];
  const tableEnd = html.indexOf("</table>", tableStart);
  const table = html.slice(tableStart, tableEnd > tableStart ? tableEnd : tableStart + 20000);
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  return rows.map((row) => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    if (cells.length < 2) return null;
    const requirements = parseRequirementCell(cells[0]);
    const npc = textFromHtml(cells[1].match(/db-shop__item__npc[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] || "");
    const locationMatch = cells[1].match(/db-shop__item__xy[\s\S]*?<span>([\s\S]*?)<\/span>\s*X:\s*([\d.]+)\s*Y:\s*([\d.]+)/);
    const location = locationMatch
      ? `${textFromHtml(locationMatch[1])} X:${locationMatch[2]} Y:${locationMatch[3]}`
      : textFromHtml(cells[1].match(/db-shop__item__xy[\s\S]*?<\/p>/)?.[0] || "");
    const poetics = requirements.find((item) => item.name.includes("アラガントームストーン:詩学"));
    return {
      requirements,
      npc,
      location,
      poetics: poetics?.amount || "",
      directPoetics: Boolean(poetics && requirements.length === 1)
    };
  }).filter((item) => item && (item.npc || item.requirements.length));
}

function sourceScore(source) {
  if (source.directPoetics) return 0;
  if (source.poetics) return 1;
  if (source.npc) return 2;
  return 3;
}

function summarizeSource(source) {
  if (!source) return "";
  const place = [source.npc, source.location].filter(Boolean).join(" / ");
  if (source.directPoetics) {
    return `詩学${source.poetics}: ${place}`;
  }
  if (source.poetics) {
    return `詩学${source.poetics}+交換元: ${place}`;
  }
  const requirements = source.requirements
    .map((item) => `${item.name}${item.amount ? ` ${item.amount}` : ""}`)
    .join(" + ");
  return [requirements, place].filter(Boolean).join(": ");
}

export function parseItemDetail(html) {
  const sources = parseSourceRows(html)
    .sort((a, b) => sourceScore(a) - sourceScore(b))
    .slice(0, 3);
  return {
    specs: parseSpecs(html).slice(0, 4),
    bonuses: parseBonuses(html).slice(0, 8),
    sources: sources.map((source) => ({
      requirements: source.requirements.slice(0, 3),
      npc: source.npc,
      location: source.location,
      poetics: source.poetics,
      directPoetics: source.directPoetics,
      summary: summarizeSource(source)
    })).filter((source) => source.summary)
  };
}

export async function fetchItemDetail(href) {
  if (!href) return {};
  if (detailCache.has(href)) return detailCache.get(href);
  const html = await fetchHtml(href);
  const detail = parseItemDetail(html);
  detailCache.set(href, detail);
  process.stdout.write("+");
  return detail;
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
