const path = require("path");
const { buildPackage } = require("./build_story_package");
const {
  copyRecursive,
  ensureWorkspace,
  parseCliArgs,
  resolveStoryId,
  resolveTopicName,
  stageDir,
  updateStageStatus,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

function runStoryPackage(options = {}) {
  const topic = resolveTopicName(options);
  const result = buildPackage({
    ...options,
    story: topic
  });
  const storyId = resolveStoryId({ topic: result.story_id });
  const destinationDir = stageDir(storyId, "01_story_package");
  ensureWorkspace(storyId);
  copyRecursive(result.package_path, path.join(destinationDir, "story_package.json"));
  copyRecursive(result.preview_path, path.join(destinationDir, "story_preview.md"));
  copyRecursive(path.join(result.output_dir, "micro_scenes.json"), path.join(destinationDir, "micro_scenes.json"));
  copyRecursive(path.join(result.output_dir, "voice_segments.json"), path.join(destinationDir, "voice_segments.json"));
  updateStageStatus(storyId, "story_package", "completed", {
    source_output_dir: result.output_dir,
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Workspace story package synced to ${destinationDir}`);
  return {
    ...result,
    story_id: storyId,
    workspace_dir: destinationDir
  };
}

if (require.main === module) {
  try {
    runStoryPackage(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runStoryPackage
};
