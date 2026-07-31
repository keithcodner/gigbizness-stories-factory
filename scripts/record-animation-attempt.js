const fs = require("fs");
const path = require("path");
const {
  REPO_ROOT,
  ensureDir,
  parseArgs,
  readJson,
  writeJson
} = require("./lib");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function required(options, key, flag) {
  const value = options[key];
  if (!value || value === true) {
    throw new Error(`${flag} is required.`);
  }
  return String(value).trim();
}

function recordAnimationAttempt(options = {}) {
  const storyId = slugify(required(options, "story", "--story"));
  const sceneId = String(required(options, "scene", "--scene")).toUpperCase();
  const slug = slugify(required(options, "slug", "--slug"));
  const status = String(options.status || "candidate").toLowerCase();
  if (!["candidate", "accepted", "rejected"].includes(status)) {
    throw new Error("--status must be candidate, accepted, or rejected.");
  }
  const experimentRoot = path.join(
    REPO_ROOT,
    "output",
    "story_packages",
    storyId,
    "animation_experiments",
    sceneId.toLowerCase()
  );
  const requestedAttempt = options.attempt || "auto";
  const existingNumbers = fs.existsSync(experimentRoot)
    ? fs.readdirSync(experimentRoot)
      .map((name) => /^attempt_(\d+)_/.exec(name))
      .filter(Boolean)
      .map((match) => Number(match[1]))
    : [];
  const attemptNumber = String(requestedAttempt).toLowerCase() === "auto"
    ? Math.max(0, ...existingNumbers) + 1
    : Number(requestedAttempt);
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("--attempt must be auto or a positive integer.");
  }
  const attemptId = `attempt_${String(attemptNumber).padStart(3, "0")}_${slug}`;
  const attemptDir = path.join(experimentRoot, attemptId);
  if (fs.existsSync(attemptDir)) {
    throw new Error(`Animation attempt already exists: ${attemptDir}`);
  }
  ensureDir(attemptDir);

  const artifactPaths = String(options.artifacts || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
  const missing = artifactPaths.filter((item) => !fs.existsSync(item));
  if (missing.length > 0) {
    throw new Error(`Attempt artifacts not found:\n${missing.join("\n")}`);
  }
  const usedNames = new Set();
  const artifacts = artifactPaths.map((sourcePath, index) => {
    const sourceName = path.basename(sourcePath);
    const destinationName = usedNames.has(sourceName)
      ? `${String(index + 1).padStart(2, "0")}_${sourceName}`
      : sourceName;
    usedNames.add(destinationName);
    const destinationPath = path.join(attemptDir, destinationName);
    fs.copyFileSync(sourcePath, destinationPath);
    return {
      file: destinationName,
      source: path.relative(REPO_ROOT, sourcePath).replaceAll("\\", "/")
    };
  });
  const manifest = {
    attempt_id: attemptId,
    attempt_number: attemptNumber,
    story_id: storyId,
    scene_id: sceneId,
    recorded_at: new Date().toISOString(),
    status,
    hypothesis: required(options, "hypothesis", "--hypothesis"),
    outcome: required(options, "outcome", "--outcome"),
    lesson_ids: String(options.lessonIds || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    artifacts
  };
  writeJson(path.join(attemptDir, "manifest.json"), manifest);

  const indexPath = path.join(experimentRoot, "index.json");
  const index = fs.existsSync(indexPath)
    ? readJson(indexPath)
    : { story_id: storyId, scene_id: sceneId, attempts: [] };
  index.updated_at = manifest.recorded_at;
  index.attempts = [...index.attempts, {
    attempt_id: attemptId,
    status,
    manifest: `${attemptId}/manifest.json`
  }].sort((left, right) => left.attempt_id.localeCompare(right.attempt_id));
  writeJson(indexPath, index);
  console.log(`Recorded animation attempt at ${attemptDir}`);
  return { attemptDir, manifest };
}

if (require.main === module) {
  try {
    recordAnimationAttempt(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { recordAnimationAttempt };
