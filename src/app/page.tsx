"use client";
import React, { useState, useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { Project } from "@/types/project";
import { ProjectDashboard } from "@/components/dashboard/ProjectDashboard";
import { TopToolbar } from "@/components/toolbar/TopToolbar";
import { MediaLibrary } from "@/components/media-library/MediaLibrary";
import { VideoPreview } from "@/components/preview/VideoPreview";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { MultiTrackTimeline } from "@/components/timeline/MultiTrackTimeline";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { ExportModal } from "@/components/export/ExportModal";
import { Film, Sliders, Sparkles, X } from "lucide-react";

export default function Home() {
  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const saveProject = useEditorStore((s) => s.saveProject);
  const panels = useEditorStore((s) => s.panels);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [mobileActiveDrawer, setMobileActiveDrawer] = useState<"none" | "media" | "inspector" | "ai">("none");

  // Auto-save timer when dirty
  const isDirty = useEditorStore((s) => s.isDirty);
  useEffect(() => {
    if (!isDirty || !project) return;
    const timer = setTimeout(() => {
      saveProject().catch(console.error);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isDirty, project, saveProject]);

  const handleOpenProject = (p: Project) => {
    loadProject(p);
  };

  const handleBackToDashboard = async () => {
    if (project) {
      await saveProject().catch(console.error);
    }
    useEditorStore.setState({ project: null });
  };

  // If no project selected, show dashboard
  if (!project) {
    return <ProjectDashboard onOpenProject={handleOpenProject} />;
  }

  // Active Editor Workspace
  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none font-sans">
      {/* Top Toolbar */}
      <TopToolbar
        onBackToDashboard={handleBackToDashboard}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Mobile Drawer Toggle Bar (visible only on screens < md) */}
      <div className="md:hidden h-9 bg-zinc-900 border-b border-zinc-800 flex items-center justify-around px-2 text-xs">
        <button
          onClick={() => setMobileActiveDrawer(mobileActiveDrawer === "media" ? "none" : "media")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition ${
            mobileActiveDrawer === "media" ? "bg-blue-600 text-white" : "text-zinc-400"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Media</span>
        </button>

        <button
          onClick={() => setMobileActiveDrawer(mobileActiveDrawer === "inspector" ? "none" : "inspector")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition ${
            mobileActiveDrawer === "inspector" ? "bg-blue-600 text-white" : "text-zinc-400"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>

        <button
          onClick={() => setMobileActiveDrawer(mobileActiveDrawer === "ai" ? "none" : "ai")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition ${
            mobileActiveDrawer === "ai" ? "bg-purple-600 text-white" : "text-zinc-400"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI</span>
        </button>
      </div>

      {/* Center Studio Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: Media Library Panel (Desktop) */}
        {panels.mediaLibrary && (
          <aside className="hidden md:block w-72 shrink-0 h-full overflow-hidden">
            <MediaLibrary />
          </aside>
        )}

        {/* Center: Video Preview Screen */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <VideoPreview />
        </main>

        {/* Right: AI Assistant (if toggled) or Inspector Panel (Desktop) */}
        <div className="hidden md:block shrink-0 h-full">
          {panels.aiAssistant ? (
            <AIAssistant />
          ) : panels.inspector ? (
            <aside className="w-80 h-full overflow-hidden">
              <InspectorPanel />
            </aside>
          ) : null}
        </div>

        {/* Mobile Slide-over Drawer (visible on screens < md when drawer is active) */}
        {mobileActiveDrawer !== "none" && (
          <div className="md:hidden absolute inset-0 z-40 bg-black/80 flex flex-col backdrop-blur-sm">
            <div className="flex items-center justify-between p-2.5 bg-zinc-900 border-b border-zinc-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {mobileActiveDrawer === "media"
                  ? "Media Library"
                  : mobileActiveDrawer === "inspector"
                  ? "Properties Inspector"
                  : "AI Assistant"}
              </span>
              <button
                onClick={() => setMobileActiveDrawer("none")}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {mobileActiveDrawer === "media" && <MediaLibrary />}
              {mobileActiveDrawer === "inspector" && <InspectorPanel />}
              {mobileActiveDrawer === "ai" && <AIAssistant />}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Professional Multi-Track Timeline */}
      <footer className="shrink-0">
        <MultiTrackTimeline />
      </footer>

      {/* Video Export Modal */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
