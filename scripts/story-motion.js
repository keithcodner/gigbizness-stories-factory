const path = require("path");
const { runStoryPreviewStage } = require("./story-preview");
const {
  copyRecursive,
  ensureDir,
  ensureWorkspace,
  parseCliArgs,
  stageDir,
  updateStageStatus,
  writeJson,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

async function runStoryMotion(options = {}) {
  const base = await runStoryPreviewStage(options);
  const sourcePreviewDir = stageDir(base.story_id, "05_preview");
  const destinationDir = stageDir(base.story_id, "06_motion");
  ensureWorkspace(base.story_id);
  ensureDir(destinationDir);
  copyRecursive(path.join(sourcePreviewDir, "animatic_summary.json"), path.join(destinationDir, "motion_input_animatic_summary.json"));
  writeJson(path.join(destinationDir, "motion_render_queue.json"), {
    story_id: base.story_id,
    generated_at: new Date().toISOString(),
    status: "prepared",
    clips: []
  });
  updateStageStatus(base.story_id, "motion", "completed", {
    workspace_dir: destinationDir,
    mode: "prepared_only"
  });
  writeWorkspaceStatusArtifacts(base.story_id);
  console.log(`Workspace motion package prepared at ${destinationDir}`);
}

if (require.main === module) {
  runStoryMotion(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryMotion
};
