/**
 * AI Plan Validation — strict schema checking for AI-generated editing plans.
 * Never executes arbitrary commands — only translates to known internal operations.
 */
import { z } from "zod";
import { AIEditPlan, AIAction, Project } from "@/types/project";
import { generateId } from "./ids";

// ---------------------------------------------------------------------------
// Action schemas
// ---------------------------------------------------------------------------

const AddClipSchema = z.object({
  assetId: z.string().min(1),
  trackId: z.string().min(1),
  timelineStart: z.number().min(0),
});

const RemoveClipSchema = z.object({
  clipId: z.string().min(1),
});

const TrimClipSchema = z.object({
  clipId: z.string().min(1),
  edge: z.enum(["start", "end"]),
  newTime: z.number().min(0),
});

const MoveClipSchema = z.object({
  clipId: z.string().min(1),
  newStart: z.number().min(0),
});

const SplitClipSchema = z.object({
  clipId: z.string().min(1),
  splitTime: z.number().min(0),
});

const SetVolumeSchema = z.object({
  clipId: z.string().min(1),
  volume: z.number().min(0).max(2),
});

const AddCaptionSchema = z.object({
  text: z.string().min(1).max(500),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  language: z.string().default("en"),
});

const RemoveCaptionSchema = z.object({
  captionId: z.string().min(1),
});

const SetSpeedSchema = z.object({
  clipId: z.string().min(1),
  speed: z.number().min(0.1).max(10),
});

const AddTransitionSchema = z.object({
  fromClipId: z.string().min(1),
  toClipId: z.string().min(1),
  kind: z.enum(["fade", "dissolve", "wipe", "slide"]),
  duration: z.number().min(0.1).max(5),
});

const SetColorSchema = z.object({
  clipId: z.string().min(1),
  brightness: z.number().min(-100).max(100).optional(),
  contrast: z.number().min(-100).max(100).optional(),
  saturation: z.number().min(-100).max(100).optional(),
});

const AddTextSchema = z.object({
  trackId: z.string().min(1),
  text: z.string().min(1).max(500),
  timelineStart: z.number().min(0),
  timelineDuration: z.number().min(0.5),
});

const MuteTrackSchema = z.object({
  trackId: z.string().min(1),
  muted: z.boolean(),
});

const SetOpacitySchema = z.object({
  clipId: z.string().min(1),
  opacity: z.number().min(0).max(1),
});

const ReorderClipsSchema = z.object({
  clipIds: z.array(z.string().min(1)).optional(),
});

// ---------------------------------------------------------------------------
// AI Plan Schema
// ---------------------------------------------------------------------------

const AIActionSchema = z.object({
  kind: z.enum([
    "add_clip", "remove_clip", "trim_clip", "move_clip",
    "split_clip", "set_volume", "add_caption", "remove_caption",
    "set_speed", "add_transition", "set_color", "add_text",
    "mute_track", "reorder_clips", "set_opacity",
  ]),
  payload: z.record(z.string(), z.unknown()),
  description: z.string(),
});

const AIEditPlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  actions: z.array(AIActionSchema).max(100),
  estimatedDuration: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Validation entry point
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  errors: string[];
  plan?: AIEditPlan;
}

export function validateAIPlan(raw: unknown, project: Project): ValidationResult {
  const errors: string[] = [];

  // Parse outer structure
  const outerResult = AIEditPlanSchema.safeParse(raw);
  if (!outerResult.success) {
    return {
      valid: false,
      errors: outerResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const data = outerResult.data;

  // Build lookup maps for validation against actual project state
  const clipIds = new Set(project.clips.map((c) => c.id));
  const trackIds = new Set(project.tracks.map((t) => t.id));
  const assetIds = new Set(project.assets.map((a) => a.id));
  const captionIds = new Set(project.captions.map((c) => c.id));

  const validatedActions: AIAction[] = [];

  for (let i = 0; i < data.actions.length; i++) {
    const action = data.actions[i];
    const prefix = `Action ${i + 1} (${action.kind})`;

    try {
      switch (action.kind) {
        case "add_clip": {
          const r = AddClipSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!assetIds.has(r.data.assetId)) { errors.push(`${prefix}: Asset "${r.data.assetId}" not found`); break; }
          if (!trackIds.has(r.data.trackId)) { errors.push(`${prefix}: Track "${r.data.trackId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "remove_clip": {
          const r = RemoveClipSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "trim_clip": {
          const r = TrimClipSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "move_clip": {
          const r = MoveClipSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "split_clip": {
          const r = SplitClipSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "set_volume": {
          const r = SetVolumeSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "add_caption": {
          const r = AddCaptionSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (r.data.endTime <= r.data.startTime) { errors.push(`${prefix}: endTime must be > startTime`); break; }
          validatedActions.push(action);
          break;
        }
        case "remove_caption": {
          const r = RemoveCaptionSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!captionIds.has(r.data.captionId)) { errors.push(`${prefix}: Caption "${r.data.captionId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "set_speed": {
          const r = SetSpeedSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "add_transition": {
          const r = AddTransitionSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.fromClipId)) { errors.push(`${prefix}: fromClip not found`); break; }
          if (!clipIds.has(r.data.toClipId)) { errors.push(`${prefix}: toClip not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "set_color": {
          const r = SetColorSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "add_text": {
          const r = AddTextSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!trackIds.has(r.data.trackId)) { errors.push(`${prefix}: Track "${r.data.trackId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "mute_track": {
          const r = MuteTrackSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!trackIds.has(r.data.trackId)) { errors.push(`${prefix}: Track "${r.data.trackId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "set_opacity": {
          const r = SetOpacitySchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          if (!clipIds.has(r.data.clipId)) { errors.push(`${prefix}: Clip "${r.data.clipId}" not found`); break; }
          validatedActions.push(action);
          break;
        }
        case "reorder_clips": {
          const r = ReorderClipsSchema.safeParse(action.payload);
          if (!r.success) { errors.push(`${prefix}: ${r.error.message}`); break; }
          validatedActions.push(action);
          break;
        }
        default:
          errors.push(`${prefix}: Unknown action kind`);
      }
    } catch {
      errors.push(`${prefix}: Unexpected error during validation`);
    }
  }

  const plan: AIEditPlan = {
    id: generateId("plan"),
    title: data.title,
    description: data.description,
    actions: validatedActions,
    estimatedDuration: data.estimatedDuration,
    generatedAt: Date.now(),
    status: errors.length > 0 ? "failed" : "pending",
    validationErrors: errors.length > 0 ? errors : undefined,
  };

  return { valid: errors.length === 0, errors, plan };
}