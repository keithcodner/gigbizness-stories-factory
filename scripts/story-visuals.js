const path = require("path");
const { buildVisualPackage } = require("./build_story_visual_package");
const { runStoryVoices } = require("./story-voices");
const {
  copyRecursive,
  ensureWorkspace,
  parseCliArgs,
  resolveTopicName,
  stageDir,
  storyPackageRoot,
  updateStageStatus,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

function runStoryVisuals(options = {}) {
  const topic = resolveTopicName(options);
  runStoryVoices({
    ...options,
    topic
  });
  const storyId = topic.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const packagePath = path.join(storyPackageRoot(storyId), "story_package.json");
  const result = buildVisualPackage({
    ...options,
    package: packagePath
  });
  const sourceDir = result.output_dir;
  const destinationDir = stageDir(storyId, "04_visuals");
  ensureWorkspace(storyId);
  copyRecursive(sourceDir, destinationDir);
  updateStageStatus(storyId, "visual_package", "completed", {
    source_output_dir: sourceDir,
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Workspace visual package synced to ${destinationDir}`);
  return {
    story_id: storyId,
    package_path: packagePath,
    output_dir: sourceDir,
    workspace_dir: destinationDir
  };
}

if (require.main === module) {
  try {
    runStoryVisuals(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runStoryVisuals
};
