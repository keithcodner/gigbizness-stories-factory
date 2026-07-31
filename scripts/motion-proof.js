const fs = require("fs");
const path = require("path");
const { parseCliArgs, writeJson } = require("./story_cli_lib");
const { runWorkflow } = require("./run_workflow");
const { apiJson, REPO_ROOT } = require("./lib");

function resolveProfilePath(options = {}) {
  if (options.profileFile) {
    return path.resolve(options.profileFile);
  }
  const profileName = String(options.profile || "gtx1080_preview");
  const normalized = profileName.endsWith(".json") ? profileName : `${profileName}.json`;
  return path.join(REPO_ROOT, "config", "motion_profiles", normalized);
}

function loadProfile(options = {}) {
  const profilePath = resolveProfilePath(options);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Motion profile not found: ${profilePath}`);
  }
  return {
    profilePath,
    profile: JSON.parse(fs.readFileSync(profilePath, "utf8"))
  };
}

async function discoverServer(candidates = []) {
  for (const baseUrl of candidates) {
    try {
      const stats = await apiJson(baseUrl, "/system_stats");
      if (stats?.system?.comfyui_version) {
        return baseUrl;
      }
    } catch (_error) {
      // try next server
    }
  }
  throw new Error("No available ComfyUI server matched the configured candidate URLs.");
}

async function runMotionProof(options = {}) {
  const { profilePath, profile } = loadProfile(options);
  const args = profile.recommended_args || {};
  const baseUrl = options.baseUrl || await discoverServer(profile.base_url_candidates || []);
  const inputPath = path.resolve(options.input || path.join(REPO_ROOT, "input", "test_story_template_source.png"));
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input image not found: ${inputPath}`);
  }

  const report = await runWorkflow({
    baseUrl,
    workflow: path.join(REPO_ROOT, profile.workflow_template),
    patch: path.join(REPO_ROOT, profile.patch_rules),
    input: inputPath,
    label: `${profile.profile_id}_${Date.now()}`,
    width: Number(options.width || args.width),
    height: Number(options.height || args.height),
    frames: Number(options.frames || args.frames),
    fps: Number(options.fps || args.fps),
    prompt: options.prompt,
    negativePrompt: options.negativePrompt,
    seed: options.seed,
    ipadapterWeight: options.ipadapterWeight,
    motionDenoise: options.motionDenoise,
    timeoutMs: Number(options.timeoutMs || args.timeout_ms || 900000),
    pollIntervalMs: Number(options.pollIntervalMs || args.poll_interval_ms || 5000)
  });

  const proofRecordPath = path.join(REPO_ROOT, "reports", "runtime", `${profile.profile_id}_proof.json`);
  writeJson(proofRecordPath, {
    generated_at: new Date().toISOString(),
    profile_path: profilePath,
    profile_id: profile.profile_id,
    base_url: baseUrl,
    input_path: inputPath,
    report
  });

  console.log(`Motion proof completed for profile '${profile.profile_id}'.`);
  console.log(`Proof record written to ${proofRecordPath}`);
  return {
    profilePath,
    profile,
    proofRecordPath,
    report
  };
}

if (require.main === module) {
  runMotionProof(parseCliArgs()).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  discoverServer,
  loadProfile,
  runMotionProof
};
