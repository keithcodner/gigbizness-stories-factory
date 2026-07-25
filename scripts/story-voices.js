const path = require("path");
const { runStoryPreview } = require("./run_story_preview");
const {
  copyRecursive,
  ensureWorkspace,
  parseCliArgs,
  resolveTopicName,
  stageDir,
  updateStageStatus,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

function runStoryVoices(options = {}) {
  const topic = resolveTopicName(options);
  const result = runStoryPreview({
    ...options,
    story: topic
  });
  const storyId = result.story_id;
  const sourceDir = path.join(result.output_dir, "voice_preview");
  const destinationDir = stageDir(storyId, "02_voice");
  ensureWorkspace(storyId);
  copyRecursive(sourceDir, destinationDir);
  updateStageStatus(storyId, "voice_preview", "completed", {
    source_output_dir: sourceDir,
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Workspace voice preview synced to ${destinationDir}`);
  return {
    story_id: storyId,
    workspace_dir: destinationDir
  };
}

if (require.main === module) {
  try {
    runStoryVoices(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runStoryVoices
};
