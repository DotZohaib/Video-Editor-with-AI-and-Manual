"use client";
import React, { useState, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import { renderProject } from "@/lib/ffmpeg-renderer";
import { Modal, Button } from "@/components/ui";
import { ExportSettings } from "@/types/project";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
} from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const project = useEditorStore((s) => s.project);
  const exportProgress = useEditorStore((s) => s.exportProgress);
  const setExportProgress = useEditorStore((s) => s.setExportProgress);

  const [fileName, setFileName] = useState(project?.settings.name || "MyEditedVideo");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "4K">("1080p");
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [quality, setQuality] = useState<"medium" | "high" | "lossless">("high");
  const [burnSubtitles, setBurnSubtitles] = useState(true);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputBlobSize, setOutputBlobSize] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!project) return null;

  const handleStartRender = async () => {
    setDownloadUrl(null);
    setOutputBlobSize(null);

    let width = 1920;
    let height = 1080;
    if (resolution === "720p") {
      width = 1280;
      height = 720;
    } else if (resolution === "4K") {
      width = 3840;
      height = 2160;
    }

    if (project.settings.aspectRatio === "9:16") {
      const temp = width;
      width = height;
      height = temp;
    } else if (project.settings.aspectRatio === "1:1") {
      width = 1080;
      height = 1080;
    }

    const currentExportSettings: ExportSettings = {
      fileName,
      resolution,
      width,
      height,
      frameRate: project.settings.frameRate || 30,
      videoBitrate: quality === "high" ? "8M" : quality === "lossless" ? "20M" : "4M",
      audioBitrate: "192k",
      videoCodec: format === "mp4" ? "h264" : "vp9",
      audioCodec: format === "mp4" ? "aac" : "opus",
      format,
      includeSubtitles: true,
      burnSubtitles,
      quality,
    };

    abortControllerRef.current = new AbortController();

    try {
      const blob = await renderProject(
        project,
        currentExportSettings,
        (progress) => {
          setExportProgress(progress);
        },
        abortControllerRef.current.signal
      );

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setOutputBlobSize(blob.size);
      setExportProgress({
        status: "done",
        progress: 100,
        message: "Rendering finished successfully!",
      });
    } catch (err: unknown) {
      console.error("Export failure:", err);
      setExportProgress({
        status: "error",
        error: err instanceof Error ? err.message : "Rendering failed",
        message: "Export failed",
      });
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setExportProgress({ status: "cancelled", message: "Export cancelled" });
  };

  const isRendering =
    exportProgress.status === "preparing" ||
    exportProgress.status === "processing" ||
    exportProgress.status === "encoding";

  return (
    <Modal isOpen={isOpen} onClose={isRendering ? () => {} : onClose} title="Export Video" maxWidth="max-w-lg">
      <div className="space-y-4 text-xs text-zinc-300">
        {/* Settings Configuration */}
        {!isRendering && exportProgress.status !== "done" && (
          <>
            {/* File Name */}
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Output File Name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Resolution & Format */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Resolution Preset</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as "720p" | "1080p" | "4K")}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD (Recommended)</option>
                  <option value="4K">4K Ultra HD</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium">Container Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as "mp4" | "webm")}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none"
                >
                  <option value="mp4">MP4 (H.264 / AAC)</option>
                  <option value="webm">WebM (VP9 / Opus)</option>
                </select>
              </div>
            </div>

            {/* Quality Preset */}
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Encoding Quality</label>
              <div className="flex gap-2">
                {(["medium", "high", "lossless"] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs capitalize transition ${
                      quality === q
                        ? "bg-blue-600 border-blue-500 text-white font-semibold"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtitles Burn-in */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800">
              <div>
                <span className="font-medium text-zinc-200">Burn Subtitles into Video</span>
                <p className="text-[11px] text-zinc-500">
                  Render all speech captions directly onto the video frames
                </p>
              </div>
              <input
                type="checkbox"
                checked={burnSubtitles}
                onChange={(e) => setBurnSubtitles(e.target.checked)}
                className="accent-blue-500 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Summary Box */}
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80 space-y-1 text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span>Aspect Ratio</span>
                <span className="font-semibold text-zinc-200">{project.settings.aspectRatio}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="font-semibold text-zinc-200">
                  {project.settings.duration.toFixed(1)} seconds
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Media Clips</span>
                <span className="font-semibold text-zinc-200">{project.clips.length}</span>
              </div>
            </div>
          </>
        )}

        {/* Progress Bar (Shown during rendering) */}
        {isRendering && (
          <div className="py-6 space-y-4 text-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
            <div>
              <h4 className="text-sm font-semibold text-white">Rendering Video...</h4>
              <p className="text-xs text-zinc-400 mt-1">{exportProgress.message}</p>
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${exportProgress.progress}%` }}
                  className="bg-blue-600 h-full transition-all duration-300"
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>Processing</span>
                <span>{exportProgress.progress}%</span>
              </div>
            </div>

            <Button variant="danger" size="sm" onClick={handleCancel}>
              Cancel Render
            </Button>
          </div>
        )}

        {/* Error State */}
        {exportProgress.status === "error" && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-lg text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h4 className="font-semibold text-white">Render Error</h4>
            <p className="text-xs text-red-300">{exportProgress.error || "An unknown error occurred"}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExportProgress({ status: "idle", progress: 0, message: "" })}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Success State */}
        {exportProgress.status === "done" && downloadUrl && (
          <div className="py-4 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <h4 className="text-base font-bold text-white">Video Ready for Download!</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Your video has been rendered and verified.
              </p>
              {outputBlobSize && (
                <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                  Size: {(outputBlobSize / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-center">
              <a
                href={downloadUrl}
                download={`${fileName}.${format}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download {fileName}.{format}</span>
              </a>

              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setExportProgress({ status: "idle", progress: 0, message: "" });
                  onClose();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isRendering && exportProgress.status !== "done" && (
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleStartRender} className="gap-1.5">
              <Film className="w-4 h-4" />
              <span>Start Export</span>
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}