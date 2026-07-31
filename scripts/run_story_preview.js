const path = require("path");
const { spawnSync } = require("child_process");
const { parseArgs, resolveFfmpegPath } = require("./lib");
const { buildPackage } = require("./build_story_package");

function runCommand(command, args, label, env = process.env) {
  const result = spawnSync(command, args, { encoding: "utf8", env });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function runStoryPreview(options = {}) {
  const pkg = buildPackage(options);
  const pythonScript = path.join(__dirname, "generate_story_voice_preview.py");
  runCommand("python", [
    pythonScript,
    "--package",
    pkg.package_path
  ], "generate_story_voice_preview.py", {
    ...process.env,
    FFMPEG_PATH: resolveFfmpegPath()
  });
  console.log(`Story preview package completed for '${pkg.story_id}'.`);
  return pkg;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  runStoryPreview(args);
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
  runStoryPreview
};
