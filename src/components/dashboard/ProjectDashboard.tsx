"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Project } from "@/types/project";
import { listProjects, deleteProject, saveProject, estimateStorageUsage } from "@/lib/idb";
import { createProject, migrateProject, formatTime } from "@/lib/project-utils";
import { generateId } from "@/lib/ids";
import { Button, Modal } from "@/components/ui";
import {
  Film,
  Plus,
  Upload,
  HardDrive,
  Clock,
  Trash2,
  Copy,
  Download,
  Sparkles,
  Search,
} from "lucide-react";

interface ProjectDashboardProps {
  onOpenProject: (project: Project) => void;
}

export function ProjectDashboard({ onOpenProject }: ProjectDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [storageInfo, setStorageInfo] = useState<{ used: number; quota: number } | null>(null);

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("Untitled Project");
  const [newProjectRatio, setNewProjectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");

  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Initial load
  useEffect(() => {
    let isCancelled = false;
    async function loadData() {
      try {
        const all = await listProjects();
        if (!isCancelled) setProjects(all);
        const storage = await estimateStorageUsage();
        if (!isCancelled) setStorageInfo(storage);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isCancelled = true;
    };
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const all = await listProjects();
      setProjects(all);
      const storage = await estimateStorageUsage();
      setStorageInfo(storage);
    } catch (err) {
      console.error("Failed to refresh projects:", err);
    }
  }, []);

  const handleCreateProject = async () => {
    const proj = createProject(newProjectName.trim() || "Untitled Project");
    let width = 1920;
    let height = 1080;
    if (newProjectRatio === "9:16") {
      width = 1080;
      height = 1920;
    } else if (newProjectRatio === "1:1") {
      width = 1080;
      height = 1080;
    }
    proj.settings.aspectRatio = newProjectRatio;
    proj.settings.width = width;
    proj.settings.height = height;

    await saveProject(proj);
    setIsNewProjectModalOpen(false);
    onOpenProject(proj);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      await deleteProject(id);
      await refreshProjects();
    }
  };

  const handleDuplicateProject = async (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy: Project = {
      ...proj,
      id: generateId("proj"),
      settings: {
        ...proj.settings,
        name: `${proj.settings.name} (Copy)`,
      },
      createdAt: proj.createdAt,
      updatedAt: proj.updatedAt,
    };
    await saveProject(copy);
    await refreshProjects();
  };

  const handleExportJSON = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(proj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${proj.settings.name}.aivideo.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        const migrated = migrateProject(raw);
        if (migrated) {
          migrated.id = generateId("proj");
          await saveProject(migrated);
          await refreshProjects();
        } else {
          alert("Invalid project JSON file.");
        }
      } catch {
        alert("Failed to parse project JSON file.");
      }
    };
    reader.readAsText(file);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const filteredProjects = projects.filter((p) =>
    p.settings.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Film className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>AI Video Studio</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                PRO
              </span>
            </h1>
            <p className="text-[10px] md:text-[11px] text-zinc-400">Professional In-Browser Video Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJSON}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => importFileInputRef.current?.click()}
            className="gap-1.5 text-xs px-2.5 md:px-3"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Import JSON</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setNewProjectName("My Video Project");
              setIsNewProjectModalOpen(true);
            }}
            className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 px-3"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Banner Card */}
        <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-blue-950/40 border border-zinc-800 p-5 md:p-8 relative overflow-hidden shadow-xl">
          <div className="max-w-2xl space-y-2.5 md:space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full Browser Processing • 100% Private</span>
            </div>
            <h2 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">
              Create Stunning Videos with Next-Gen AI
            </h2>
            <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
              Multi-track timeline, intelligent natural-language assistant with Gemini, auto-captions,
              audio balancing, and instant in-browser FFmpeg export.
            </p>
          </div>

          {/* Storage Meter */}
          {storageInfo && (
            <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center gap-2.5 text-xs text-zinc-400">
              <HardDrive className="w-4 h-4 text-zinc-500" />
              <span>
                Local Storage: {(storageInfo.used / (1024 * 1024)).toFixed(1)} MB used of{" "}
                {(storageInfo.quota / (1024 * 1024 * 1024)).toFixed(1)} GB available
              </span>
            </div>
          )}
        </div>

        {/* Projects Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">Your Projects</h3>
            <p className="text-xs text-zinc-400">Stored safely inside your browser’s IndexedDB</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Project Grid */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
            Loading your projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 md:p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
              <Film className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-300">No projects found</h4>
            <p className="text-xs text-zinc-500 max-w-sm">
              Start by creating your first project with custom aspect ratio presets.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewProjectName("My First Video");
                setIsNewProjectModalOpen(true);
              }}
              className="mt-2 text-xs"
            >
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onOpenProject(proj)}
                className="group bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden cursor-pointer transition shadow-sm hover:shadow-xl flex flex-col"
              >
                {/* Thumbnail Preview Area */}
                <div className="h-36 bg-zinc-950 border-b border-zinc-800/80 relative flex items-center justify-center overflow-hidden">
                  {proj.thumbnailDataUrl ? (
                    <img
                      src={proj.thumbnailDataUrl}
                      alt={proj.settings.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 text-zinc-700">
                      <Film className="w-8 h-8" />
                      <span className="text-[10px] uppercase font-mono tracking-wider">
                        {proj.settings.aspectRatio}
                      </span>
                    </div>
                  )}

                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-zinc-300 border border-white/10">
                    {formatTime(proj.settings.duration)}
                  </div>

                  {/* Aspect Ratio badge */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-[10px] font-semibold text-blue-300">
                    {proj.settings.aspectRatio}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-blue-400 transition truncate">
                      {proj.settings.name}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{proj.clips.length} clips</span>
                    </p>
                  </div>

                  {/* Quick Card Actions */}
                  <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-zinc-800/60">
                    <button
                      onClick={(e) => handleDuplicateProject(proj, e)}
                      className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
                      title="Duplicate project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleExportJSON(proj, e)}
                      className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
                      title="Backup JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <Modal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        title="Create New Project"
      >
        <div className="space-y-4 text-xs text-zinc-300">
          <div className="space-y-1.5">
            <label className="text-zinc-400 font-medium">Project Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. YouTube Video, Reel 1"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 font-medium">Target Format & Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "16:9" as const, label: "16:9", sub: "YouTube / TV" },
                { id: "9:16" as const, label: "9:16", sub: "Reels / TikTok" },
                { id: "1:1" as const, label: "1:1", sub: "Square Post" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setNewProjectRatio(r.id)}
                  className={`p-3 rounded-lg border text-center transition flex flex-col items-center gap-1 ${
                    newProjectRatio === r.id
                      ? "bg-blue-600/10 border-blue-500 text-white font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="text-sm font-bold">{r.label}</span>
                  <span className="text-[10px] text-zinc-500">{r.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateProject}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              Start Editing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

