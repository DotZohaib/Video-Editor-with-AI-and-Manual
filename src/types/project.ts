/**
 * Core project type definitions for AI Video Studio.
 * This is the canonical data model � all state derives from these types.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Seconds (floating-point) used throughout the project */
export type Seconds = number;

/** RGBA colour as a hex string e.g. "#FF0000FF" */
export type HexColor = string;

/** Unique identifier */
export type ID = string;

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export type MediaKind = "video" | "audio" | "image" | "subtitle";

export interface MediaMeta {
  duration?: Seconds;
  width?: number;
  height?: number;
  frameRate?: number;
  audioChannels?: number;
  audioSampleRate?: number;
  codec?: string;
  audioCodec?: string;
  bitrate?: number;
  size: number;
}

export interface MediaAsset {
  id: ID;
  name: string;
  kind: MediaKind;
  idbKey: string;
  originalName: string;
  mimeType: string;
  thumbnailDataUrl?: string;
  waveformPeaks?: number[];
  meta: MediaMeta;
  importedAt: number;
  missing?: boolean;
}

// ---------------------------------------------------------------------------
// Effects and Transforms
// ---------------------------------------------------------------------------

export interface ClipTransform {
  opacity: number;
  rotation: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  scale: number;
  positionX: number;
  positionY: number;
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_TRANSFORM: ClipTransform = {
  opacity: 1, rotation: 0,
  cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
  scale: 1, positionX: 0, positionY: 0, flipH: false, flipV: false,
};

export interface AudioSettings {
  volume: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
}

export const DEFAULT_AUDIO: AudioSettings = {
  volume: 1, muted: false, fadeIn: 0, fadeOut: 0,
};

export interface ColorAdjustment {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  temperature: number;
}

export const DEFAULT_COLOR: ColorAdjustment = {
  brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0,
};

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: HexColor;
  backgroundColor: HexColor;
  outlineColor: HexColor;
  outlineWidth: number;
  bold: boolean;
  italic: boolean;
  alignment: "left" | "center" | "right";
  verticalPosition: "top" | "middle" | "bottom";
  marginX: number;
  marginY: number;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Inter, sans-serif", fontSize: 24,
  color: "#FFFFFF", backgroundColor: "#00000080",
  outlineColor: "#000000", outlineWidth: 1,
  bold: false, italic: false, alignment: "center",
  verticalPosition: "bottom", marginX: 20, marginY: 40,
};

export interface Caption {
  id: ID;
  startTime: Seconds;
  endTime: Seconds;
  text: string;
  language: string;
  style: CaptionStyle;
  aiGenerated?: boolean;
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export type ClipKind = "video" | "audio" | "image" | "text";

export interface BaseClip {
  id: ID;
  kind: ClipKind;
  trackId: ID;
  timelineStart: Seconds;
  timelineDuration: Seconds;
  speed: number;
  label?: string;
}

export interface VideoClip extends BaseClip {
  kind: "video";
  assetId: ID;
  sourceStart: Seconds;
  sourceEnd: Seconds;
  transform: ClipTransform;
  audio: AudioSettings;
  color: ColorAdjustment;
  thumbnail?: string;
}

export interface AudioClip extends BaseClip {
  kind: "audio";
  assetId: ID;
  sourceStart: Seconds;
  sourceEnd: Seconds;
  audio: AudioSettings;
}

export interface ImageClip extends BaseClip {
  kind: "image";
  assetId: ID;
  transform: ClipTransform;
}

export interface TextClip extends BaseClip {
  kind: "text";
  text: string;
  style: CaptionStyle;
  transform: ClipTransform;
  entranceAnimation?: "none" | "fadeIn" | "slideIn" | "typewriter";
  exitAnimation?: "none" | "fadeOut" | "slideOut";
}

export type Clip = VideoClip | AudioClip | ImageClip | TextClip;

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export type TrackKind = "video" | "audio" | "text";

export interface Track {
  id: ID;
  kind: TrackKind;
  name: string;
  order: number;
  locked: boolean;
  visible: boolean;
  muted: boolean;
  solo: boolean;
  height: number;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type TransitionKind = "none" | "fade" | "dissolve" | "wipe" | "slide";

export interface Transition {
  id: ID;
  fromClipId: ID;
  toClipId: ID;
  kind: TransitionKind;
  duration: Seconds;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface ProjectSettings {
  name: string;
  frameRate: number;
  width: number;
  height: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "custom";
  backgroundColor: HexColor;
  duration: Seconds;
}

export interface ExportSettings {
  fileName: string;
  resolution: "720p" | "1080p" | "4K" | "custom";
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: string;
  audioBitrate: string;
  videoCodec: "h264" | "h265" | "vp9" | "vp8";
  audioCodec: "aac" | "mp3" | "opus";
  format: "mp4" | "webm" | "mov";
  includeSubtitles: boolean;
  burnSubtitles: boolean;
  quality: "low" | "medium" | "high" | "lossless";
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  fileName: "export", resolution: "1080p",
  width: 1920, height: 1080, frameRate: 30,
  videoBitrate: "8M", audioBitrate: "192k",
  videoCodec: "h264", audioCodec: "aac",
  format: "mp4", includeSubtitles: true, burnSubtitles: true, quality: "high",
};

export const PROJECT_SCHEMA_VERSION = 1;

export interface Project {
  id: ID;
  schemaVersion: number;
  settings: ProjectSettings;
  tracks: Track[];
  clips: Clip[];
  captions: Caption[];
  transitions: Transition[];
  assets: MediaAsset[];
  exportSettings: ExportSettings;
  createdAt: number;
  updatedAt: number;
  thumbnailDataUrl?: string;
}

export interface HistoryEntry {
  description: string;
  snapshot: Pick<Project, "tracks" | "clips" | "captions" | "transitions" | "assets">;
}

// ---------------------------------------------------------------------------
// AI Plans
// ---------------------------------------------------------------------------

export type AIActionKind =
  | "add_clip" | "remove_clip" | "trim_clip" | "move_clip"
  | "split_clip" | "set_volume" | "add_caption" | "remove_caption"
  | "set_speed" | "add_transition" | "set_color" | "add_text"
  | "mute_track" | "reorder_clips" | "set_opacity";

export interface AIAction {
  kind: AIActionKind;
  payload: Record<string, unknown>;
  description: string;
}

export interface AIEditPlan {
  id: ID;
  title: string;
  description: string;
  actions: AIAction[];
  estimatedDuration?: Seconds;
  generatedAt: number;
  status: "pending" | "approved" | "rejected" | "applied" | "failed";
  validationErrors?: string[];
}

// ---------------------------------------------------------------------------
// Export Progress
// ---------------------------------------------------------------------------

export interface ExportProgress {
  status: "idle" | "preparing" | "processing" | "encoding" | "done" | "error" | "cancelled";
  progress: number;
  message: string;
  outputUrl?: string;
  outputSize?: number;
  error?: string;
}
