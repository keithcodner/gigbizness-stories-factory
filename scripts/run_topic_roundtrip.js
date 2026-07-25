const { parseArgs } = require("./lib");
const { runTopicTest } = require("./run_topic_test");
const { importToWorkspace } = require("./import_to_workspace");

async function runTopicRoundtrip(options = {}) {
  const topic = options.topic || options._?.[0] || "test_story_template";
  const shot = options.shot || options.shotId || "LAB_SHOT_001";
  const runReport = await runTopicTest({
    ...options,
    topic
  });

  return importToWorkspace({
    ...options,
    topic,
    shot,
    report: options.report || null,
    assetFile: options.assetFile || null,
    label: options.label || null,
    _:[]
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runTopicRoundtrip(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runTopicRoundtrip
};
