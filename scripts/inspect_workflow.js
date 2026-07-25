const fs = require("fs");
const path = require("path");
const { LAB_ROOT, parseArgs, readJson, writeJson } = require("./lib");

function inspectWorkflow(options = {}) {
  const workflowPath = path.resolve(options.workflow || path.join(LAB_ROOT, "templates", "wan_i2v_api.json"));
  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow file not found: ${workflowPath}`);
  }
  const workflow = readJson(workflowPath);
  const inspection = Object.entries(workflow)
    .map(([nodeId, node]) => ({
      node_id: nodeId,
      class_type: node.class_type || null,
      input_names: Object.keys(node.inputs || {})
    }))
    .sort((left, right) => Number(left.node_id) - Number(right.node_id));

  for (const item of inspection) {
    console.log(`${item.node_id} | ${item.class_type} | ${item.input_names.join(", ")}`);
  }

  const reportPath = path.join(LAB_ROOT, "reports", "runtime", "workflow_inspection.json");
  writeJson(reportPath, {
    inspected_at: new Date().toISOString(),
    workflow_path: workflowPath,
    nodes: inspection
  });
  console.log(`Inspection report written to ${reportPath}`);
  return inspection;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  inspectWorkflow(args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  inspectWorkflow
};
