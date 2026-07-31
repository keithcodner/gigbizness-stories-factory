const fs = require("fs");
const path = require("path");
const { REPO_ROOT, parseArgs, readJson, writeJson } = require("./lib");

const registryPath = path.join(REPO_ROOT, "config", "rendering_learnings.json");

function required(options, key, flag) {
  const value = options[key];
  if (!value || value === true) {
    throw new Error(`${flag} is required.`);
  }
  return String(value).trim();
}

function recordRenderLearning(options = {}) {
  const registry = readJson(registryPath);
  const id = required(options, "id", "--id")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if ((registry.learnings || []).some((item) => item.id === id)) {
    throw new Error(`Rendering learning already exists: ${id}`);
  }
  const now = new Date().toISOString();
  const learning = {
    id,
    status: String(options.status || registry.policy?.default_status || "candidate"),
    title: required(options, "title", "--title"),
    applies_to: required(options, "appliesTo", "--applies-to")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    directive: required(options, "directive", "--directive"),
    rationale: required(options, "rationale", "--rationale"),
    validation: required(options, "validation", "--validation"),
    recorded_at: now
  };
  registry.updated_at = now.slice(0, 10);
  registry.learnings = [...(registry.learnings || []), learning];
  writeJson(registryPath, registry);
  console.log(`Recorded ${learning.status} rendering learning: ${id}`);
  return learning;
}

if (require.main === module) {
  try {
    if (!fs.existsSync(registryPath)) {
      throw new Error(`Rendering learning registry not found: ${registryPath}`);
    }
    recordRenderLearning(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { recordRenderLearning };
