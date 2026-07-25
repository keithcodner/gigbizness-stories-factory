const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { loadEnv } = require("../src/loadEnv");

const REPO_ROOT = path.resolve(__dirname, "..");
const LAB_ROOT = REPO_ROOT;

loadEnv(REPO_ROOT);

function parsePrimitive(value) {
  if (value == null) {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(parsePrimitive(token));
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = parsePrimitive(next);
    index += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

async function apiJson(baseUrl, endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ComfyUI request failed (${response.status}) at ${endpoint}: ${text}`);
  }
  return response.json();
}

async function uploadInputImage(baseUrl, filePath) {
  const form = new FormData();
  form.append("image", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  form.append("type", "input");
  form.append("overwrite", "true");

  const response = await fetch(`${baseUrl}/upload/image`, {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload ComfyUI input image (${response.status}): ${text}`);
  }
  const json = await response.json();
  return json.name || path.basename(filePath);
}

async function queuePrompt(baseUrl, workflow) {
  const clientId = crypto.randomUUID();
  const json = await apiJson(baseUrl, "/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      prompt: workflow
    })
  });
  return {
    promptId: json.prompt_id,
    clientId
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectAssets(value, results = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAssets(item, results);
    }
    return results;
  }
  if (!value || typeof value !== "object") {
    return results;
  }
  if (typeof value.filename === "string") {
    results.push({
      filename: value.filename,
      subfolder: value.subfolder || "",
      type: value.type || "output"
    });
    return results;
  }
  for (const nested of Object.values(value)) {
    collectAssets(nested, results);
  }
  return results;
}

async function waitForOutputs(baseUrl, promptId, timeoutMs, pollIntervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const history = await apiJson(baseUrl, `/history/${promptId}`);
    const record = history[promptId];
    const assets = record?.outputs ? collectAssets(record.outputs, []) : [];
    if (assets.length > 0) {
      return {
        record,
        assets
      };
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for ComfyUI prompt ${promptId}.`);
}

async function downloadAsset(baseUrl, asset, destinationPath) {
  const params = new URLSearchParams({
    filename: asset.filename,
    subfolder: asset.subfolder || "",
    type: asset.type || "output"
  });
  const response = await fetch(`${baseUrl}/view?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to download ComfyUI asset (${response.status}): ${text}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(destinationPath));
  fs.writeFileSync(destinationPath, buffer);
}

function setNodeInput(workflow, nodeId, inputName, value) {
  const node = workflow[nodeId];
  if (!node) {
    throw new Error(`Workflow node '${nodeId}' was not found.`);
  }
  node.inputs = node.inputs || {};
  node.inputs[inputName] = value;
}

function resolveOverrideValue(override, args, uploadedImageName) {
  if (override.source === "uploaded_image") {
    return uploadedImageName;
  }
  if (override.source === "env") {
    return process.env[override.env_name] != null ? parsePrimitive(process.env[override.env_name]) : override.default;
  }
  if (override.source === "arg") {
    return args[override.arg_name] != null ? args[override.arg_name] : override.default;
  }
  return override.value != null ? override.value : override.default;
}

function patchWorkflow(workflow, patchRules, args, uploadedImageName) {
  if (!patchRules || patchRules.workflow_ready !== true) {
    throw new Error("Patch rules are not marked ready. Update config/wan_i2v_patch_rules.json with real node ids, then set workflow_ready to true.");
  }
  const patched = JSON.parse(JSON.stringify(workflow));
  const imageTarget = patchRules.uploaded_image_target || {};
  setNodeInput(patched, String(imageTarget.node_id), String(imageTarget.input_name), uploadedImageName);

  for (const override of patchRules.input_overrides || []) {
    const resolvedValue = resolveOverrideValue(override, args, uploadedImageName);
    setNodeInput(patched, String(override.node_id), String(override.input_name), resolvedValue);
  }
  return patched;
}

function uniqueAssetList(assets) {
  const seen = new Set();
  return assets.filter((asset) => {
    const key = `${asset.type}|${asset.subfolder}|${asset.filename}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

module.exports = {
  LAB_ROOT,
  REPO_ROOT,
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
  writeJson,
  writeText
};
