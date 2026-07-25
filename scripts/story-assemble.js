const path = require("path");
const { runStoryMotion } = require("./story-motion");
const {
  copyRecursive,
  ensureDir,
  parseCliArgs,
  stageDir,
  updateStageStatus,
  writeJson,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

async function runStoryAssemble(options = {}) {
  const storyId = await runStoryMotion(options).then(() => (options.topic || options.story || options._?.[0] || "the_great_brick_heist").toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const destinationDir = stageDir(storyId, "07_scene_outputs");
  ensureDir(destinationDir);
  copyRecursive(path.join(stageDir(storyId, "05_preview"), "story_animatic.mp4"), path.join(destinationDir, "scene_review_cut.mp4"));
  copyRecursive(path.join(stageDir(storyId, "05_preview"), "story_animatic_silent.mp4"), path.join(destinationDir, "scene_review_cut_silent.mp4"));
  writeJson(path.join(destinationDir, "scene_outputs_manifest.json"), {
    story_id: storyId,
    generated_at: new Date().toISOString(),
    outputs: [
      "scene_review_cut.mp4",
      "scene_review_cut_silent.mp4"
    ]
  });
  updateStageStatus(storyId, "scene_outputs", "completed", {
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Scene assembly outputs prepared at ${destinationDir}`);
}

if (require.main === module) {
  runStoryAssemble(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryAssemble
};
