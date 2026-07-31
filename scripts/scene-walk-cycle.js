const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { finishSceneSample } = require("./scene-sample-finish");
const { recordAnimationAttempt } = require("./record-animation-attempt");
const { runWorkflow } = require("./run_workflow");
const {
  REPO_ROOT,
  ensureDir,
  parseArgs,
  readJson,
  resolveFfmpegPath
} = require("./lib");

function firstVideo(report) {
  const asset = (report.downloaded_assets || [])
    .find((item) => item.local_path && item.local_path.toLowerCase().endsWith(".mp4"));
  if (!asset) {
    throw new Error("Walk interpolation produced no MP4.");
  }
  return asset.local_path;
}

function alphaBounds(imagePath) {
  const nullOutput = process.platform === "win32" ? "NUL" : "/dev/null";
  const probe = spawnSync(resolveFfmpegPath(), [
    "-hide_banner",
    "-i", imagePath,
    "-vf", "alphaextract,bbox",
    "-frames:v", "1",
    "-f", "null",
    nullOutput
  ], { encoding: "utf8" });
  const match = /x1:(\d+)\s+x2:(\d+)\s+y1:(\d+)\s+y2:(\d+)\s+w:(\d+)\s+h:(\d+)/.exec(
    `${probe.stdout || ""}\n${probe.stderr || ""}`
  );
  if (!match) {
    throw new Error(`Unable to detect transparent character bounds: ${imagePath}`);
  }
  return {
    x: Number(match[1]),
    y: Number(match[3]),
    width: Number(match[5]),
    height: Number(match[6])
  };
}

async function runSceneWalkCycle(options = {}) {
  let poses = String(options.poses || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
  if (poses.length < 3 || poses.some((item) => !fs.existsSync(item))) {
    throw new Error("--poses must contain at least three readable key-pose image paths.");
  }
  const sourcePoses = [...poses];
  const storyId = String(options.story || "the_great_brick_heist_scene_sample");
  const microSceneId = String(options.microScene || "SCENE_01_MS_04");
  const profile = readJson(path.join(REPO_ROOT, "config", "motion_profiles", "gtx1080_walk_cycle.json"));
  const fullCycle = poses.length >= Number(profile.full_cycle_minimum_poses || 6);
  const sourceFps = fullCycle
    ? Number(profile.full_cycle_source_fps || 8)
    : Number(profile.source_fps);
  const interpolationMultiplier = fullCycle
    ? Number(profile.full_cycle_interpolation_multiplier || 3)
    : Number(profile.interpolation_multiplier);
  const fullCycleRenderer = String(profile.full_cycle_renderer || "keypose_hold");
  const interpolateFullCycle = fullCycle && fullCycleRenderer === "rife";
  const environmentPath = options.environment ? path.resolve(options.environment) : null;
  if (environmentPath && !fs.existsSync(environmentPath)) {
    throw new Error(`Environment plate not found: ${environmentPath}`);
  }
  const packageDir = path.join(REPO_ROOT, "output", "story_packages", storyId);
  const outputDir = path.join(packageDir, "scene_sample");
  ensureDir(outputDir);
  const layeredTravel = Boolean(
    fullCycle
    && environmentPath
    && fullCycleRenderer === "keypose_hold"
  );
  if (layeredTravel) {
    const normalizedDir = path.join(outputDir, `${microSceneId.toLowerCase()}_grounded_sprites`);
    ensureDir(normalizedDir);
    const spriteWidth = Number(profile.travel_sprite_width || 600);
    const spriteHeight = Number(profile.travel_sprite_height || 680);
    const characterHeight = Number(profile.travel_character_height || 610);
    poses = poses.map((pose, index) => {
      const bounds = alphaBounds(pose);
      const normalized = path.join(normalizedDir, `pose_${String(index + 1).padStart(2, "0")}.png`);
      const normalize = spawnSync(resolveFfmpegPath(), [
        "-y",
        "-i", pose,
        "-vf",
        `crop=${bounds.width}:${bounds.height}:${bounds.x}:${bounds.y},scale=-2:${characterHeight},format=rgba,pad=${spriteWidth}:${spriteHeight}:(ow-iw)/2:${spriteHeight}-${characterHeight}:color=0x00000000`,
        "-frames:v", "1",
        "-update", "1",
        normalized
      ], { encoding: "utf8" });
      if (normalize.status !== 0) {
        throw new Error(normalize.stderr || `Failed to ground-normalize pose ${index + 1}.`);
      }
      return normalized;
    });
  } else if (environmentPath) {
    const lockedPoseDir = path.join(outputDir, `${microSceneId.toLowerCase()}_locked_poses`);
    ensureDir(lockedPoseDir);
    poses = poses.map((pose, index) => {
      const lockedPose = path.join(lockedPoseDir, `pose_${String(index + 1).padStart(2, "0")}.png`);
      const composite = spawnSync(resolveFfmpegPath(), [
        "-y",
        "-i", environmentPath,
        "-i", pose,
        "-filter_complex",
        `[0:v]scale=${profile.delivery_width}:${profile.delivery_height}[environment];[1:v]scale=${profile.delivery_width}:${profile.delivery_height},format=rgba[character];[environment][character]overlay=0:0:format=auto[locked]`,
        "-map", "[locked]",
        "-frames:v", "1",
        lockedPose
      ], { encoding: "utf8" });
      if (composite.status !== 0) {
        throw new Error(composite.stderr || `Failed to lock pose ${index + 1} to the environment plate.`);
      }
      return lockedPose;
    });
  }
  const cyclePoses = interpolateFullCycle ? [...poses, poses[0]] : poses;
  const keyposeVideo = path.join(
    outputDir,
    `${microSceneId.toLowerCase()}_${layeredTravel ? "walk_alpha_keyposes.mov" : "walk_keyposes.mp4"}`
  );
  const ffmpegArgs = ["-y"];
  for (const pose of cyclePoses) {
    ffmpegArgs.push("-loop", "1", "-t", String(1 / sourceFps), "-i", pose);
  }
  const filters = cyclePoses.map((_, index) => layeredTravel
    ? `[${index}:v]format=rgba[pose${index}]`
    : `[${index}:v]scale=${profile.delivery_width}:${profile.delivery_height}[pose${index}]`
  );
  const inputs = cyclePoses.map((_, index) => `[pose${index}]`).join("");
  filters.push(
    layeredTravel
      ? `${inputs}concat=n=${cyclePoses.length}:v=1:a=0,fps=${sourceFps},format=rgba[video]`
      : `${inputs}concat=n=${cyclePoses.length}:v=1:a=0,fps=${sourceFps},format=yuv420p[video]`
  );
  ffmpegArgs.push(
    "-filter_complex", filters.join(";"),
    "-map", "[video]",
    "-frames:v", String(cyclePoses.length),
    ...(layeredTravel ? ["-c:v", "qtrle", "-pix_fmt", "argb"] : []),
    keyposeVideo
  );
  const source = spawnSync(resolveFfmpegPath(), ffmpegArgs, { encoding: "utf8" });
  if (source.status !== 0) {
    throw new Error(source.stderr || "Failed to build walk key-pose video.");
  }

  const cyclePath = path.join(outputDir, `${microSceneId.toLowerCase()}_walk_cycle.mp4`);
  let cycle;
  if (layeredTravel) {
    const duration = Number(profile.travel_duration_seconds || 8);
    const spriteHeight = Number(profile.travel_sprite_height || 680);
    const groundY = Number(profile.travel_ground_y || 690);
    const startX = Number(profile.travel_start_x || 40);
    const speed = Number(profile.travel_pixels_per_second || 100);
    cycle = spawnSync(resolveFfmpegPath(), [
      "-y",
      "-loop", "1",
      "-i", environmentPath,
      "-stream_loop", "-1",
      "-i", keyposeVideo,
      "-filter_complex",
      `[0:v]scale=${profile.delivery_width}:${profile.delivery_height}[environment];[1:v]fps=${profile.delivery_fps},format=rgba[character];[environment][character]overlay=x='${startX}+${speed}*t':y=${groundY}-${spriteHeight}:shortest=1,format=yuv420p[video]`,
      "-map", "[video]",
      "-t", String(duration),
      "-r", String(profile.delivery_fps),
      cyclePath
    ], { encoding: "utf8" });
  } else {
    let smoothPath = keyposeVideo;
    if (!fullCycle || interpolateFullCycle) {
      const interpolated = await runWorkflow({
        workflow: path.join(REPO_ROOT, "templates", "video_interpolate_api.json"),
        patch: path.join(REPO_ROOT, "config", "video_interpolate_patch_rules.json"),
        videoPath: keyposeVideo.replaceAll("\\", "/"),
        sourceFps,
        multiplier: interpolationMultiplier,
        outputFps: profile.delivery_fps,
        filenamePrefix: `${microSceneId.toLowerCase()}_walk_smooth`,
        label: `${microSceneId.toLowerCase()}_walk_smooth`
      });
      smoothPath = firstVideo(interpolated);
    }
    const cycleFilter = interpolateFullCycle
      ? `[0:v]trim=end_frame=${poses.length * interpolationMultiplier},setpts=PTS-STARTPTS,format=yuv420p[video]`
      : fullCycle
      ? `[0:v]fps=${profile.delivery_fps},format=yuv420p[video]`
      : "[0:v]split=2[forward][reverse_input];[reverse_input]reverse[reverse];[forward][reverse]concat=n=2:v=1:a=0,format=yuv420p[video]";
    cycle = spawnSync(resolveFfmpegPath(), [
      "-y",
      "-i", smoothPath,
      "-filter_complex", cycleFilter,
      "-map", "[video]",
      "-r", String(profile.delivery_fps),
      cyclePath
    ], { encoding: "utf8" });
  }
  if (cycle.status !== 0) {
    throw new Error(cycle.stderr || "Failed to assemble seamless walk cycle.");
  }
  const finished = finishSceneSample({
    story: storyId,
    microScene: microSceneId,
    motion: cyclePath,
    cameraTrack: !layeredTravel,
    environmentReference: environmentPath,
    fps: profile.delivery_fps,
    width: profile.delivery_width,
    height: profile.delivery_height,
    output: options.output
  });
  const reviewPath = path.join(
    outputDir,
    `${microSceneId.toLowerCase()}_${fullCycle ? "full_cycle" : "preview"}_review.png`
  );
  const reviewFilter = fullCycle
    ? "trim=duration=1,fps=8,scale=426:240,tile=4x2"
    : "fps=1.15,scale=426:240,tile=4x2";
  const review = spawnSync(resolveFfmpegPath(), [
    "-y",
    "-i", finished.outputPath,
    "-vf", reviewFilter,
    "-frames:v", "1",
    "-update", "1",
    reviewPath
  ], { encoding: "utf8" });
  if (review.status !== 0) {
    throw new Error(review.stderr || "Failed to create the animation-attempt review sheet.");
  }
  const attempt = recordAnimationAttempt({
    story: storyId,
    scene: microSceneId,
    attempt: options.attempt || "auto",
    slug: options.attemptSlug || (
      fullCycle
        ? `eight_phase_${layeredTravel ? "grounded_travel" : fullCycleRenderer}`
        : "three_pose_walk_preview"
    ),
    status: "candidate",
    hypothesis: options.hypothesis || (
      fullCycle
        ? "A complete alternating eight-phase gait will read as walking without reverse-playback rocking."
        : "A three-pose preview will establish visual consistency before a complete gait is produced."
    ),
    outcome: "Automated candidate render; review the included cycle sheet before accepting or rejecting this iteration.",
    lessonIds: fullCycle
      ? `eight_phase_walk_cycle_v2,environment_locked_plate_v1,character_alpha_layer_v1,multi_frame_visual_review_v1${layeredTravel ? ",grounded_character_travel_v1" : ""}`
      : "three_pose_walk_cycle_v1,environment_locked_plate_v1,multi_frame_visual_review_v1",
    artifacts: [...sourcePoses, finished.outputPath, reviewPath].join(",")
  });
  return { ...finished, reviewPath, attemptDir: attempt.attemptDir };
}

if (require.main === module) {
  runSceneWalkCycle(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runSceneWalkCycle
};
