const path = require("path");
const { buildStoryCharacterRefs } = require("./build_story_character_refs");
const { runStoryPackage } = require("./story-package");
const {
  copyRecursive,
  ensureWorkspace,
  parseCliArgs,
  resolveTopicName,
  stageDir,
  updateStageStatus,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

async function runStoryCharacters(options = {}) {
  const topic = resolveTopicName(options);
  const pkg = runStoryPackage({
    ...options,
    topic
  });
  await buildStoryCharacterRefs({
    ...options,
    package: pkg.package_path
  });
  const sourceDir = path.join(pkg.output_dir, "visual_package", "character_refs");
  const destinationDir = stageDir(pkg.story_id, "03_characters");
  ensureWorkspace(pkg.story_id);
  copyRecursive(sourceDir, destinationDir);
  copyRecursive(path.join(pkg.output_dir, "visual_package", "character_ref_summary.json"), path.join(destinationDir, "character_ref_summary.json"));
  copyRecursive(path.join(pkg.output_dir, "visual_package", "character_ref_summary.md"), path.join(destinationDir, "character_ref_summary.md"));
  updateStageStatus(pkg.story_id, "character_refs", "completed", {
    source_output_dir: sourceDir,
    workspace_dir: destinationDir
  });
  writeWorkspaceStatusArtifacts(pkg.story_id);
  console.log(`Workspace character refs synced to ${destinationDir}`);
}

if (require.main === module) {
  runStoryCharacters(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryCharacters
};
