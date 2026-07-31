const fs = require("fs");
const path = require("path");
const { parseCliArgs, writeJson } = require("./story_cli_lib");
const { libraryDir } = require("../src/paths");

const CATALOG_TARGETS = [
  ["reference_images", "reference_catalog.json", "reference"],
  ["characters", "character_catalog.json", "character"],
  ["props", "prop_catalog.json", "prop"],
  ["environments", "environment_catalog.json", "environment"],
  ["general", "general_asset_catalog.json", "general"]
];

function collectFiles(dirPath, category, metadata = {}, results = []) {
  if (!fs.existsSync(dirPath)) {
    return results;
  }
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, category, metadata, results);
      continue;
    }
    if (entry.name.toLowerCase().endsWith(".json") || entry.name === ".gitkeep") {
      continue;
    }
    const repoRelative = path.relative(path.join(libraryDir, ".."), entryPath).replaceAll("\\", "/");
    const stem = path.basename(entry.name, path.extname(entry.name)).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const curated = metadata[entry.name] || {};
    results.push({
      id: `${category}_${stem}`,
      reference_id: curated.reference_id || `${category}_${stem}`.toUpperCase(),
      category,
      file: repoRelative,
      source_path: repoRelative,
      tags: curated.tags || [],
      style_family: "premium_bricktoon",
      continuity_suitability: curated.continuity_suitability || "unknown",
      role: curated.role || category,
      approval_status: curated.approval_status || "unreviewed",
      notes: curated.notes || ""
    });
  }
  return results;
}

function runLibraryCatalog() {
  for (const [folder, fileName, category] of CATALOG_TARGETS) {
    const targetDir = path.join(libraryDir, folder);
    const metadataPath = path.join(targetDir, "reference_metadata.json");
    const metadata = category === "reference" && fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, "utf8")).files || {}
      : {};
    const assets = collectFiles(targetDir, category, metadata);
    writeJson(path.join(libraryDir, "catalogs", fileName), { assets });
  }
  console.log("Library catalogs rebuilt.");
}

if (require.main === module) {
  try {
    runLibraryCatalog(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runLibraryCatalog
};
