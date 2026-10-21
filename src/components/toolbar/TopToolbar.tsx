"use client";
import React, { useState, useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui";
import {
  Sparkles,
  Undo2,
  Redo2,
  Scissors,
  Download,
  ZoomIn,
  ZoomOut,
  Save,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Ratio,
} from "lucide-react";

interface TopToolbarProps {
  onBackToDashboard: () => void;
  onOpenExport: () => void;
}

export function TopToolbar({ onBackToDashboard, onOpenExport }: TopToolbarProps) {
  const project = useEditorStore((s) => s.project);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const history = useEditorStore((s) => s.history);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const panels = useEditorStore((s) => s.panels);

  const updateProjectSettings = useEditorStore((s) => s.updateProjectSettings);
  const saveProject = useEditorStore((s) => s.saveProject);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const splitClipAtPlayhead = useEditorStore((s) => s.splitClipAtPlayhead);
  const togglePanel = useEditorStore((s) => s.togglePanel);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(project?.settings.name || "Untitled Project");

  // Sync titleInput when the project name changes externally (was unconditionally called before — BUG FIX)
  useEffect(() => {
    if (project?.settings.name) {
      setTitleInput(project.settings.name);
    }
  }, [project?.settings.name]);

  if (!project) return null;

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  const hasSelectedClip = selectedClipIds.length > 0;

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      updateProjectSettings({ name: titleInput.trim() });
    } else {
      setTitleInput(project.settings.name);
    }
  };

  const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ratio = e.target.value as "16:9" | "9:16" | "1:1" | "4:3";
    let width = 1920;
    let height = 1080;
    if (ratio === "9:16") {
      width = 1080;
      height = 1920;
    } else if (ratio === "1:1") {
      width = 1080;
      height = 1080;
    } else if (ratio === "4:3") {
      width = 1440;
      height = 1080;
    }
    updateProjectSettings({ aspectRatio: ratio, width, height });
  };

  return (
    <header className="h-14 bg-zinc-950 border-b border-zinc-800 px-3 md:px-4 flex items-center justify-between select-none z-20 shrink-0">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToDashboard}
          className="text-zinc-400 hover:text-white gap-1 pl-1"
          title="Back to Projects"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-semibold tracking-wide uppercase text-zinc-400">
            Studio
          </span>
        </Button>

        <div className="h-4 w-px bg-zinc-800" />

        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
            autoFocus
            className="bg-zinc-800 border border-blue-500 rounded px-2 py-0.5 text-xs md:text-sm text-white focus:outline-none w-32 md:w-48 font-medium"
          />
        ) : (
          <div
            onClick={() => {
              setTitleInput(project.settings.name);
              setIsEditingTitle(true);
            }}
            className="flex items-center gap-1.5 cursor-pointer hover:bg-zinc-900 px-2 py-1 rounded transition group max-w-[140px] md:max-w-[220px]"
            title="Click to rename project"
          >
            <span className="text-xs md:text-sm font-semibold text-zinc-100 group-hover:text-blue-400 transition truncate">
              {project.settings.name}
            </span>
            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">✎</span>
          </div>
        )}

        {/* Save Status Indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {isSaving ? (
            <span className="flex items-center gap-1 text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline">Saving...</span>
            </span>
          ) : isDirty ? (
            <button
              onClick={() => saveProject()}
              className="flex items-center gap-1 text-zinc-400 hover:text-amber-400 transition"
              title="Unsaved changes. Click to save now."
            >
              <Save className="w-3 h-3 text-amber-400" />
              <span className="hidden md:inline text-amber-400/90">Unsaved</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400/80">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline text-zinc-500">Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: Editing Tools */}
      <div className="flex items-center gap-0.5 md:gap-1 bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-0.5 md:p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={!canUndo}
          className="h-7 w-7 md:h-8 md:w-8 text-zinc-400 hover:text-white disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={!canRedo}
          className="h-7 w-7 md:h-8 md:w-8 text-zinc-400 hover:text-white disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </Button>

        <div className="h-4 w-px bg-zinc-800 mx-0.5 md:mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={splitClipAtPlayhead}
          disabled={!hasSelectedClip}
          className="h-7 md:h-8 text-zinc-300 hover:text-white gap-1.5 text-xs disabled:opacity-30 px-2"
          title={hasSelectedClip ? "Split Clip at Playhead (S)" : "Select a clip to split"}
        >
          <Scissors className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">Split</span>
        </Button>

        <div className="h-4 w-px bg-zinc-800 mx-0.5 md:mx-1" />

        {/* Aspect Ratio */}
        <div className="flex items-center gap-1 px-1">
          <Ratio className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={project.settings.aspectRatio}
            onChange={handleAspectRatioChange}
            className="bg-transparent text-xs text-zinc-300 font-medium cursor-pointer focus:outline-none hover:text-white"
            title="Aspect Ratio"
          >
            <option value="16:9" className="bg-zinc-900 text-white">16:9</option>
            <option value="9:16" className="bg-zinc-900 text-white">9:16</option>
            <option value="1:1" className="bg-zinc-900 text-white">1:1</option>
            <option value="4:3" className="bg-zinc-900 text-white">4:3</option>
          </select>
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-0.5 md:mx-1 hidden sm:block" />

        {/* Zoom */}
        <div className="hidden sm:flex items-center gap-1 px-1">
          <button
            onClick={() => setTimelineZoom(timelineZoom - 15)}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-zinc-400 w-8 text-center">
            {Math.round(timelineZoom)}%
          </span>
          <button
            onClick={() => setTimelineZoom(timelineZoom + 15)}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: AI Assistant & Export */}
      <div className="flex items-center gap-1.5 md:gap-2.5">
        <Button
          variant={panels.aiAssistant ? "primary" : "secondary"}
          size="sm"
          onClick={() => togglePanel("aiAssistant")}
          className={`gap-1.5 font-medium transition-all px-2 md:px-3.5 ${
            panels.aiAssistant
              ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/25 ring-1 ring-purple-400"
              : "bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border-purple-800/50"
          }`}
          title="Toggle AI Video Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          <span className="hidden sm:inline text-xs">AI Assistant</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenExport}
          className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-md shadow-blue-500/20 px-2.5 md:px-3.5"
        >
          <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="text-xs">Export</span>
        </Button>
      </div>
    </header>
  );
}
