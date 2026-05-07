import fs from "node:fs/promises";
import { fetchItemDetail, mapLimit } from "./gear-detail-utils.mjs";

const filePath = "gear-catalog.json";
const catalog = JSON.parse(await fs.readFile(filePath, "utf8"));
const uniqueItems = new Map();

for (const job of Object.values(catalog)) {
  for (const band of Object.values(job)) {
    for (const item of band.items || []) {
      if (item.href && !uniqueItems.has(item.href)) {
        uniqueItems.set(item.href, item);
      }
    }
  }
}

console.log(`Enriching ${uniqueItems.size} unique gear items`);
const details = new Map();
await mapLimit([...uniqueItems.keys()], 8, async (href) => {
  details.set(href, await fetchItemDetail(href));
});

for (const job of Object.values(catalog)) {
  for (const band of Object.values(job)) {
    for (const item of band.items || []) {
      const detail = details.get(item.href);
      if (detail) {
        item.details = detail;
      }
    }
  }
}

await fs.writeFile(filePath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`\nWrote ${filePath}`);
