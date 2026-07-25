const path = require("path");
const { renderStoryVisuals } = require("./render_story_visuals");
const { buildStoryAnimatic } = require("./build_story_animatic");
const { runStoryVisuals } = require("./story-visuals");
const {
  copyRecursive,
  ensureWorkspace,
  parseCliArgs,
  resolveTopicName,
  stageDir,
  updateStageStatus,
  writeJson,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

async function runStoryPreviewStage(options = {}) {
  const topic = resolveTopicName(options);
  const base = runStoryVisuals({
    ...options,
    topic
  });
  await renderStoryVisuals({
    ...options,
    package: base.package_path
  });
  const animatic = buildStoryAnimatic({
    ...options,
    package: base.package_path
  });
  const sourceDir = path.join(base.output_dir, "animatic");
  const destinationDir = stageDir(base.story_id, "05_preview");
  ensureWorkspace(base.story_id);
  copyRecursive(sourceDir, destinationDir);
  writeJson(path.join(destinationDir, "preview_approval.json"), {
    story_id: base.story_id,
    approved: false,
    status: "pending_review",
    created_at: new Date().toISOString(),
    preview_output: animatic.output_file
  });
  updateStageStatus(base.story_id, "preview", "completed", {
    source_output_dir: sourceDir,
    workspace_dir: destinationDir,
    approval_required: true
  });
  writeWorkspaceStatusArtifacts(base.story_id);
  console.log(`Workspace preview package synced to ${destinationDir}`);
  return {
    story_id: base.story_id,
    workspace_dir: destinationDir
  };
}

if (require.main === module) {
  runStoryPreviewStage(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryPreviewStage
};
