import fs from "node:fs/promises";

const catalog = JSON.parse(await fs.readFile("gear-catalog.json", "utf8"));
const jobs = Object.keys(catalog);
const uniqueItems = new Set();
let maxLevel = 0;
let bandCount = 0;

for (const job of Object.values(catalog)) {
  const bands = Object.values(job);
  bandCount = Math.max(bandCount, bands.length);
  for (const band of bands) {
    maxLevel = Math.max(maxLevel, Number(band.max) || 0);
    for (const item of band.items || []) {
      if (item.href) {
        uniqueItems.add(item.href);
      }
    }
  }
}

const meta = {
  generatedAt: new Date().toISOString(),
  source: "official-eorzea-database",
  maxLevel,
  jobs: jobs.length,
  bands: bandCount,
  uniqueItems: uniqueItems.size
};

await fs.writeFile("gear-catalog-meta.json", `${JSON.stringify(meta, null, 2)}\n`, "utf8");
console.log(`Wrote gear-catalog-meta.json (${meta.jobs} jobs, Lv${meta.maxLevel}, ${meta.uniqueItems} items)`);
