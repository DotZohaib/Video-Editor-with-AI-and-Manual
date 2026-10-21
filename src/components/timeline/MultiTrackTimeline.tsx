"use client";
import React, { useRef, useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Plus,
  Film,
  Music,
  Type,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { formatTime, snapToNearestBoundary } from "@/lib/project-utils";
import { Clip, TrackKind, Track } from "@/types/project";

const EMPTY_CLIPS: Clip[] = [];
const EMPTY_TRACKS: Track[] = [];

export function MultiTrackTimeline() {
  const project = useEditorStore((s) => s.project);
  const playheadPosition = useEditorStore((s) => s.playheadPosition);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);

  const setPlayheadPosition = useEditorStore((s) => s.setPlayheadPosition);
  const selectClip = useEditorStore((s) => s.selectClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const trimClip = useEditorStore((s) => s.trimClip);
  const deleteClip = useEditorStore((s) => s.deleteClip);
  const splitClipAtPlayhead = useEditorStore((s) => s.splitClipAtPlayhead);
  const addTrack = useEditorStore((s) => s.addTrack);
  const updateTrack = useEditorStore((s) => s.updateTrack);

  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "trim-start" | "trim-end" | "scrub";
    clipId?: string;
    startX: number;
    initialTimelineStart?: number;
    initialDuration?: number;
  } | null>(null);

  const tracks = project?.tracks ?? EMPTY_TRACKS;
  const clips = project?.clips ?? EMPTY_CLIPS;
  const settings = project?.settings;
  const projectDuration = Math.max(settings?.duration ?? 0, 10);
  const timelineWidthPx = Math.max(projectDuration * timelineZoom + 400, 1200);

  // Ruler tick interval calculation based on zoom
  let tickInterval = 1; // seconds
  if (timelineZoom < 25) tickInterval = 10;
  else if (timelineZoom < 50) tickInterval = 5;
  else if (timelineZoom < 100) tickInterval = 2;
  else if (timelineZoom >= 200) tickInterval = 0.5;

  const totalTicks = Math.ceil(projectDuration / tickInterval) + 5;

  // Handle Playhead Scrubbing on Ruler
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetSec = Math.max(0, clickX / timelineZoom);
    setPlayheadPosition(targetSec);

    setDragState({
      type: "scrub",
      startX: e.clientX,
    });
  };

  // Drag listeners
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaSec = deltaX / timelineZoom;

      if (dragState.type === "scrub" && tracksContainerRef.current) {
        const rect = tracksContainerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        setPlayheadPosition(Math.max(0, clickX / timelineZoom));
      } else if (dragState.type === "move" && dragState.clipId && dragState.initialTimelineStart !== undefined) {
        let newStart = Math.max(0, dragState.initialTimelineStart + deltaSec);
        newStart = snapToNearestBoundary(newStart, clips, dragState.clipId);
        moveClip(dragState.clipId, newStart);
      } else if (dragState.type === "trim-start" && dragState.clipId && dragState.initialTimelineStart !== undefined) {
        const newStart = Math.max(0, dragState.initialTimelineStart + deltaSec);
        trimClip(dragState.clipId, "start", newStart);
      } else if (
        dragState.type === "trim-end" &&
        dragState.clipId &&
        dragState.initialTimelineStart !== undefined &&
        dragState.initialDuration !== undefined
      ) {
        const newEnd = Math.max(
          dragState.initialTimelineStart + 0.2,
          dragState.initialTimelineStart + dragState.initialDuration + deltaSec
        );
        trimClip(dragState.clipId, "end", newEnd);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, timelineZoom, clips, moveClip, setPlayheadPosition, trimClip]);

  // Keyboard shortcut listeners (Space, Del, S, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        useEditorStore.getState().setIsPlaying(!useEditorStore.getState().isPlaying);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const selectedId = useEditorStore.getState().selectedClipIds[0];
        if (selectedId) {
          e.preventDefault();
          deleteClip(selectedId);
        }
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.getState().redo();
        } else {
          useEditorStore.getState().undo();
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteClip, splitClipAtPlayhead]);

  if (!project) return null;

  const getTrackIcon = (kind: TrackKind) => {
    switch (kind) {
      case "video":
        return <Film className="w-3.5 h-3.5 text-blue-400" />;
      case "audio":
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
      case "text":
        return <Type className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const getClipBgColor = (kind: Clip["kind"], isSelected: boolean) => {
    if (isSelected) return "bg-blue-600/90 border-blue-300 ring-2 ring-blue-400";
    switch (kind) {
      case "video":
        return "bg-blue-900/60 border-blue-600/60 hover:bg-blue-800/70";
      case "audio":
        return "bg-emerald-900/60 border-emerald-600/60 hover:bg-emerald-800/70";
      case "image":
        return "bg-amber-900/60 border-amber-600/60 hover:bg-amber-800/70";
      case "text":
        return "bg-purple-900/60 border-purple-600/60 hover:bg-purple-800/70";
    }
  };

  return (
    <div className="h-60 md:h-64 bg-zinc-950 border-t border-zinc-800 flex flex-col select-none relative shrink-0">
      {/* Timeline Controls Sub-header */}
      <div className="h-9 bg-zinc-900/90 border-b border-zinc-800 px-3 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="font-semibold text-zinc-300 text-xs">Tracks</span>
          <button
            onClick={() => addTrack("video", `Video ${tracks.length + 1}`)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Video Track</span>
            <span className="sm:hidden">Video</span>
          </button>
          <button
            onClick={() => addTrack("audio", `Audio ${tracks.length + 1}`)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Audio Track</span>
            <span className="sm:hidden">Audio</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500">
          <span>Space: Play/Pause</span>
          <span>&bull;</span>
          <span>S: Split</span>
          <span>&bull;</span>
          <span>Del: Delete</span>
        </div>
      </div>

      {/* Main Timeline Workspace: Left Track Headers + Right Track Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers Column (Fixed on left) */}
        <div className="w-36 md:w-48 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 z-10">
          {/* Header spacer for ruler */}
          <div className="h-7 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center px-3 text-[10px] font-mono text-zinc-500">
            TIMELINE
          </div>

          {/* Tracks list */}
          <div className="flex-1 overflow-y-hidden">
            {tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: `${track.height}px` }}
                className="border-b border-zinc-800/80 px-2 md:px-2.5 flex items-center justify-between text-xs bg-zinc-900/30"
              >
                <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                  {getTrackIcon(track.kind)}
                  <span className="font-medium text-zinc-300 truncate text-[11px]">
                    {track.name}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 md:gap-1 text-zinc-500">
                  <button
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                    className={`p-1 rounded hover:text-white transition ${
                      track.muted ? "text-red-400" : ""
                    }`}
                    title={track.muted ? "Unmute track" : "Mute track"}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>

                  <button
                    onClick={() => updateTrack(track.id, { locked: !track.locked })}
                    className={`p-1 rounded hover:text-white transition ${
                      track.locked ? "text-amber-400" : ""
                    }`}
                    title={track.locked ? "Unlock track" : "Lock track"}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>

                  <button
                    onClick={() => updateTrack(track.id, { visible: !track.visible })}
                    className={`p-1 rounded hover:text-white transition ${
                      !track.visible ? "text-zinc-600" : ""
                    }`}
                    title={track.visible ? "Hide track" : "Show track"}
                  >
                    {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Timeline Area (Ruler + Track Lanes) */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative bg-zinc-950" ref={tracksContainerRef}>
          <div style={{ width: `${timelineWidthPx}px` }} className="relative h-full flex flex-col">
            {/* Ruler */}
            <div
              onMouseDown={handleRulerMouseDown}
              className="h-7 border-b border-zinc-800/80 bg-zinc-900/40 relative cursor-pointer flex items-end select-none shrink-0"
            >
              {Array.from({ length: totalTicks }).map((_, i) => {
                const sec = i * tickInterval;
                const leftPx = sec * timelineZoom;
                return (
                  <div
                    key={i}
                    style={{ left: `${leftPx}px` }}
                    className="absolute bottom-0 flex flex-col items-start pointer-events-none"
                  >
                    <span className="text-[9px] font-mono text-zinc-500 pl-1 -translate-y-2">
                      {formatTime(sec)}
                    </span>
                    <div className="w-px h-2 bg-zinc-700" />
                  </div>
                );
              })}
            </div>

            {/* Track Lanes */}
            <div className="flex-1 relative">
              {tracks.map((track) => {
                const trackClips = clips.filter((c) => c.trackId === track.id);

                return (
                  <div
                    key={track.id}
                    style={{ height: `${track.height}px` }}
                    className={`border-b border-zinc-800/80 relative transition-opacity ${
                      !track.visible ? "opacity-30" : "opacity-100"
                    }`}
                    onClick={() => selectClip(null)}
                  >
                    {trackClips.map((clip) => {
                      const isSelected = selectedClipIds.includes(clip.id);
                      const leftPx = clip.timelineStart * timelineZoom;
                      const widthPx = Math.max(clip.timelineDuration * timelineZoom, 8);

                      return (
                        <div
                          key={clip.id}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            top: "4px",
                            bottom: "4px",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectClip(clip.id, e.shiftKey);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            // Don't drag if track is locked
                            if (track.locked) return;
                            selectClip(clip.id);
                            setDragState({
                              type: "move",
                              clipId: clip.id,
                              startX: e.clientX,
                              initialTimelineStart: clip.timelineStart,
                            });
                          }}
                          className={`absolute rounded-md border text-zinc-100 cursor-move flex items-center justify-between overflow-hidden shadow-sm transition-colors ${getClipBgColor(
                            clip.kind,
                            isSelected
                          )} ${track.locked ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (track.locked) return;
                              selectClip(clip.id);
                              setDragState({
                                type: "trim-start",
                                clipId: clip.id,
                                startX: e.clientX,
                                initialTimelineStart: clip.timelineStart,
                                initialDuration: clip.timelineDuration,
                              });
                            }}
                            className="w-2.5 h-full cursor-w-resize bg-black/20 hover:bg-white/40 transition shrink-0"
                            title="Trim Start"
                          />

                          {/* Clip Body Content */}
                          <div className="flex-1 px-1.5 flex items-center gap-1.5 min-w-0 pointer-events-none">
                            <span className="text-[11px] font-medium truncate">
                              {clip.label || `${clip.kind.toUpperCase()}`}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                              {clip.timelineDuration.toFixed(1)}s
                            </span>
                          </div>

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (track.locked) return;
                              selectClip(clip.id);
                              setDragState({
                                type: "trim-end",
                                clipId: clip.id,
                                startX: e.clientX,
                                initialTimelineStart: clip.timelineStart,
                                initialDuration: clip.timelineDuration,
                              });
                            }}
                            className="w-2.5 h-full cursor-e-resize bg-black/20 hover:bg-white/40 transition shrink-0"
                            title="Trim End"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Playhead Vertical Line & Head */}
              <div
                style={{ left: `${playheadPosition * timelineZoom}px` }}
                className="absolute top-0 bottom-0 pointer-events-none z-30"
              >
                {/* Playhead marker needle */}
                <div className="w-3.5 h-3.5 -ml-[7px] -mt-3.5 bg-red-500 rotate-45 rounded-sm shadow-md pointer-events-auto cursor-grab" />
                <div className="w-0.5 h-full bg-red-500 -ml-[1px] shadow-sm shadow-red-500/50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
