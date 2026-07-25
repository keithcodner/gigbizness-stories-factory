const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function resolveFromRoot(...parts) {
  return path.join(repoRoot, ...parts);
}

const paths = {
  repoRoot,
  configDir: resolveFromRoot("config"),
  docsDir: resolveFromRoot("docs"),
  libraryDir: resolveFromRoot("library"),
  outputDir: resolveFromRoot("output"),
  promptsDir: resolveFromRoot("prompts"),
  reportsDir: resolveFromRoot("reports"),
  schemasDir: resolveFromRoot("schemas"),
  scriptsDir: resolveFromRoot("scripts"),
  templatesDir: resolveFromRoot("templates"),
  tmpDir: resolveFromRoot("tmp"),
  topicsDir: resolveFromRoot("topics"),
  workspacesDir: resolveFromRoot("workspaces")
};

module.exports = {
  ...paths,
  resolveFromRoot
};
