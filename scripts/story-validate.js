const fs = require("fs");
const path = require("path");
const {
  parseCliArgs,
  resolveStoryId,
  stageDir
} = require("./story_cli_lib");

function expect(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(filePath);
  }
}

function runStoryValidate(options = {}) {
  const storyId = resolveStoryId(options);
  const errors = [];
  expect(path.join(stageDir(storyId, "01_story_package"), "story_package.json"), errors);
  expect(path.join(stageDir(storyId, "02_voice"), "voice_preview_manifest.json"), errors);
  expect(path.join(stageDir(storyId, "04_visuals"), "storyboard.json"), errors);
  expect(path.join(stageDir(storyId, "05_preview"), "animatic_summary.json"), errors);
  if (errors.length > 0) {
    throw new Error(`Workspace validation failed. Missing files:\n${errors.join("\n")}`);
  }
  console.log(`Workspace validation passed for ${storyId}.`);
}

if (require.main === module) {
  try {
    runStoryValidate(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runStoryValidate
};
