/**
 * In-memory Media Cache and Object URL Registry.
 *
 * Prevents race conditions and black preview screens by:
 * 1. Storing uploaded File/Blob instances directly in memory as soon as imported.
 * 2. Creating and caching Blob Object URLs synchronously.
 * 3. Providing asynchronous fallback to IndexedDB if an asset is not yet in memory.
 * 4. Ensuring that playhead scrubbing never cancels or revokes active media URLs.
 */
import { loadMediaFile, saveMediaFile } from "./idb";
import { MediaAsset } from "@/types/project";

// AssetId -> Blob
const blobCache = new Map<string, Blob>();
// AssetId -> Object URL string
const urlCache = new Map<string, string>();
// Pending load promises to avoid duplicate simultaneous IDB reads
const pendingLoads = new Map<string, Promise<string | null>>();

/**
 * Register a Blob/File directly in memory (called immediately on upload).
 * Returns the object URL.
 */
export function registerMediaBlob(assetId: string, blob: Blob): string {
  blobCache.set(assetId, blob);

  // If a URL already exists, return it
  const existingUrl = urlCache.get(assetId);
  if (existingUrl) return existingUrl;

  const url = URL.createObjectURL(blob);
  urlCache.set(assetId, url);
  return url;
}

/**
 * Synchronously get a cached Object URL if available.
 */
export function getCachedMediaUrl(assetId: string): string | null {
  return urlCache.get(assetId) ?? null;
}

/**
 * Synchronously get a cached Blob if available.
 */
export function getCachedMediaBlob(assetId: string): Blob | null {
  return blobCache.get(assetId) ?? null;
}

/**
 * Resolve a media URL for an asset:
 * 1. Return cached URL immediately if available.
 * 2. Return URL from cached Blob if available.
 * 3. Asynchronously load Blob from IndexedDB, cache it, and return the URL.
 */
export async function resolveMediaUrl(asset: MediaAsset): Promise<string | null> {
  const cachedUrl = urlCache.get(asset.id);
  if (cachedUrl) return cachedUrl;

  const cachedBlob = blobCache.get(asset.id);
  if (cachedBlob) {
    const url = URL.createObjectURL(cachedBlob);
    urlCache.set(asset.id, url);
    return url;
  }

  // Deduplicate concurrent loads
  if (pendingLoads.has(asset.id)) {
    return pendingLoads.get(asset.id)!;
  }

  const loadPromise = (async () => {
    try {
      const blob = await loadMediaFile(asset.idbKey);
      if (blob) {
        blobCache.set(asset.id, blob);
        const url = URL.createObjectURL(blob);
        urlCache.set(asset.id, url);
        return url;
      }
      return null;
    } catch (err) {
      console.error(`Failed to load media file for asset ${asset.name} (${asset.id}):`, err);
      return null;
    } finally {
      pendingLoads.delete(asset.id);
    }
  })();

  pendingLoads.set(asset.id, loadPromise);
  return loadPromise;
}

/**
 * Clean up object URLs when an asset is deleted.
 */
export function unregisterMedia(assetId: string): void {
  const url = urlCache.get(assetId);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
    urlCache.delete(assetId);
  }
  blobCache.delete(assetId);
  pendingLoads.delete(assetId);
}
