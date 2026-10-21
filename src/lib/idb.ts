/**
 * IndexedDB wrapper for project and media storage.
 * Uses the `idb` library for a clean Promise-based API.
 */
import { openDB, IDBPDatabase } from "idb";
import { Project } from "@/types/project";

const DB_NAME = "ai-video-studio";
const DB_VERSION = 1;

export interface StudioDB {
  projects: {
    key: string;
    value: Project;
    indexes: { by_updated: number };
  };
  media_files: {
    key: string;
    value: { id: string; file: Blob; assetId: string };
  };
  thumbnails: {
    key: string;
    value: { id: string; dataUrl: string };
  };
}

let _db: IDBPDatabase<StudioDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<StudioDB>> {
  if (_db) return _db;

  _db = await openDB<StudioDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("projects")) {
        const ps = db.createObjectStore("projects", { keyPath: "id" });
        ps.createIndex("by_updated", "updatedAt");
      }
      if (!db.objectStoreNames.contains("media_files")) {
        db.createObjectStore("media_files", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("thumbnails")) {
        db.createObjectStore("thumbnails", { keyPath: "id" });
      }
    },
  });

  return _db;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put("projects", project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDB();
  return (await db.get("projects", id)) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("projects", "by_updated");
  return all.reverse();
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("projects", id);
}

// ---------------------------------------------------------------------------
// Media Files (stored as Blobs)
// ---------------------------------------------------------------------------

export async function saveMediaFile(assetId: string, file: Blob): Promise<string> {
  const db = await getDB();
  const key = `media_${assetId}`;
  await db.put("media_files", { id: key, file, assetId });
  return key;
}

export async function loadMediaFile(idbKey: string): Promise<Blob | null> {
  const db = await getDB();
  const record = await db.get("media_files", idbKey);
  return record?.file ?? null;
}

export async function deleteMediaFile(idbKey: string): Promise<void> {
  const db = await getDB();
  await db.delete("media_files", idbKey);
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

export async function saveThumbnail(id: string, dataUrl: string): Promise<void> {
  const db = await getDB();
  await db.put("thumbnails", { id, dataUrl });
}

export async function loadThumbnail(id: string): Promise<string | null> {
  const db = await getDB();
  const record = await db.get("thumbnails", id);
  return record?.dataUrl ?? null;
}

// ---------------------------------------------------------------------------
// DB Size estimate
// ---------------------------------------------------------------------------

export async function estimateStorageUsage(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
