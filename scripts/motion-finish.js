const fs = require("fs");
const path = require("path");
const { parseCliArgs, writeJson } = require("./story_cli_lib");
const { runWorkflow } = require("./run_workflow");
const { REPO_ROOT } = require("./lib");
const { discoverServer, loadProfile } = require("./motion-proof");
const { execFileSync } = require("child_process");

function probeVideo(videoPath) {
  const probeJson = execFileSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=avg_frame_rate,r_frame_rate,nb_frames,width,height",
    "-of",
    "json",
    videoPath
  ], { encoding: "utf8" });
  const data = JSON.parse(probeJson);
  const stream = data.streams?.[0] || {};
  return {
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    sourceFps: fpsFromRatio(stream.avg_frame_rate) || fpsFromRatio(stream.r_frame_rate) || 8,
    frameCount: Number(stream.nb_frames || 0)
  };
}

function fpsFromRatio(value) {
  if (!value || typeof value !== "string") {
    return 0;
  }
  const [num, den] = value.split("/").map(Number);
  if (!num || !den) {
    return 0;
  }
  return num / den;
}

function resolveVideoInput(options = {}) {
  if (options.input) {
    return path.resolve(options.input);
  }
  if (!options.storyId) {
    throw new Error("A source video path or story identifier is required for motion finishing.");
  }
  const motionDir = path.join(REPO_ROOT, "workspaces", options.storyId, "06_motion");
  if (!fs.existsSync(motionDir)) {
    throw new Error(`Motion workspace directory not found: ${motionDir}`);
  }
  const candidates = fs.readdirSync(motionDir)
    .filter((name) => name.toLowerCase().endsWith(".mp4"))
    .map((name) => path.join(motionDir, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  if (candidates.length === 0) {
    throw new Error(`No motion clip was found in ${motionDir}`);
  }
  return candidates[0];
}

async function runMotionFinish(options = {}) {
  const profileChoice = options.profile || options.finishProfile || "gtx1080_rife2x_finish";
  const { profilePath, profile } = loadProfile({ profile: profileChoice });
  const storyId = options.storyId || options.topic || options.story || options._?.[0];
  const sourceVideoPath = resolveVideoInput({ ...options, storyId });
  const probed = probeVideo(sourceVideoPath);
  const args = profile.recommended_args || {};
  const multiplier = Number(options.multiplier || args.multiplier || 2);
  const sourceFps = Number(options.sourceFps || args.source_fps || probed.sourceFps || 8);
  const outputFps = Number(options.outputFps || args.output_fps || sourceFps * multiplier);
  const baseUrl = options.baseUrl || await discoverServer(profile.base_url_candidates || []);

  const report = await runWorkflow({
    baseUrl,
    workflow: path.join(REPO_ROOT, profile.workflow_template),
    patch: path.join(REPO_ROOT, profile.patch_rules),
    label: `${profile.profile_id}_${Date.now()}`,
    videoPath: sourceVideoPath.replaceAll("\\", "/"),
    sourceFps,
    outputFps,
    modelName: options.modelName || args.model_name || "rife49.pth",
    multiplier,
    cacheWindow: Number(options.cacheWindow || args.cache_window || 8),
    fastMode: options.fastMode != null ? options.fastMode : args.fast_mode,
    ensemble: options.ensemble != null ? options.ensemble : args.ensemble,
    scaleFactor: Number(options.scaleFactor || args.scale_factor || 1),
    dtype: options.dtype || args.dtype || "float32",
    torchCompile: options.torchCompile != null ? options.torchCompile : false,
    batchSize: Number(options.batchSize || args.batch_size || 1),
    filenamePrefix: options.filenamePrefix || `${path.parse(sourceVideoPath).name}_rife2x`,
    timeoutMs: Number(options.timeoutMs || args.timeout_ms || 1200000),
    pollIntervalMs: Number(options.pollIntervalMs || args.poll_interval_ms || 5000)
  });

  const finishRecordPath = path.join(REPO_ROOT, "reports", "runtime", `${profile.profile_id}_finish.json`);
  writeJson(finishRecordPath, {
    generated_at: new Date().toISOString(),
    profile_path: profilePath,
    profile_id: profile.profile_id,
    source_video_path: sourceVideoPath,
    probed,
    multiplier,
    source_fps: sourceFps,
    output_fps: outputFps,
    report
  });

  console.log(`Motion finish completed for '${path.basename(sourceVideoPath)}'.`);
  console.log(`Finish record written to ${finishRecordPath}`);
  return {
    profilePath,
    profile,
    finishRecordPath,
    sourceVideoPath,
    report
  };
}

if (require.main === module) {
  runMotionFinish(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  probeVideo,
  resolveVideoInput,
  runMotionFinish
};
