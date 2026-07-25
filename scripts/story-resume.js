const { parseCliArgs, readWorkspaceStatus, resolveStoryId } = require("./story_cli_lib");
const { runStoryFull } = require("./story-full");

async function runStoryResume(options = {}) {
  const storyId = resolveStoryId(options);
  const status = readWorkspaceStatus(storyId);
  const previewDone = status.stages.preview?.status === "completed";
  const finalDone = status.stages.final?.status === "completed";
  if (finalDone) {
    console.log(`Story ${storyId} is already complete.`);
    return;
  }
  await runStoryFull({
    ...options,
    topic: storyId,
    approvePreview: previewDone || options.approvePreview || options["approve-preview"]
  });
}

if (require.main === module) {
  runStoryResume(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryResume
};
