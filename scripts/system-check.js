const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseCliArgs, writeJson } = require("./story_cli_lib");
const { reportsDir, resolveFromRoot } = require("../src/paths");

function commandOk(command, args = ["-version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0;
}

function runSystemCheck() {
  const report = {
    checked_at: new Date().toISOString(),
    commands: {
      node: commandOk("node", ["--version"]),
      python: commandOk("python", ["--version"]),
      ffmpeg: commandOk("ffmpeg", ["-version"])
    },
    folders: {
      config: fs.existsSync(resolveFromRoot("config")),
      scripts: fs.existsSync(resolveFromRoot("scripts")),
      workspaces: fs.existsSync(resolveFromRoot("workspaces")),
      library: fs.existsSync(resolveFromRoot("library"))
    }
  };
  const reportPath = path.join(reportsDir, "runtime", "system_check.json");
  writeJson(reportPath, report);
  if (Object.values(report.commands).some((value) => value !== true)) {
    throw new Error(`System check failed. See ${reportPath}`);
  }
  console.log(`System check passed. Report written to ${reportPath}`);
}

if (require.main === module) {
  try {
    runSystemCheck(parseCliArgs());
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runSystemCheck
};
