/**
 * Central application state using Zustand with Immer for immutable updates.
 * Handles the editor state, history, and coordinates side effects.
 */
"use client";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import {
  Project, Clip, Track, Caption, MediaAsset, AIEditPlan,
  ExportProgress, VideoClip, AudioClip, ImageClip,
  ID, Seconds, TrackKind, AIAction,
} from "@/types/project";
import {
  createProject, splitClip, trimClip, moveClip, deleteClip, duplicateClip,
  computeProjectDuration, createVideoClip, createAudioClip, createImageClip,
  createTextClip, createCaption, addTrack,
} from "@/lib/project-utils";
import { generateId } from "@/lib/ids";
import { saveProject as idbSave } from "@/lib/idb";

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

type HistorySnapshot = Pick<Project, "tracks" | "clips" | "captions" | "transitions" | "assets">;

interface HistoryRecord {
  description: string;
  snapshot: HistorySnapshot;
}

const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface EditorState {
  project: Project | null;
  /** Currently selected clip IDs */
  selectedClipIds: ID[];
  /** Selected caption ID */
  selectedCaptionId: ID | null;
  /** Playhead position in seconds */
  playheadPosition: Seconds;
  /** Is the preview playing */
  isPlaying: boolean;
  /** Timeline zoom (pixels per second) */
  timelineZoom: number;
  /** Timeline scroll position (seconds from left) */
  timelineScrollX: number;
  /** History for undo/redo */
  history: HistoryRecord[];
  historyIndex: number;
  /** Unsaved changes indicator */
  isDirty: boolean;
  /** Auto-save in progress */
  isSaving: boolean;
  /** AI Plans */
  aiPlans: AIEditPlan[];
  activeAIPlanId: ID | null;
  /** Export */
  exportProgress: ExportProgress;
  /** Panel visibility */
  panels: {
    mediaLibrary: boolean;
    inspector: boolean;
    aiAssistant: boolean;
  };
  /** Active view in left panel */
  leftPanelTab: "media" | "ai" | "effects";
}

export interface EditorActions {
  // Project
  createNewProject: (name: string) => void;
  loadProject: (project: Project) => void;
  updateProjectSettings: (settings: Partial<Project["settings"]>) => void;
  saveProject: () => Promise<void>;
  exportProject: () => Promise<void>;

  // History
  pushHistory: (description: string) => void;
  undo: () => void;
  redo: () => void;

  // Tracks
  addTrack: (kind: TrackKind, name: string) => void;
  deleteTrack: (trackId: ID) => void;
  updateTrack: (trackId: ID, updates: Partial<Track>) => void;

  // Clips
  addClip: (asset: MediaAsset, trackId: ID, timelineStart: Seconds) => void;
  addTextClip: (trackId: ID, timelineStart: Seconds) => void;
  deleteClip: (clipId: ID) => void;
  duplicateClip: (clipId: ID) => void;
  splitClipAtPlayhead: () => void;
  trimClip: (clipId: ID, edge: "start" | "end", newTime: Seconds) => void;
  moveClip: (clipId: ID, newStart: Seconds, newTrackId?: ID) => void;
  updateClip: (clipId: ID, updates: Partial<Clip>) => void;
  selectClip: (clipId: ID | null, addToSelection?: boolean) => void;

  // Captions
  addCaption: (text: string, start: Seconds, end: Seconds, lang?: string) => void;
  updateCaption: (captionId: ID, updates: Partial<Caption>) => void;
  deleteCaption: (captionId: ID) => void;
  selectCaption: (captionId: ID | null) => void;
  importCaptions: (captions: Caption[]) => void;

  // Assets
  addAsset: (asset: MediaAsset) => void;
  removeAsset: (assetId: ID) => void;

  // Playback
  setPlayheadPosition: (pos: Seconds) => void;
  setIsPlaying: (playing: boolean) => void;

  // Timeline
  setTimelineZoom: (zoom: number) => void;
  setTimelineScrollX: (x: Seconds) => void;

  // AI
  addAIPlan: (plan: AIEditPlan) => void;
  setActiveAIPlan: (planId: ID | null) => void;
  applyAIPlan: (planId: ID) => void;
  rejectAIPlan: (planId: ID) => void;

  // Export
  setExportProgress: (progress: Partial<ExportProgress>) => void;

  // UI
  togglePanel: (panel: keyof EditorState["panels"]) => void;
  setLeftPanelTab: (tab: EditorState["leftPanelTab"]) => void;
}

export type EditorStore = EditorState & EditorActions;

const INITIAL_EXPORT_PROGRESS: ExportProgress = {
  status: "idle", progress: 0, message: "",
};

// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

export const useEditorStore = create<EditorStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // --- State ---
      project: null,
      selectedClipIds: [],
      selectedCaptionId: null,
      playheadPosition: 0,
      isPlaying: false,
      timelineZoom: 80,
      timelineScrollX: 0,
      history: [],
      historyIndex: -1,
      isDirty: false,
      isSaving: false,
      aiPlans: [],
      activeAIPlanId: null,
      exportProgress: { ...INITIAL_EXPORT_PROGRESS },
      panels: { mediaLibrary: true, inspector: true, aiAssistant: false },
      leftPanelTab: "media",

      // --- Project ---

      createNewProject: (name) => {
        set((state) => {
          state.project = createProject(name);
          state.selectedClipIds = [];
          state.selectedCaptionId = null;
          state.playheadPosition = 0;
          state.history = [];
          state.historyIndex = -1;
          state.isDirty = false;
          state.aiPlans = [];
        });
      },

      loadProject: (project) => {
        set((state) => {
          state.project = project;
          state.selectedClipIds = [];
          state.selectedCaptionId = null;
          state.playheadPosition = 0;
          state.history = [];
          state.historyIndex = -1;
          state.isDirty = false;
          state.aiPlans = [];
        });
      },

      updateProjectSettings: (settings) => {
        set((state) => {
          if (!state.project) return;
          Object.assign(state.project.settings, settings);
          state.project.updatedAt = Date.now();
          state.isDirty = true;
        });
      },

      saveProject: async () => {
        const { project } = get();
        if (!project) return;
        set((s) => { s.isSaving = true; });
        try {
          // Compute and update duration before saving
          set((s) => {
            if (!s.project) return;
            s.project.settings.duration = computeProjectDuration(s.project.clips);
            s.project.updatedAt = Date.now();
          });
          await idbSave(get().project!);
          set((s) => { s.isDirty = false; s.isSaving = false; });
        } catch (e) {
          set((s) => { s.isSaving = false; });
          throw e;
        }
      },

      exportProject: async () => {
        // Handled by the export component
      },

      // --- History ---

      pushHistory: (description) => {
        const { project } = get();
        if (!project) return;
        const snapshot: HistorySnapshot = {
          tracks: JSON.parse(JSON.stringify(project.tracks)),
          clips: JSON.parse(JSON.stringify(project.clips)),
          captions: JSON.parse(JSON.stringify(project.captions)),
          transitions: JSON.parse(JSON.stringify(project.transitions)),
          assets: JSON.parse(JSON.stringify(project.assets)),
        };
        set((state) => {
          // Truncate redo history
          state.history = state.history.slice(0, state.historyIndex + 1);
          state.history.push({ description, snapshot });
          if (state.history.length > MAX_HISTORY) {
            state.history.shift();
          } else {
            state.historyIndex++;
          }
          state.isDirty = true;
        });
      },

      undo: () => {
        const { historyIndex, history, project } = get();
        if (historyIndex <= 0 || !project) return;
        const entry = history[historyIndex - 1];
        set((state) => {
          if (!state.project) return;
          state.project.tracks = JSON.parse(JSON.stringify(entry.snapshot.tracks));
          state.project.clips = JSON.parse(JSON.stringify(entry.snapshot.clips));
          state.project.captions = JSON.parse(JSON.stringify(entry.snapshot.captions));
          state.project.transitions = JSON.parse(JSON.stringify(entry.snapshot.transitions));
          state.project.assets = JSON.parse(JSON.stringify(entry.snapshot.assets));
          state.historyIndex--;
          state.selectedClipIds = [];
          state.isDirty = true;
        });
      },

      redo: () => {
        const { historyIndex, history, project } = get();
        if (historyIndex >= history.length - 1 || !project) return;
        const entry = history[historyIndex + 1];
        set((state) => {
          if (!state.project) return;
          state.project.tracks = JSON.parse(JSON.stringify(entry.snapshot.tracks));
          state.project.clips = JSON.parse(JSON.stringify(entry.snapshot.clips));
          state.project.captions = JSON.parse(JSON.stringify(entry.snapshot.captions));
          state.project.transitions = JSON.parse(JSON.stringify(entry.snapshot.transitions));
          state.project.assets = JSON.parse(JSON.stringify(entry.snapshot.assets));
          state.historyIndex++;
          state.isDirty = true;
        });
      },

      // --- Tracks ---

      addTrack: (kind, name) => {
        get().pushHistory(`Add track: ${name}`);
        set((state) => {
          if (!state.project) return;
          state.project = addTrack(state.project, kind, name);
        });
      },

      deleteTrack: (trackId) => {
        get().pushHistory("Delete track");
        set((state) => {
          if (!state.project) return;
          state.project.tracks = state.project.tracks.filter((t) => t.id !== trackId);
          state.project.clips = state.project.clips.filter((c) => c.trackId !== trackId);
          state.isDirty = true;
        });
      },

      updateTrack: (trackId, updates) => {
        set((state) => {
          if (!state.project) return;
          const track = state.project.tracks.find((t) => t.id === trackId);
          if (track) Object.assign(track, updates);
          state.isDirty = true;
        });
      },

      // --- Clips ---

      addClip: (asset, trackId, timelineStart) => {
        get().pushHistory(`Add ${asset.kind}: ${asset.name}`);
        set((state) => {
          if (!state.project) return;
          let clip: Clip;
          if (asset.kind === "video") {
            clip = createVideoClip(asset, trackId, timelineStart);
          } else if (asset.kind === "audio") {
            clip = createAudioClip(asset, trackId, timelineStart);
          } else {
            clip = createImageClip(asset, trackId, timelineStart);
          }
          state.project.clips.push(clip);
          state.project.settings.duration = computeProjectDuration(state.project.clips);
          state.selectedClipIds = [clip.id];
          state.playheadPosition = timelineStart;
          state.isDirty = true;
        });
      },

      addTextClip: (trackId, timelineStart) => {
        get().pushHistory("Add text");
        set((state) => {
          if (!state.project) return;
          const clip = createTextClip(trackId, timelineStart);
          state.project.clips.push(clip);
          state.isDirty = true;
        });
      },

      deleteClip: (clipId) => {
        get().pushHistory("Delete clip");
        set((state) => {
          if (!state.project) return;
          state.project.clips = deleteClip(state.project.clips, clipId);
          state.project.settings.duration = computeProjectDuration(state.project.clips);
          state.selectedClipIds = state.selectedClipIds.filter((id) => id !== clipId);
          state.isDirty = true;
        });
      },

      duplicateClip: (clipId) => {
        get().pushHistory("Duplicate clip");
        set((state) => {
          if (!state.project) return;
          state.project.clips = duplicateClip(state.project.clips, clipId);
          state.isDirty = true;
        });
      },

      splitClipAtPlayhead: () => {
        const { project, playheadPosition, selectedClipIds } = get();
        if (!project) return;
        const clipId = selectedClipIds[0];
        if (!clipId) return;
        get().pushHistory("Split clip");
        set((state) => {
          if (!state.project) return;
          state.project.clips = splitClip(state.project.clips, clipId, playheadPosition);
          state.isDirty = true;
        });
      },

      trimClip: (clipId, edge, newTime) => {
        get().pushHistory("Trim clip");
        set((state) => {
          if (!state.project) return;
          const idx = state.project.clips.findIndex((c) => c.id === clipId);
          if (idx === -1) return;
          state.project.clips[idx] = trimClip(state.project.clips[idx], edge, newTime);
          state.project.settings.duration = computeProjectDuration(state.project.clips);
          state.isDirty = true;
        });
      },

      moveClip: (clipId, newStart, newTrackId) => {
        set((state) => {
          if (!state.project) return;
          const idx = state.project.clips.findIndex((c) => c.id === clipId);
          if (idx === -1) return;
          state.project.clips[idx] = moveClip(state.project.clips[idx], newStart);
          if (newTrackId) {
            (state.project.clips[idx] as Clip).trackId = newTrackId;
          }
          state.project.settings.duration = computeProjectDuration(state.project.clips);
          state.isDirty = true;
        });
      },

      updateClip: (clipId, updates) => {
        set((state) => {
          if (!state.project) return;
          const idx = state.project.clips.findIndex((c) => c.id === clipId);
          if (idx === -1) return;
          Object.assign(state.project.clips[idx], updates);
          state.isDirty = true;
        });
      },

      selectClip: (clipId, addToSelection = false) => {
        set((state) => {
          if (!clipId) {
            state.selectedClipIds = [];
            return;
          }
          if (addToSelection) {
            if (state.selectedClipIds.includes(clipId)) {
              state.selectedClipIds = state.selectedClipIds.filter((id) => id !== clipId);
            } else {
              state.selectedClipIds.push(clipId);
            }
          } else {
            state.selectedClipIds = [clipId];
          }
        });
      },

      // --- Captions ---

      addCaption: (text, start, end, lang = "en") => {
        get().pushHistory("Add caption");
        set((state) => {
          if (!state.project) return;
          const cap = createCaption(text, start, end, lang);
          state.project.captions.push(cap);
          state.isDirty = true;
        });
      },

      updateCaption: (captionId, updates) => {
        set((state) => {
          if (!state.project) return;
          const cap = state.project.captions.find((c) => c.id === captionId);
          if (cap) Object.assign(cap, updates);
          state.isDirty = true;
        });
      },

      deleteCaption: (captionId) => {
        get().pushHistory("Delete caption");
        set((state) => {
          if (!state.project) return;
          state.project.captions = state.project.captions.filter((c) => c.id !== captionId);
          state.isDirty = true;
        });
      },

      selectCaption: (captionId) => {
        set((state) => { state.selectedCaptionId = captionId; });
      },

      importCaptions: (captions) => {
        get().pushHistory("Import captions");
        set((state) => {
          if (!state.project) return;
          state.project.captions.push(...captions);
          state.isDirty = true;
        });
      },

      // --- Assets ---

      addAsset: (asset) => {
        set((state) => {
          if (!state.project) return;
          state.project.assets.push(asset);
          state.isDirty = true;
        });
      },

      removeAsset: (assetId) => {
        set((state) => {
          if (!state.project) return;
          state.project.assets = state.project.assets.filter((a) => a.id !== assetId);
          // Remove clips using this asset
          state.project.clips = state.project.clips.filter((c) => {
            if (c.kind === "text") return true;
            return (c as VideoClip | AudioClip | ImageClip).assetId !== assetId;
          });
          state.isDirty = true;
        });
      },

      // --- Playback ---

      setPlayheadPosition: (pos) => {
        set((state) => { state.playheadPosition = Math.max(0, pos); });
      },

      setIsPlaying: (playing) => {
        set((state) => { state.isPlaying = playing; });
      },

      // --- Timeline ---

      setTimelineZoom: (zoom) => {
        set((state) => { state.timelineZoom = Math.max(10, Math.min(500, zoom)); });
      },

      setTimelineScrollX: (x) => {
        set((state) => { state.timelineScrollX = Math.max(0, x); });
      },

      // --- AI ---

      addAIPlan: (plan) => {
        set((state) => {
          state.aiPlans.push(plan);
          state.activeAIPlanId = plan.id;
        });
      },

      setActiveAIPlan: (planId) => {
        set((state) => { state.activeAIPlanId = planId; });
      },

      applyAIPlan: (planId) => {
        const { project, aiPlans } = get();
        if (!project) return;
        const plan = aiPlans.find((p) => p.id === planId);
        if (!plan || plan.status !== "pending") return;

        get().pushHistory(`Apply AI plan: ${plan.title}`);

        set((state) => {
          if (!state.project) return;
          const p = state.aiPlans.find((pl) => pl.id === planId);
          if (p) p.status = "applied";

          for (const action of plan.actions) {
            applyActionToProject(state.project!, action);
          }
          state.project.settings.duration = computeProjectDuration(state.project.clips);
          state.isDirty = true;
        });
      },

      rejectAIPlan: (planId) => {
        set((state) => {
          const p = state.aiPlans.find((pl) => pl.id === planId);
          if (p) p.status = "rejected";
        });
      },

      // --- Export ---

      setExportProgress: (progress) => {
        set((state) => { Object.assign(state.exportProgress, progress); });
      },

      // --- UI ---

      togglePanel: (panel) => {
        set((state) => { state.panels[panel] = !state.panels[panel]; });
      },

      setLeftPanelTab: (tab) => {
        set((state) => { state.leftPanelTab = tab; });
      },
    }))
  )
);

// ---------------------------------------------------------------------------
// Apply AI action to a project (mutates ï¿½ used inside immer set)
// ---------------------------------------------------------------------------

function applyActionToProject(project: Project, action: AIAction): void {
  const { kind, payload } = action;
  const p = payload as Record<string, unknown>;

  switch (kind) {
    case "remove_clip": {
      project.clips = project.clips.filter((c) => c.id !== p.clipId);
      break;
    }
    case "trim_clip": {
      const idx = project.clips.findIndex((c) => c.id === p.clipId);
      if (idx !== -1) {
        project.clips[idx] = trimClip(
          project.clips[idx],
          p.edge as "start" | "end",
          p.newTime as number,
        );
      }
      break;
    }
    case "move_clip": {
      const idx = project.clips.findIndex((c) => c.id === p.clipId);
      if (idx !== -1) {
        project.clips[idx] = moveClip(project.clips[idx], p.newStart as number);
      }
      break;
    }
    case "split_clip": {
      project.clips = splitClip(project.clips, p.clipId as string, p.splitTime as number);
      break;
    }
    case "set_volume": {
      const idx = project.clips.findIndex((c) => c.id === p.clipId);
      if (idx !== -1) {
        const clip = project.clips[idx];
        if (clip.kind === "video" || clip.kind === "audio") {
          (clip as VideoClip | AudioClip).audio.volume = p.volume as number;
        }
      }
      break;
    }
    case "add_caption": {
      const cap = createCaption(
        p.text as string,
        p.startTime as number,
        p.endTime as number,
        (p.language as string) || "en",
      );
      cap.aiGenerated = true;
      project.captions.push(cap);
      break;
    }
    case "remove_caption": {
      project.captions = project.captions.filter((c) => c.id !== p.captionId);
      break;
    }
    case "set_speed": {
      const idx = project.clips.findIndex((c) => c.id === p.clipId);
      if (idx !== -1) {
        project.clips[idx].speed = p.speed as number;
      }
      break;
    }
    case "add_transition": {
      project.transitions.push({
        id: generateId("trans"),
        fromClipId: p.fromClipId as string,
        toClipId: p.toClipId as string,
        kind: p.kind as "fade" | "dissolve" | "wipe" | "slide",
        duration: p.duration as number,
      });
      break;
    }
    case "set_color": {
      const idx = project.clips.findIndex((c) => c.id === p.clipId);
      if (idx !== -1 && project.clips[idx].kind === "video") {
        const clip = project.clips[idx] as VideoClip;
        if (p.brightness !== undefined) clip.color.brightness = p.brightness as number;
        if (p.contrast !== undefined) clip.color.contrast = p.contrast as number;
        if (p.saturation !== undefined) clip.color.saturation = p.saturation as number;
      }
      break;
    }
    case "add_text": {
      const text = createTextClip(p.trackId as string, p.timelineStart as number);
      text.text = p.text as string;
      text.timelineDuration = p.timelineDuration as number;
      project.clips.push(text);
      break;
    }
    case "mute_track": {
      const track = project.tracks.find((t) => t.id === p.trackId);
      if (track) track.muted = p.muted as boolean;
      break;
    }
    case "set_opacity": {
      const idx = project.clips.findIndex((c) => c.id === p.clipId);
      if (idx !== -1) {
        const clip = project.clips[idx];
        if (clip.kind === "video" || clip.kind === "image") {
          (clip as VideoClip | ImageClip).transform.opacity = p.opacity as number;
        }
      }
      break;
    }
    case "reorder_clips": {
      const order = p.clipIds as string[];
      if (Array.isArray(order) && order.length > 0) {
        project.clips.sort((a, b) => {
          const ia = order.indexOf(a.id);
          const ib = order.indexOf(b.id);
          if (ia === -1 || ib === -1) return 0;
          return ia - ib;
        });
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectProject = (s: EditorStore) => s.project;
export const selectClips = (s: EditorStore) => s.project?.clips ?? [];
export const selectTracks = (s: EditorStore) => s.project?.tracks ?? [];
export const selectCaptions = (s: EditorStore) => s.project?.captions ?? [];
export const selectAssets = (s: EditorStore) => s.project?.assets ?? [];
export const selectSelectedClipIds = (s: EditorStore) => s.selectedClipIds;
export const selectPlayheadPosition = (s: EditorStore) => s.playheadPosition;
export const selectIsPlaying = (s: EditorStore) => s.isPlaying;
export const selectTimelineZoom = (s: EditorStore) => s.timelineZoom;
export const selectAIPlans = (s: EditorStore) => s.aiPlans;
export const selectExportProgress = (s: EditorStore) => s.exportProgress;

