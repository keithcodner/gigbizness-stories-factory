const fs = require("fs");
const path = require("path");
const {
  LAB_ROOT,
  REPO_ROOT,
  ensureDir,
  parseArgs,
  readJson,
  writeJson
} = require("./lib");
const {
  assetTimestamp,
  loadManifest,
  relativeWorkspacePath,
  saveManifest,
  upsertAsset
} = require("../../../src/bricktoon/aiQualityPipeline");

function latestRuntimeReport() {
  const reportsDir = path.join(LAB_ROOT, "reports", "runtime");
  if (!fs.existsSync(reportsDir)) {
    return null;
  }
  const reports = fs.readdirSync(reportsDir)
    .filter((name) => name.endsWith("_report.json"))
    .map((name) => path.join(reportsDir, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return reports[0] || null;
}

function resolveReportPath(options = {}) {
  if (options.report) {
    return path.resolve(options.report);
  }
  return latestRuntimeReport();
}

function normalizeShotId(options = {}) {
  return String(options.shot || options.shotId || "LAB_SHOT_001");
}

function findSourceAsset(options = {}) {
  if (options.assetFile) {
    const filePath = path.resolve(options.assetFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Asset file not found: ${filePath}`);
    }
    return {
      source_type: "direct_asset_file",
      file_path: filePath,
      report: null
    };
  }

  const reportPath = resolveReportPath(options);
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error("No lab runtime report was found. Run the workflow first or pass --asset-file.");
  }

  const report = readJson(reportPath);
  const candidates = Array.isArray(report.downloaded_assets)
    ? report.downloaded_assets.filter((asset) => /\.(mp4|mov|webm|gif)$/i.test(asset.local_path || asset.filename || ""))
    : [];

  if (candidates.length === 0) {
    throw new Error(`No video-like assets were found in report: ${reportPath}`);
  }

  const selected = candidates[0];
  return {
    source_type: "lab_runtime_report",
    file_path: path.resolve(selected.local_path),
    report,
    report_path: reportPath
  };
}

function importToWorkspace(options = {}) {
  const topic = options.topic || options._?.[0] || "test_story_template";
  const shotId = normalizeShotId(options);
  const workspaceDir = path.join(REPO_ROOT, "workspaces", topic);
  if (!fs.existsSync(workspaceDir)) {
    throw new Error(`Workspace not found: ${workspaceDir}`);
  }

  const source = findSourceAsset(options);
  const targetDir = path.join(workspaceDir, "08_animation", "comfyui_video_lab");
  ensureDir(targetDir);
  const extension = path.extname(source.file_path) || ".mp4";
  const targetFileName = `${shotId}_comfyui_lab${extension}`;
  const targetPath = path.join(targetDir, targetFileName);
  fs.copyFileSync(source.file_path, targetPath);

  const manifest = loadManifest(workspaceDir);
  const assetId = `COMFYLAB_${shotId}`;
  const relativeFile = relativeWorkspacePath(workspaceDir, targetPath);

  upsertAsset(manifest, {
    asset_id: assetId,
    asset_type: "comfyui_video_lab_motion_candidate",
    shot_ids: [shotId],
    file: relativeFile,
    status: "approved_for_review",
    generator: {
      provider: "comfyui_video_lab",
      workflow: source.report?.workflow_path ? path.basename(source.report.workflow_path) : "manual_asset_import"
    },
    created_at: assetTimestamp(),
    metadata: {
      source_type: source.source_type,
      runtime_report: source.report_path ? path.relative(workspaceDir, source.report_path).replaceAll("\\", "/") : null
    }
  });
  saveManifest(workspaceDir, manifest);

  const importReport = {
    imported_at: new Date().toISOString(),
    topic,
    shot_id: shotId,
    source_type: source.source_type,
    source_file: source.file_path,
    runtime_report: source.report_path || null,
    imported_file: targetPath,
    imported_workspace_file: relativeFile,
    asset_id: assetId
  };
  const importReportPath = path.join(targetDir, "comfyui_video_lab_import_report.json");
  writeJson(importReportPath, importReport);

  console.log(`Imported ComfyUI lab asset into '${topic}' for shot '${shotId}'.`);
  console.log(`Imported file: ${targetPath}`);
  console.log(`Import report written to ${importReportPath}`);
  return importReport;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  importToWorkspace(args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  importToWorkspace
};
