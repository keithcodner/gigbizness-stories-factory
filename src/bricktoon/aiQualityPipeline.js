const fs = require("fs");
const path = require("path");

function manifestPath(workspaceDir) {
  return path.join(workspaceDir, "workspace_manifest.json");
}

function loadManifest(workspaceDir) {
  const filePath = manifestPath(workspaceDir);
  if (!fs.existsSync(filePath)) {
    return {
      workspace: path.basename(workspaceDir),
      assets: []
    };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveManifest(workspaceDir, manifest) {
  fs.writeFileSync(manifestPath(workspaceDir), JSON.stringify(manifest, null, 2));
}

function relativeWorkspacePath(workspaceDir, filePath) {
  return path.relative(workspaceDir, filePath).replaceAll("\\", "/");
}

function assetTimestamp() {
  return new Date().toISOString();
}

function upsertAsset(manifest, asset) {
  manifest.assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const index = manifest.assets.findIndex((item) => item.asset_id === asset.asset_id);
  if (index >= 0) {
    manifest.assets[index] = asset;
    return;
  }
  manifest.assets.push(asset);
}

module.exports = {
  assetTimestamp,
  loadManifest,
  relativeWorkspacePath,
  saveManifest,
  upsertAsset
};
