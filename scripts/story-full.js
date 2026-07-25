const { parseCliArgs } = require("./story_cli_lib");
const { runStoryPreviewStage } = require("./story-preview");
const { runStoryFinish } = require("./story-finish");

async function runStoryFull(options = {}) {
  await runStoryPreviewStage(options);
  if (!options.approvePreview && !options["approve-preview"]) {
    console.log("Preview completed. Stopping at approval gate. Re-run with --approve-preview to continue.");
    return;
  }
  await runStoryFinish(options);
}

if (require.main === module) {
  runStoryFull(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryFull
};
