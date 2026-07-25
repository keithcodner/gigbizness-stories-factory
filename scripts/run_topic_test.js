const path = require("path");
const { parseArgs } = require("./lib");
const { prepareTopicInput } = require("./prepare_topic_input");
const { runWorkflow } = require("./run_workflow");

async function runTopicTest(options = {}) {
  const topic = options.topic || options._?.[0] || "test_story_template";
  const prepared = prepareTopicInput({
    topic,
    shot: options.shot,
    source: options.source || "approved_keyframe"
  });

  return runWorkflow({
    ...options,
    input: prepared.lab_input_file,
    label: options.label || `${topic}_wan_i2v_test`
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runTopicTest(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runTopicTest
};
