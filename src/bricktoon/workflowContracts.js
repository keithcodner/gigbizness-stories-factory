const fs = require("fs");
const path = require("path");
const { repoRoot } = require("../paths");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadVisualGenerationConfig() {
  const patchRulesPath = path.join(repoRoot, "config", "wan_i2v_patch_rules.json");
  const patchRules = fs.existsSync(patchRulesPath) ? readJson(patchRulesPath) : {};
  return {
    default_image_provider: process.env.BRICKTOON_IMAGE_PROVIDER || "comfyui",
    comfyui: {
      base_url: process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188",
      timeout_ms: Number(process.env.COMFYUI_TIMEOUT_MS || 240000),
      poll_interval_ms: Number(process.env.COMFYUI_POLL_INTERVAL_MS || 2000),
      strict: String(process.env.COMFYUI_STRICT || "0") === "1"
    },
    story_render_profiles: {
      gtx1080_preview_safe: {
        output: {
          width: 1280,
          height: 720
        },
        quality_tier_overrides: {
          hero: "hero",
          standard: "standard",
          utility: "utility"
        },
        shot_class_workflows: {}
      }
    },
    workflows: {
      shot_keyframe: {
        hybrid_character_closeup_v1: { workflow_id: "hybrid_character_closeup_v1" },
        hybrid_character_dialogue_v1: { workflow_id: "hybrid_character_dialogue_v1" },
        hybrid_document_insert_v1: { workflow_id: "hybrid_document_insert_v1" },
        hybrid_establishing_v1: { workflow_id: "hybrid_establishing_v1" }
      },
      character_reference: {
        default: { workflow_id: "character_reference_default_v1" }
      }
    },
    patch_rules: patchRules
  };
}

function resolveWorkflowTemplate(config, kind, options = {}) {
  const width = Number(options.width || (kind === "character_reference" ? 1024 : 1280));
  const height = Number(options.height || (kind === "character_reference" ? 1024 : 720));
  const workflowId = options.workflowId || options.workflow_id || (kind === "character_reference" ? "character_reference_default_v1" : "hybrid_establishing_v1");
  return {
    workflow_id: workflowId,
    kind,
    provider: options.providerName || config.default_image_provider || "comfyui",
    output: {
      width,
      height,
      aspect_ratio: `${width}:${height}`
    },
    pass_plan: [
      {
        id: "primary",
        label: "Primary render pass"
      }
    ]
  };
}

function buildExecutionResult(request, details = {}) {
  return {
    request_id: request.request_id,
    provider: request.provider,
    workflow_template_id: request.workflow_template_id,
    quality_tier: request.quality_tier,
    output_contract: request.output_contract,
    pass_plan: request.pass_plan || [],
    status: details.status || "completed",
    prompt_id: details.promptId || null,
    pass_results: details.passResults || [],
    metrics: details.metrics || {},
    created_at: new Date().toISOString()
  };
}

function inferMotionRecipe(shot, context = {}) {
  const shotType = String(shot.shot_type || context.shot_type || "establishing_wide");
  if (shotType === "document_insert") {
    return "still_plus_overlay";
  }
  if (shotType === "closeup_face" || context.mouth_sync_mode === "viseme_emphasis") {
    return "cutout_rig_primary";
  }
  return "camera_move_primary";
}

module.exports = {
  buildExecutionResult,
  inferMotionRecipe,
  loadVisualGenerationConfig,
  resolveWorkflowTemplate
};
