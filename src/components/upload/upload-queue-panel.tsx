'use client';

import React, { useState, useEffect } from 'react';
import { uploadManager, type UploadItem } from './upload-manager';
import { NeoProgressBar } from '@/components/ui/neo-progress';
import { NeoBadge } from '@/components/ui/neo-badge';
import { X, ChevronUp, ChevronDown, RefreshCw, CheckCircle2, AlertCircle, FileVideo, FileImage } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function UploadQueuePanel() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    return uploadManager.subscribe((newItems) => {
      setItems(newItems);
    });
  }, []);

  if (items.length === 0) return null;

  const activeCount = items.filter((i) => i.status === 'uploading' || i.status === 'queued').length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-96 max-w-[calc(100vw-2.5rem)] bg-neo-bg border-3 border-neo-ink shadow-neo-xl">
      {/* Header */}
      <div className="bg-neo-yellow border-b-3 border-neo-ink px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-black text-neo-ink text-sm uppercase tracking-wide">
            Antrean Unggah ({items.length})
          </span>
          {activeCount > 0 && <NeoBadge variant="blue" size="sm">Aktif {activeCount}</NeoBadge>}
          {failedCount > 0 && <NeoBadge variant="orange" size="sm">Gagal {failedCount}</NeoBadge>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Kecilkan panel' : 'Perbesar panel'}
            className="p-1 border-2 border-neo-ink bg-neo-white hover:bg-neo-muted text-neo-ink transition-all shadow-neo-sm"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {completedCount > 0 && (
            <button
              onClick={() => uploadManager.clearCompleted()}
              title="Bersihkan yang selesai"
              className="p-1 border-2 border-neo-ink bg-neo-white hover:bg-neo-pink text-neo-ink transition-all shadow-neo-sm text-xs font-black"
            >
              Hapus Selesai
            </button>
          )}
        </div>
      </div>

      {/* Body List */}
      {isExpanded && (
        <div className="max-h-72 overflow-y-auto p-3 divide-y-2 divide-neo-ink/20">
          {items.map((item) => {
            const isVideo = item.file.type.startsWith('video/');

            return (
              <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 border-2 border-neo-ink bg-neo-white shrink-0 shadow-neo-sm">
                      {isVideo ? (
                        <FileVideo className="w-4 h-4 text-neo-blue" />
                      ) : (
                        <FileImage className="w-4 h-4 text-neo-pink" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-black text-neo-ink truncate">{item.file.name}</p>
                      <p className="text-[10px] font-bold text-neutral-600">
                        {formatBytes(item.uploadedBytes)} / {formatBytes(item.totalBytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'completed' && (
                      <span className="text-neo-green flex items-center gap-1 text-[11px] font-black">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}

                    {item.status === 'failed' && (
                      <button
                        onClick={() => uploadManager.retryUpload(item.id)}
                        title="Coba lagi"
                        className="p-1 border-2 border-neo-ink bg-neo-white hover:bg-neo-yellow text-neo-ink shadow-neo-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(item.status === 'uploading' || item.status === 'queued') && (
                      <button
                        onClick={() => uploadManager.cancelUpload(item.id)}
                        title="Batalkan"
                        className="p-1 border-2 border-neo-ink bg-neo-white hover:bg-neo-orange hover:text-neo-white text-neo-ink shadow-neo-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {(item.status === 'uploading' || item.status === 'queued') && (
                  <NeoProgressBar
                    value={item.progress}
                    size="sm"
                    variant={item.status === 'uploading' ? 'green' : 'yellow'}
                  />
                )}

                {item.status === 'failed' && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-neo-orange bg-red-50 p-1 border border-neo-orange">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{item.error || 'Upload gagal'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
