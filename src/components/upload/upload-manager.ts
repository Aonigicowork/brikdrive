'use client';

import { openDB, type IDBPDatabase } from 'idb';
import { createClient } from '@/lib/db/supabase-client';

const DB_NAME = 'brikdrive_uploads_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';

export interface StoredUploadState {
  uploadId: string;
  fileId: string;
  sessionUri: string;
  name: string;
  size: number;
  lastModified: number;
  folderId?: string | null;
  confirmedByte: number;
  status: 'queued' | 'uploading' | 'paused' | 'failed' | 'completed' | 'cancelled';
  error?: string;
}

export interface UploadItem {
  id: string; // uploadId
  fileId?: string;
  file: File;
  folderId?: string | null;
  progress: number; // 0 - 100
  uploadedBytes: number;
  totalBytes: number;
  status: 'queued' | 'uploading' | 'paused' | 'failed' | 'completed' | 'cancelled';
  error?: string;
  sessionUri?: string;
  xhr?: XMLHttpRequest;
}

class UploadManager {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private queue: UploadItem[] = [];
  private activeUploadsCount = 0;
  private maxConcurrent = 2;
  private listeners: Array<(items: UploadItem[]) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initDB();
    }
  }

  private async initDB() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'uploadId' });
        }
      },
    });
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return {
          'Authorization': `Bearer ${session.access_token}`,
        };
      }
    } catch {
      // ignore
    }
    return {};
  }

  public subscribe(listener: (items: UploadItem[]) => void) {
    this.listeners.push(listener);
    listener([...this.queue]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const snapshot = [...this.queue];
    this.listeners.forEach((l) => l(snapshot));
  }

  public async addFiles(files: File[], folderId?: string | null) {
    for (const file of files) {
      // Validate type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        continue;
      }
      // Validate max 5 GiB
      if (file.size > 5 * 1024 * 1024 * 1024) {
        alert(`File ${file.name} melebihi batas maksimal 5 GiB.`);
        continue;
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const item: UploadItem = {
        id: tempId,
        file,
        folderId,
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        status: 'queued',
      };

      this.queue.push(item);
    }

    this.notify();
    this.processQueue();
  }

  private async processQueue() {
    if (this.activeUploadsCount >= this.maxConcurrent) return;

    const nextItem = this.queue.find((item) => item.status === 'queued');
    if (!nextItem) return;

    this.activeUploadsCount++;
    nextItem.status = 'uploading';
    this.notify();

    try {
      await this.startUpload(nextItem);
    } catch (err: unknown) {
      nextItem.status = 'failed';
      nextItem.error = err instanceof Error ? err.message : 'Upload gagal';
      this.notify();
    } finally {
      this.activeUploadsCount--;
      this.processQueue();
    }
  }

  private async startUpload(item: UploadItem) {
    // 1. Inisiasi sesi upload di Next.js API
    const authHeaders = await this.getAuthHeaders();
    const initRes = await fetch('/api/v1/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        originalName: item.file.name,
        mimeType: item.file.type,
        byteSize: item.file.size,
        folderId: item.folderId || null,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({ error: { message: 'Gagal inisiasi upload' } }));
      throw new Error(err.error?.message || 'Gagal memulai sesi upload');
    }

    const { uploadId, fileId, chunkSize, sessionUri } = await initRes.json();
    item.id = uploadId;
    item.fileId = fileId;
    item.sessionUri = sessionUri;

    // Save to IndexedDB
    if (this.dbPromise) {
      const db = await this.dbPromise;
      await db.put(STORE_NAME, {
        uploadId,
        fileId,
        sessionUri,
        name: item.file.name,
        size: item.file.size,
        lastModified: item.file.lastModified,
        folderId: item.folderId,
        confirmedByte: 0,
        status: 'uploading',
      } as StoredUploadState);
    }

    this.notify();

    // 2. Upload chunks directly from Browser to Google Drive
    await this.uploadChunksToGoogleDrive(item, chunkSize || 16 * 1024 * 1024);
  }

  private async uploadChunksToGoogleDrive(item: UploadItem, chunkSize: number) {
    const file = item.file;
    const totalSize = file.size;
    let startByte = item.uploadedBytes || 0;

    while (startByte < totalSize) {
      if (item.status === 'cancelled' || item.status === 'paused') {
        return;
      }

      const endByte = Math.min(startByte + chunkSize, totalSize);
      const chunkBlob = file.slice(startByte, endByte);

      let response: { status: number; range: string | null; body?: any } | null = null;
      let attempts = 0;
      while (attempts < 3) {
        try {
          response = await this.sendChunk(item, chunkBlob, startByte, endByte - 1, totalSize);
          break;
        } catch (chunkErr) {
          attempts++;
          if (attempts >= 3) {
            throw chunkErr;
          }
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts)));
        }
      }

      if (!response) {
        throw new Error('Gagal mengirim data chunk setelah 3 percobaan.');
      }

      if (response.status === 308) {
        // Resume incomplete - parse Range header from Google Drive
        const range = response.range;
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match) {
            startByte = parseInt(match[1], 10) + 1;
            item.uploadedBytes = startByte;
            item.progress = Math.round((startByte / totalSize) * 100);
            this.notify();
          } else {
            startByte = endByte;
          }
        } else {
          startByte = endByte;
        }
      } else if (response.status === 200 || response.status === 201) {
        // Upload completely finished on Google Drive!
        item.uploadedBytes = totalSize;
        item.progress = 100;
        this.notify();

        // 3. Finalize and verify in BrikDrive backend
        const providerFile = response.body;
        const providerFileId = providerFile.id;

        const authHeaders = await this.getAuthHeaders();
        const completeRes = await fetch(`/api/v1/uploads/${item.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ providerFileId }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({ error: { message: 'Verifikasi upload gagal' } }));
          throw new Error(err.error?.message || 'Verifikasi metadata gagal');
        }

        item.status = 'completed';
        this.notify();

        // Clean up from IndexedDB
        if (this.dbPromise) {
          const db = await this.dbPromise;
          await db.delete(STORE_NAME, item.id);
        }
        return;
      } else {
        throw new Error(`Google Drive upload error: HTTP ${response.status}`);
      }
    }
  }

  private sendChunk(
    item: UploadItem,
    chunk: Blob,
    start: number,
    end: number,
    total: number
  ): Promise<{ status: number; range: string | null; body?: any }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      item.xhr = xhr;

      xhr.open('PUT', item.sessionUri!, true);
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${total}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const currentChunkUploaded = e.loaded;
          const totalUploadedSoFar = start + currentChunkUploaded;
          item.uploadedBytes = totalUploadedSoFar;
          item.progress = Math.min(99, Math.round((totalUploadedSoFar / total) * 100));
          this.notify();
        }
      };

      xhr.onload = () => {
        item.xhr = undefined;
        let responseBody = null;
        try {
          responseBody = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          // ignore
        }

        resolve({
          status: xhr.status,
          range: xhr.getResponseHeader('Range'),
          body: responseBody,
        });
      };

      xhr.onerror = () => {
        item.xhr = undefined;
        reject(new Error('Koneksi jaringan terputus saat upload chunk'));
      };

      xhr.onabort = () => {
        item.xhr = undefined;
        reject(new Error('Upload dibatalkan'));
      };

      xhr.send(chunk);
    });
  }

  public cancelUpload(uploadId: string) {
    const item = this.queue.find((i) => i.id === uploadId);
    if (item) {
      if (item.xhr) {
        item.xhr.abort();
      }
      item.status = 'cancelled';
      this.notify();

      if (item.id && !item.id.startsWith('temp_')) {
        fetch(`/api/v1/uploads/${item.id}/cancel`, { method: 'POST' }).catch(() => {});
      }

      if (this.dbPromise) {
        this.dbPromise.then((db) => db.delete(STORE_NAME, uploadId)).catch(() => {});
      }
    }
  }

  public retryUpload(uploadId: string) {
    const item = this.queue.find((i) => i.id === uploadId);
    if (item && item.status === 'failed') {
      item.status = 'queued';
      item.error = undefined;
      this.notify();
      this.processQueue();
    }
  }

  public clearCompleted() {
    this.queue = this.queue.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
    this.notify();
  }
}

export const uploadManager = new UploadManager();
