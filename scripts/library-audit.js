const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { libraryDir, reportsDir } = require("../src/paths");
const { ensureDir, parseCliArgs, readJson, writeJson } = require("./story_cli_lib");

function fileHash(filePath) {
  const hash = crypto.createHash("sha1");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function runLibraryAudit() {
  const catalogsDir = path.join(libraryDir, "catalogs");
  const seenHashes = new Map();
  const duplicates = [];
  const missingMetadata = [];
  for (const fileName of fs.readdirSync(catalogsDir)) {
    const fullPath = path.join(catalogsDir, fileName);
    const catalog = readJson(fullPath);
    for (const asset of catalog.assets || []) {
      const absolute = path.join(libraryDir, "..", asset.source_path);
      if (!fs.existsSync(absolute)) {
        missingMetadata.push({
          id: asset.id,
          issue: "missing_source_file",
          source_path: asset.source_path
        });
        continue;
      }
      const hash = fileHash(absolute);
      if (seenHashes.has(hash)) {
        duplicates.push({
          source_path: asset.source_path,
          duplicate_of: seenHashes.get(hash)
        });
      } else {
        seenHashes.set(hash, asset.source_path);
      }
      if (!asset.approval_status || !asset.style_family) {
        missingMetadata.push({
          id: asset.id,
          issue: "missing_required_metadata",
          source_path: asset.source_path
        });
      }
    }
  }
  ensureDir(path.join(reportsDir, "runtime"));
  const reportPath = path.join(reportsDir, "runtime", "library_audit.json");
  writeJson(reportPath, {
    generated_at: new Date().toISOString(),
    duplicates,
    missing_metadata: missingMetadata
  });
  console.log(`Library audit written to ${reportPath}`);
}

if (require.main === module) {
  try {
    runLibraryAudit(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runLibraryAudit
};
