const path = require("path");
const {
  parseCliArgs,
  readWorkspaceStatus,
  resolveStoryId,
  workspaceRoot,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

function runStoryStatus(options = {}) {
  const storyId = resolveStoryId(options);
  const status = readWorkspaceStatus(storyId);
  writeWorkspaceStatusArtifacts(storyId);
  console.log(`Workspace: ${workspaceRoot(storyId)}`);
  console.log(JSON.stringify(status, null, 2));
}

if (require.main === module) {
  try {
    runStoryStatus(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runStoryStatus
};
