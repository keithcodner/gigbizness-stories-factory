const fs = require("fs");
const path = require("path");
const { parseArgs } = require("./lib");
const { resolveFromRoot, workspacesDir } = require("../src/paths");

const STAGE_DEFS = [
  ["01_story_package", "story_package"],
  ["02_voice", "voice_preview"],
  ["03_characters", "character_refs"],
  ["04_visuals", "visual_package"],
  ["05_preview", "preview"],
  ["06_motion", "motion"],
  ["07_scene_outputs", "scene_outputs"],
  ["08_review", "review"],
  ["09_final", "final"]
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
  return String(value || "story")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "story";
}

function topicToStoryId(topicOrStory) {
  return slugify(topicOrStory || "the_great_brick_heist");
}

function parseCliArgs() {
  return parseArgs(process.argv.slice(2));
}

function resolveTopicName(args = {}) {
  return args.topic || args.story || args._?.[0] || "the_great_brick_heist";
}

function resolveStoryId(args = {}) {
  return topicToStoryId(resolveTopicName(args));
}

function workspaceRoot(storyId) {
  return path.join(workspacesDir, storyId);
}

function storyPackageRoot(storyId) {
  return resolveFromRoot("output", "story_packages", storyId);
}

function stageDir(storyId, stageName) {
  return path.join(workspaceRoot(storyId), stageName);
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function copyRecursive(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }
  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    ensureDir(destinationPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(destinationPath, entry));
    }
    return true;
  }
  ensureDir(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
  return true;
}

function ensureWorkspace(storyId) {
  ensureDir(workspaceRoot(storyId));
  for (const [folder] of STAGE_DEFS) {
    ensureDir(stageDir(storyId, folder));
  }
}

function statusFilePath(storyId) {
  return path.join(workspaceRoot(storyId), "workspace_status.json");
}

function readWorkspaceStatus(storyId) {
  const filePath = statusFilePath(storyId);
  if (!fs.existsSync(filePath)) {
    return {
      story_id: storyId,
      updated_at: null,
      stages: {}
    };
  }
  return readJson(filePath);
}

function updateStageStatus(storyId, stageKey, status, details = {}) {
  const current = readWorkspaceStatus(storyId);
  current.story_id = storyId;
  current.updated_at = new Date().toISOString();
  current.stages[stageKey] = {
    status,
    updated_at: current.updated_at,
    ...details
  };
  writeJson(statusFilePath(storyId), current);
  return current;
}

function stageSummaryMarkdown(status) {
  const lines = [
    `# Workspace Status`,
    "",
    `- Story ID: ${status.story_id}`,
    `- Updated: ${status.updated_at || "n/a"}`,
    "",
    "## Stages",
    ""
  ];
  for (const [folder, key] of STAGE_DEFS) {
    const stage = status.stages[key] || { status: "pending" };
    lines.push(`- ${folder}: ${stage.status}`);
  }
  return `${lines.join("\n")}\n`;
}

function writeWorkspaceStatusArtifacts(storyId) {
  const status = readWorkspaceStatus(storyId);
  writeText(path.join(workspaceRoot(storyId), "workspace_status.md"), stageSummaryMarkdown(status));
  return status;
}

module.exports = {
  STAGE_DEFS,
  copyRecursive,
  ensureDir,
  ensureWorkspace,
  parseCliArgs,
  readJson,
  readWorkspaceStatus,
  resolveStoryId,
  resolveTopicName,
  stageDir,
  statusFilePath,
  storyPackageRoot,
  topicToStoryId,
  updateStageStatus,
  workspaceRoot,
  writeJson,
  writeText,
  writeWorkspaceStatusArtifacts
};
