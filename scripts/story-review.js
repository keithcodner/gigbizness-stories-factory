const path = require("path");
const { runStoryAssemble } = require("./story-assemble");
const {
  copyRecursive,
  ensureDir,
  parseCliArgs,
  stageDir,
  updateStageStatus,
  writeJson,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

async function runStoryReview(options = {}) {
  const storyId = (options.topic || options.story || options._?.[0] || "the_great_brick_heist").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  await runStoryAssemble(options);
  const destinationDir = stageDir(storyId, "08_review");
  ensureDir(destinationDir);
  copyRecursive(path.join(stageDir(storyId, "07_scene_outputs"), "scene_review_cut.mp4"), path.join(destinationDir, "review_cut.mp4"));
  writeJson(path.join(destinationDir, "review_packet.json"), {
    story_id: storyId,
    generated_at: new Date().toISOString(),
    status: "ready_for_review"
  });
  updateStageStatus(storyId, "review", "completed", {
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Review package prepared at ${destinationDir}`);
}

if (require.main === module) {
  runStoryReview(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryReview
};
