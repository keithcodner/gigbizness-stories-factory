const fs = require("fs");
const path = require("path");
const { runStoryPreviewStage } = require("./story-preview");
const { runWorkflow } = require("./run_workflow");
const { REPO_ROOT } = require("./lib");
const { discoverServer, loadProfile } = require("./motion-proof");
const { runMotionFinish } = require("./motion-finish");
const {
  copyRecursive,
  ensureDir,
  ensureWorkspace,
  readJson,
  parseCliArgs,
  stageDir,
  updateStageStatus,
  writeJson,
  writeWorkspaceStatusArtifacts
} = require("./story_cli_lib");

function resolveMotionInput(base, options = {}) {
  if (options.input) {
    return path.resolve(options.input);
  }

  const candidates = [
    path.join(REPO_ROOT, "output", "story_packages", base.story_id, "visual_package", "generated_frames"),
    path.join(stageDir(base.story_id, "04_visuals"), "generated_frames")
  ];

  for (const dirPath of candidates) {
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    const firstImage = fs.readdirSync(dirPath)
      .filter((name) => name.toLowerCase().endsWith(".png"))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))[0];
    if (firstImage) {
      return path.join(dirPath, firstImage);
    }
  }

  return path.join(REPO_ROOT, "input", "test_story_template_source.png");
}

async function runStoryMotion(options = {}) {
  const base = await runStoryPreviewStage(options);
  const sourcePreviewDir = stageDir(base.story_id, "05_preview");
  const destinationDir = stageDir(base.story_id, "06_motion");
  const profileChoice = options.profile || options.motionProfile || "gtx1080_preview";
  const { profilePath, profile: motionProfile } = loadProfile({ profile: profileChoice });
  ensureWorkspace(base.story_id);
  ensureDir(destinationDir);
  const baseUrl = options.baseUrl || await discoverServer(motionProfile.base_url_candidates || []);
  const inputPath = resolveMotionInput(base, options);

  const report = await runWorkflow({
    baseUrl,
    workflow: path.join(REPO_ROOT, motionProfile.workflow_template),
    patch: path.join(REPO_ROOT, motionProfile.patch_rules),
    input: inputPath,
    label: `${base.story_id}_${motionProfile.profile_id}`,
    width: Number(options.width || motionProfile.recommended_args?.width),
    height: Number(options.height || motionProfile.recommended_args?.height),
    frames: Number(options.frames || motionProfile.recommended_args?.frames),
    fps: Number(options.fps || motionProfile.recommended_args?.fps),
    timeoutMs: Number(options.timeoutMs || motionProfile.recommended_args?.timeout_ms || 900000),
    pollIntervalMs: Number(options.pollIntervalMs || motionProfile.recommended_args?.poll_interval_ms || 5000)
  });

  let finishResult = null;
  if (options.interpolate || options.finishPass) {
    const firstClip = (report.downloaded_assets || []).find((asset) => asset.local_path?.toLowerCase().endsWith(".mp4"));
    if (!firstClip) {
      throw new Error("Motion finish pass requested, but no source mp4 clip was produced by the base motion render.");
    }
    finishResult = await runMotionFinish({
      storyId: base.story_id,
      input: firstClip.local_path,
      profile: options.finishProfile || "gtx1080_rife2x_finish",
      baseUrl,
      timeoutMs: options.finishTimeoutMs || options.timeoutMs
    });
  }

  copyRecursive(path.join(sourcePreviewDir, "animatic_summary.json"), path.join(destinationDir, "motion_input_animatic_summary.json"));
  for (const asset of report.downloaded_assets || []) {
    copyRecursive(asset.local_path, path.join(destinationDir, path.basename(asset.local_path)));
  }
  const finishedClips = [];
  if (finishResult) {
    for (const asset of finishResult.report.downloaded_assets || []) {
      if (!asset.local_path?.toLowerCase().endsWith(".mp4")) {
        continue;
      }
      const destinationPath = path.join(destinationDir, `delivery_${path.basename(asset.local_path)}`);
      copyRecursive(asset.local_path, destinationPath);
      finishedClips.push({
        file: path.basename(destinationPath),
        source_path: asset.local_path
      });
    }
  }
  writeJson(path.join(destinationDir, "motion_render_queue.json"), {
    story_id: base.story_id,
    generated_at: new Date().toISOString(),
    status: "completed",
    workflow_template: motionProfile.workflow_template,
    patch_rules: motionProfile.patch_rules,
    motion_profile: motionProfile.profile_id,
    profile_path: path.relative(REPO_ROOT, profilePath).replaceAll("\\", "/"),
    comfyui_base_url: baseUrl,
    recommended_args: motionProfile.recommended_args,
    proof_assets: motionProfile.proof_assets,
    input_image: inputPath,
    clips: (report.downloaded_assets || []).map((asset) => ({
      file: path.basename(asset.local_path),
      source_path: asset.local_path
    })),
    finish_pass: finishResult ? {
      status: "completed",
      motion_profile: finishResult.profile.profile_id,
      finish_record: finishResult.finishRecordPath,
      delivery_clips: finishedClips
    } : {
      status: "not_requested"
    },
    next_action: finishResult
      ? "Review the interpolated delivery clip and proceed to assembly if approved."
      : "Review the generated motion clip and proceed to assembly if approved."
  });
  writeJson(path.join(destinationDir, "motion_run_report.json"), {
    base_render: report,
    finish_pass: finishResult ? finishResult.report : null
  });
  updateStageStatus(base.story_id, "motion", "completed", {
    workspace_dir: destinationDir,
    mode: "workflow_rendered",
    motion_profile: motionProfile.profile_id,
    finish_pass_profile: finishResult ? finishResult.profile.profile_id : null
  });
  writeWorkspaceStatusArtifacts(base.story_id);
  console.log(`Workspace motion package prepared at ${destinationDir}`);
}

if (require.main === module) {
  runStoryMotion(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runStoryMotion
};
