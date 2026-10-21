"use client";
import React, { useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { importMediaFile } from "@/lib/media-import";
import { formatTime } from "@/lib/time";
import { Button } from "@/components/ui";
import { MediaAsset } from "@/types/project";
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Type,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  FileVideo,
  FileAudio,
  Sparkles,
} from "lucide-react";

export function MediaLibrary() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"media" | "text">("media");
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "video" | "audio" | "image">("all");

  const project = useEditorStore((s) => s.project);
  const addAsset = useEditorStore((s) => s.addAsset);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const addClip = useEditorStore((s) => s.addClip);
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const addCaption = useEditorStore((s) => s.addCaption);
  const playheadPosition = useEditorStore((s) => s.playheadPosition);

  const assets = project?.assets ?? [];
  const tracks = project?.tracks ?? [];
  const captions = project?.captions ?? [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { asset } = await importMediaFile(file);
        addAsset(asset);
      } catch (err: unknown) {
        console.error("Failed to import file:", file.name, err);
        setErrorMessage(
          err instanceof Error ? err.message : `Failed to import ${file.name}`
        );
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    for (let i = 0; i < files.length; i++) {
      try {
        const { asset } = await importMediaFile(files[i]);
        addAsset(asset);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Import failed");
      }
    }
    setIsUploading(false);
  };

  const handleAddToTimeline = (asset: MediaAsset) => {
    let track = tracks.find((t) => t.kind === asset.kind);
    if (!track) {
      track = tracks[0];
    }
    if (track) {
      const startPos = (project?.clips.length ?? 0) === 0 ? 0 : playheadPosition;
      addClip(asset, track.id, startPos);
    }
  };

  const handleAddText = () => {
    const textTrack = tracks.find((t) => t.kind === "text") || tracks[0];
    if (textTrack) {
      addTextClip(textTrack.id, playheadPosition);
    }
  };

  const handleAddQuickCaption = () => {
    addCaption("New caption line", playheadPosition, playheadPosition + 3);
  };

  const filteredAssets = assets.filter((a) => {
    const matchesQuery = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKind = kindFilter === "all" || a.kind === kindFilter;
    return matchesQuery && matchesKind;
  });

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800 text-zinc-200 select-none">
      {/* Top Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/40">
        <button
          onClick={() => setActiveTab("media")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === "media"
              ? "text-blue-400 border-b-2 border-blue-500 bg-zinc-900/80"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Media</span>
          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded-full text-zinc-400">
            {assets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("text")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === "text"
              ? "text-blue-400 border-b-2 border-blue-500 bg-zinc-900/80"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Text & Subs</span>
        </button>
      </div>

      {/* Tab: Media */}
      {activeTab === "media" && (
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-700 hover:border-blue-500/80 hover:bg-blue-500/5 rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 group shrink-0"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,audio/*,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="p-2 bg-zinc-800 group-hover:bg-blue-600/20 rounded-full transition">
              <UploadCloud className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" />
            </div>
            <p className="text-xs font-medium text-zinc-300">
              {isUploading ? "Processing media..." : "Import Media"}
            </p>
            <p className="text-[11px] text-zinc-500">
              MP4, WebM, MP3, WAV, JPG, PNG
            </p>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-red-950/60 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {(["all", "video", "audio", "image"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`text-[11px] px-2 py-0.5 rounded capitalize transition ${
                    kindFilter === k
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Asset List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredAssets.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-zinc-500 text-xs">
                <FileVideo className="w-8 h-8 text-zinc-700 mb-2" />
                <p>No media files imported yet.</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Drag and drop files or click above to import.
                </p>
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-lg p-2 transition flex items-center gap-2.5"
                >
                  {/* Thumbnail / Icon */}
                  <div className="w-12 h-10 rounded bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center relative border border-zinc-700/50">
                    {asset.thumbnailDataUrl ? (
                      <img
                        src={asset.thumbnailDataUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.kind === "audio" ? (
                      <FileAudio className="w-5 h-5 text-indigo-400" />
                    ) : asset.kind === "image" ? (
                      <ImageIcon className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <FileVideo className="w-5 h-5 text-blue-400" />
                    )}

                    {asset.meta.duration !== undefined && (
                      <span className="absolute bottom-0 right-0 bg-black/80 text-[9px] px-1 font-mono text-zinc-300 rounded-tl">
                        {formatTime(asset.meta.duration)}
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate" title={asset.originalName}>
                      {asset.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                      <span className="uppercase">{asset.kind}</span>
                      <span>•</span>
                      <span>{(asset.meta.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <button
                      onClick={() => handleAddToTimeline(asset)}
                      className="p-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-md transition"
                      title="Add to Timeline at playhead"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeAsset(asset.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-md transition"
                      title="Delete asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Text & Captions */}
      {activeTab === "text" && (
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-zinc-400">
            Add animated text titles and synchronized subtitles to your timeline.
          </p>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddText}
            className="w-full justify-start gap-2 bg-zinc-900 border-zinc-800"
          >
            <Type className="w-4 h-4 text-blue-400" />
            <div className="text-left">
              <div className="text-xs font-semibold text-zinc-200">Add Text Overlay</div>
              <div className="text-[10px] text-zinc-500">Customizable title on canvas</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddQuickCaption}
            className="w-full justify-start gap-2 bg-zinc-900 border-zinc-800"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <div className="text-left">
              <div className="text-xs font-semibold text-zinc-200">Add Caption Line</div>
              <div className="text-[10px] text-zinc-500">Timed subtitle overlay</div>
            </div>
          </Button>

          <div className="mt-4 pt-3 border-t border-zinc-800">
            <h4 className="text-xs font-semibold text-zinc-300 mb-2">Project Captions ({captions.length})</h4>
            {captions.length === 0 ? (
              <p className="text-[11px] text-zinc-500 italic">No captions yet. Use AI Assistant or button above.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {captions.map((cap) => (
                  <div
                    key={cap.id}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded text-xs flex justify-between items-start gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-zinc-200 truncate">{cap.text}</p>
                      <p className="text-[10px] text-zinc-500">
                        {formatTime(cap.startTime)} - {formatTime(cap.endTime)} ({cap.language})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


