const fs = require("fs");
const path = require("path");
const { parseCliArgs } = require("./story_cli_lib");
const { configDir } = require("../src/paths");

function runConfigValidate() {
  const requiredFiles = [
    "story_voice_profiles.json",
    "wan_i2v_patch_rules.json",
    "rendering_learnings.json"
  ];
  const missing = requiredFiles.filter((fileName) => !fs.existsSync(path.join(configDir, fileName)));
  if (missing.length > 0) {
    throw new Error(`Missing config files:\n${missing.join("\n")}`);
  }
  const learningRegistry = JSON.parse(
    fs.readFileSync(path.join(configDir, "rendering_learnings.json"), "utf8")
  );
  const learningIds = new Set();
  for (const learning of learningRegistry.learnings || []) {
    if (!learning.id || !learning.status || !learning.directive || !Array.isArray(learning.applies_to)) {
      throw new Error("Each rendering learning requires id, status, directive, and applies_to fields.");
    }
    if (learningIds.has(learning.id)) {
      throw new Error(`Duplicate rendering learning id: ${learning.id}`);
    }
    learningIds.add(learning.id);
  }
  const requiredEnv = [
    "BRICKTOON_IMAGE_PROVIDER",
    "COMFYUI_BASE_URL"
  ];
  const unset = requiredEnv.filter((key) => !process.env[key]);
  if (unset.length > 0) {
    console.log(`Config files exist. Optional env values currently unset: ${unset.join(", ")}`);
    return;
  }
  console.log("Config validation passed.");
}

if (require.main === module) {
  try {
    runConfigValidate(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runConfigValidate
};
