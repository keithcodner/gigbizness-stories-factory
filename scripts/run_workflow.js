const fs = require("fs");
const path = require("path");
const {
  LAB_ROOT,
  apiJson,
  downloadAsset,
  ensureDir,
  parseArgs,
  patchWorkflow,
  queuePrompt,
  readJson,
  uniqueAssetList,
  uploadInputImage,
  waitForOutputs,
  writeJson
} = require("./lib");

async function runWorkflow(options = {}) {
  const baseUrl = options.baseUrl || process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
  const workflowPath = path.resolve(options.workflow || path.join(LAB_ROOT, "templates", "wan_i2v_api.json"));
  const patchPath = path.resolve(options.patch || path.join(LAB_ROOT, "config", "wan_i2v_patch_rules.json"));
  const inputPath = path.resolve(options.input || path.join(LAB_ROOT, "input", "test_story_template_source.png"));
  const timeoutMs = Number(options.timeoutMs || process.env.COMFYUI_VIDEO_TIMEOUT_MS || 900000);
  const pollIntervalMs = Number(options.pollIntervalMs || process.env.COMFYUI_VIDEO_POLL_INTERVAL_MS || 5000);
  const runLabel = String(options.label || `wan_i2v_${Date.now()}`);

  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow file not found: ${workflowPath}`);
  }
  if (!fs.existsSync(patchPath)) {
    throw new Error(`Patch rules file not found: ${patchPath}`);
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input image not found: ${inputPath}`);
  }

  await apiJson(baseUrl, "/system_stats");

  const workflow = readJson(workflowPath);
  const patchRules = readJson(patchPath);
  const uploadedImageName = await uploadInputImage(baseUrl, inputPath);
  const patchedWorkflow = patchWorkflow(workflow, patchRules, options, uploadedImageName);

  const runId = `${runLabel}_${Date.now()}`;
  const outputDir = path.join(LAB_ROOT, "output", runId);
  ensureDir(outputDir);

  const requestPath = path.join(outputDir, "patched_workflow.json");
  fs.writeFileSync(requestPath, JSON.stringify(patchedWorkflow, null, 2));

  const { promptId } = await queuePrompt(baseUrl, patchedWorkflow);
  const { record, assets } = await waitForOutputs(baseUrl, promptId, timeoutMs, pollIntervalMs);
  const uniqueAssets = uniqueAssetList(assets);
  const downloaded = [];

  for (const asset of uniqueAssets) {
    const destinationPath = path.join(outputDir, path.basename(asset.filename));
    await downloadAsset(baseUrl, asset, destinationPath);
    downloaded.push({
      ...asset,
      local_path: destinationPath
    });
  }

  const report = {
    run_id: runId,
    completed_at: new Date().toISOString(),
    base_url: baseUrl,
    workflow_path: workflowPath,
    patch_rules_path: patchPath,
    input_path: inputPath,
    uploaded_image_name: uploadedImageName,
    prompt_id: promptId,
    output_dir: outputDir,
    downloaded_assets: downloaded,
    record_summary: {
      status: record?.status || null
    }
  };

  const reportPath = path.join(LAB_ROOT, "reports", "runtime", `${runId}_report.json`);
  writeJson(reportPath, report);

  console.log(`ComfyUI video workflow completed. Output dir: ${outputDir}`);
  console.log(`Runtime report written to ${reportPath}`);
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runWorkflow(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runWorkflow
};
