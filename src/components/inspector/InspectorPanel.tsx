"use client";
import React from "react";
import { useEditorStore } from "@/store/editor-store";
import { formatTime } from "@/lib/time";
import { VideoClip, TextClip } from "@/types/project";
import {
  Sliders,
  Sun,
  Volume2,
  Maximize2,
  Copy,
  Trash2,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";

export function InspectorPanel() {
  const project = useEditorStore((s) => s.project);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const selectedCaptionId = useEditorStore((s) => s.selectedCaptionId);

  const updateClip = useEditorStore((s) => s.updateClip);
  const deleteClip = useEditorStore((s) => s.deleteClip);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const updateCaption = useEditorStore((s) => s.updateCaption);
  const deleteCaption = useEditorStore((s) => s.deleteCaption);

  if (!project) return null;

  const selectedClipId = selectedClipIds[0];
  const selectedClip = project.clips.find((c) => c.id === selectedClipId);
  const selectedCaption = project.captions.find((c) => c.id === selectedCaptionId);

  // If a caption is selected
  if (selectedCaption) {
    return (
      <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 text-zinc-200 text-xs p-4 gap-4 overflow-y-auto select-none">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-sm text-zinc-100">Caption Inspector</span>
          </div>
          <button
            onClick={() => deleteCaption(selectedCaption.id)}
            className="text-zinc-500 hover:text-red-400 transition"
            title="Delete Caption"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Caption text */}
        <div className="space-y-1.5">
          <label className="text-zinc-400 font-medium">Text Content</label>
          <textarea
            rows={3}
            value={selectedCaption.text}
            onChange={(e) => updateCaption(selectedCaption.id, { text: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-zinc-400">Start Time (s)</label>
            <input
              type="number"
              step="0.1"
              value={selectedCaption.startTime}
              onChange={(e) =>
                updateCaption(selectedCaption.id, { startTime: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-400">End Time (s)</label>
            <input
              type="number"
              step="0.1"
              value={selectedCaption.endTime}
              onChange={(e) =>
                updateCaption(selectedCaption.id, { endTime: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-100"
            />
          </div>
        </div>

        {/* Styling */}
        <div className="space-y-2 border-t border-zinc-800 pt-3">
          <label className="text-zinc-400 font-medium">Font Size</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={12}
              max={48}
              value={selectedCaption.style.fontSize}
              onChange={(e) =>
                updateCaption(selectedCaption.id, {
                  style: { ...selectedCaption.style, fontSize: parseInt(e.target.value) },
                })
              }
              className="flex-1 accent-blue-500"
            />
            <span className="w-8 font-mono">{selectedCaption.style.fontSize}px</span>
          </div>
        </div>
      </div>
    );
  }

  // If a clip is selected
  if (selectedClip) {
    const isVideo = selectedClip.kind === "video";
    const isAudio = selectedClip.kind === "audio" || isVideo;
    const isText = selectedClip.kind === "text";
    const isVisual = isVideo || selectedClip.kind === "image" || isText;

    const vClip = selectedClip as VideoClip;
    const tClip = selectedClip as TextClip;

    return (
      <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 text-zinc-200 text-xs p-4 gap-4 overflow-y-auto select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-zinc-100 truncate">
              {selectedClip.label || `${selectedClip.kind.toUpperCase()} Clip`}
            </h4>
            <p className="text-[10px] text-zinc-500 uppercase mt-0.5">
              {selectedClip.kind} • {formatTime(selectedClip.timelineDuration)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => duplicateClip(selectedClip.id)}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
              title="Duplicate Clip"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteClip(selectedClip.id)}
              className="p-1.5 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
              title="Delete Clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Text Editor (if text clip) */}
        {isText && (
          <div className="space-y-2 border-b border-zinc-800 pb-3">
            <label className="text-zinc-400 font-medium">Text Content</label>
            <input
              type="text"
              value={tClip.text}
              onChange={(e) => updateClip(selectedClip.id, { text: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Timing & Speed */}
        <div className="space-y-2 border-b border-zinc-800 pb-3">
          <label className="text-zinc-400 font-medium flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Playback Speed</span>
          </label>
          <div className="flex gap-1.5">
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => updateClip(selectedClip.id, { speed: s })}
                className={`flex-1 py-1 rounded text-xs transition ${
                  selectedClip.speed === s
                    ? "bg-blue-600 text-white font-medium"
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Visual Transform (Opacity & Scale) */}
        {isVisual && (
          <div className="space-y-3 border-b border-zinc-800 pb-3">
            <label className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Transform & Opacity</span>
            </label>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Opacity</span>
                <span>{Math.round((vClip.transform?.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vClip.transform?.opacity ?? 1}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    transform: {
                      ...vClip.transform,
                      opacity: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Scale</span>
                <span>{Math.round((vClip.transform?.scale ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={vClip.transform?.scale ?? 1}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    transform: {
                      ...vClip.transform,
                      scale: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}

        {/* Audio controls */}
        {isAudio && (
          <div className="space-y-3 border-b border-zinc-800 pb-3">
            <label className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Audio Controls</span>
            </label>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Volume</span>
                <span>{Math.round(((vClip as VideoClip).audio?.volume ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={(vClip as VideoClip).audio?.volume ?? 1}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    audio: {
                      ...(vClip as VideoClip).audio,
                      volume: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Mute Clip</span>
              <input
                type="checkbox"
                checked={(vClip as VideoClip).audio?.muted ?? false}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    audio: {
                      ...(vClip as VideoClip).audio,
                      muted: e.target.checked,
                    },
                  })
                }
                className="accent-blue-500 rounded"
              />
            </div>
          </div>
        )}

        {/* Color Grading (Video clips) */}
        {isVideo && (
          <div className="space-y-3">
            <label className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Color Grading</span>
            </label>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Brightness</span>
                <span>{vClip.color.brightness}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={vClip.color.brightness}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    color: { ...vClip.color, brightness: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Contrast</span>
                <span>{vClip.color.contrast}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={vClip.color.contrast}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    color: { ...vClip.color, contrast: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Saturation</span>
                <span>{vClip.color.saturation}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={vClip.color.saturation}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    color: { ...vClip.color, saturation: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // No selection - Show project properties
  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 text-zinc-200 text-xs p-4 gap-4 overflow-y-auto select-none">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Info className="w-4 h-4 text-blue-400" />
        <h4 className="font-semibold text-sm text-zinc-100">Project Overview</h4>
      </div>

      <div className="space-y-3">
        <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 space-y-2">
          <div className="flex justify-between text-zinc-400">
            <span>Resolution</span>
            <span className="font-mono text-zinc-200">
              {project.settings.width} × {project.settings.height}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Aspect Ratio</span>
            <span className="font-semibold text-blue-400">{project.settings.aspectRatio}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Frame Rate</span>
            <span className="font-mono text-zinc-200">{project.settings.frameRate} fps</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Duration</span>
            <span className="font-mono text-zinc-200">
              {formatTime(project.settings.duration)}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-zinc-300 font-medium mb-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Timeline Stats</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Tracks</span>
            <span className="font-mono text-zinc-200">{project.tracks.length}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Total Clips</span>
            <span className="font-mono text-zinc-200">{project.clips.length}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Captions</span>
            <span className="font-mono text-zinc-200">{project.captions.length}</span>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 italic text-center px-2">
          Select any clip or subtitle on the timeline to inspect and edit its properties.
        </p>
      </div>
    </div>
  );
}