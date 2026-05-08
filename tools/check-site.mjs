import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error("No inline script found in index.html.");
}

new Function(scriptMatch[1]);

for (const file of [
  "action-icons.json",
  "item-icons.json",
  "gear-catalog.json",
  "gear-catalog-meta.json",
  "job-actions.json",
  "site.webmanifest"
]) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}

console.log("syntax ok");
