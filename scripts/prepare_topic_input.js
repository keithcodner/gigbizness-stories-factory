const fs = require("fs");
const path = require("path");
const { LAB_ROOT, REPO_ROOT, ensureDir, parseArgs, writeJson } = require("./lib");

function listCandidates(workspaceDir, source) {
  if (source === "reference_image") {
    const referenceDir = path.join(workspaceDir, "04_assets", "reference_images");
    return fs.existsSync(referenceDir)
      ? fs.readdirSync(referenceDir)
        .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
        .map((name) => path.join(referenceDir, name))
      : [];
  }

  const keyframeDir = path.join(workspaceDir, "07_visuals", "approved_keyframes");
  const keyframes = fs.existsSync(keyframeDir)
    ? fs.readdirSync(keyframeDir)
      .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
      .map((name) => path.join(keyframeDir, name))
    : [];

  if (source === "approved_keyframe") {
    return keyframes;
  }

  return [
    ...keyframes,
    ...listCandidates(workspaceDir, "reference_image")
  ];
}

function prepareTopicInput(options = {}) {
  const topic = options.topic || options._?.[0] || "test_story_template";
  const source = options.source || "approved_keyframe";
  const workspaceDir = path.join(REPO_ROOT, "workspaces", topic);
  if (!fs.existsSync(workspaceDir)) {
    throw new Error(`Workspace not found: ${workspaceDir}`);
  }

  let candidates = listCandidates(workspaceDir, source);
  if (options.shot) {
    candidates = candidates.filter((filePath) => path.basename(filePath).startsWith(String(options.shot)));
  }
  candidates = candidates.sort();
  if (candidates.length === 0) {
    throw new Error(`No candidate images found for topic '${topic}' using source '${source}'.`);
  }

  const selected = candidates[0];
  const destinationDir = path.join(LAB_ROOT, "input");
  ensureDir(destinationDir);
  const extension = path.extname(selected) || ".png";
  const destination = path.join(destinationDir, `${topic}${options.shot ? `_${options.shot}` : ""}_source${extension}`);
  fs.copyFileSync(selected, destination);

  const report = {
    prepared_at: new Date().toISOString(),
    topic,
    source,
    shot: options.shot || null,
    selected_source_file: selected,
    lab_input_file: destination
  };
  const reportPath = path.join(LAB_ROOT, "reports", "runtime", "prepared_input.json");
  writeJson(reportPath, report);

  console.log(`Prepared lab input: ${destination}`);
  console.log(`Preparation report written to ${reportPath}`);
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  prepareTopicInput(args);
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
  prepareTopicInput
};
