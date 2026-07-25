const { LAB_ROOT, apiJson, parseArgs, writeJson } = require("./lib");
const path = require("path");

async function checkComfyUi(options = {}) {
  const baseUrl = options.baseUrl || process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
  const stats = await apiJson(baseUrl, "/system_stats");
  const report = {
    checked_at: new Date().toISOString(),
    base_url: baseUrl,
    comfyui_version: stats.system?.comfyui_version || null,
    pytorch_version: stats.devices?.[0]?.torch_version || null,
    device_name: stats.devices?.[0]?.name || null,
    raw: stats
  };
  const reportPath = path.join(LAB_ROOT, "reports", "runtime", "comfyui_health.json");
  writeJson(reportPath, report);
  console.log(`ComfyUI reachable at ${baseUrl}.`);
  console.log(`Health report written to ${reportPath}`);
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await checkComfyUi(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  checkComfyUi
};
