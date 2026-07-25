const path = require("path");
const { runStoryReview } = require("./story-review");
const {
  copyRecursive,
  ensureDir,
  parseCliArgs,
  stageDir,
  updateStageStatus,
  writeJson,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

async function runStoryFinish(options = {}) {
  const storyId = (options.topic || options.story || options._?.[0] || "the_great_brick_heist").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  await runStoryReview(options);
  const destinationDir = stageDir(storyId, "09_final");
  ensureDir(destinationDir);
  copyRecursive(path.join(stageDir(storyId, "08_review"), "review_cut.mp4"), path.join(destinationDir, `${storyId}_final.mp4`));
  writeJson(path.join(destinationDir, "final_delivery_manifest.json"), {
    story_id: storyId,
    generated_at: new Date().toISOString(),
    final_video: `${storyId}_final.mp4`,
    credits: [],
    source_report: {
      review_stage: "08_review"
    }
  });
  updateStageStatus(storyId, "final", "completed", {
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Final delivery prepared at ${destinationDir}`);
}

if (require.main === module) {
  runStoryFinish(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryFinish
};
