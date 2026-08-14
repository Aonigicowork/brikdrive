'use client';

import React, { useState } from 'react';
import { BrikFile } from '@/types/database';
import { NeoDialog } from '@/components/ui/neo-dialog';
import { NeoButton } from '@/components/ui/neo-button';
import { NeoBadge } from '@/components/ui/neo-badge';
import { Download, Share2, Trash2, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';

export interface MediaViewerProps {
  file: BrikFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (file: BrikFile) => void;
  onShare: (file: BrikFile) => void;
  onDelete: (file: BrikFile) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MediaViewer({ file, isOpen, onClose, onDownload, onShare, onDelete }: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);

  if (!file) return null;

  const isVideo = file.mime_type.startsWith('video/');
  const driveEmbedUrl = file.provider_file_id
    ? `https://drive.google.com/file/d/${file.provider_file_id}/preview`
    : null;
  const driveDirectUrl = file.provider_file_id
    ? `https://drive.google.com/uc?export=view&id=${file.provider_file_id}`
    : null;

  return (
    <NeoDialog
      isOpen={isOpen}
      onClose={() => {
        setZoom(1);
        onClose();
      }}
      title={file.original_name}
      maxWidth="4xl"
    >
      <div className="flex flex-col gap-5">
        {/* Media Preview Screen */}
        <div className="relative w-full min-h-[350px] max-h-[550px] bg-neo-ink border-3 border-neo-ink flex items-center justify-center overflow-hidden">
          {isVideo ? (
            <div className="w-full h-full min-h-[400px]">
              {driveEmbedUrl ? (
                <iframe
                  src={driveEmbedUrl}
                  title={file.original_name}
                  className="w-full h-[450px] border-none"
                  allow="autoplay"
                />
              ) : (
                <div className="text-neo-bg font-bold p-6 text-center">
                  Pemutar video sedang memuat stream Google Drive...
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-full h-full min-h-[380px] flex items-center justify-center p-2 overflow-auto">
              <img
                src={driveDirectUrl || `https://drive.google.com/thumbnail?id=${file.provider_file_id}&sz=w1200`}
                alt={file.original_name}
                style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease' }}
                className="max-h-[480px] max-w-full object-contain select-none"
              />
              {/* Zoom Controls for Photos */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-neo-white border-2 border-neo-ink p-1 shadow-neo-sm">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  title="Perkecil"
                  className="p-1 hover:bg-neo-yellow text-neo-ink font-bold"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-black px-1 text-neo-ink">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  title="Perbesar"
                  className="p-1 hover:bg-neo-yellow text-neo-ink font-bold"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Metadata & Actions Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-between bg-neo-white border-3 border-neo-ink p-4 shadow-neo-sm">
          {/* Metadata */}
          <div className="flex flex-col gap-1.5 text-xs font-bold text-neutral-700">
            <div className="flex items-center gap-2">
              <NeoBadge variant={isVideo ? 'blue' : 'pink'} size="sm">
                {file.mime_type}
              </NeoBadge>
              <span className="font-black text-neo-ink">{formatBytes(file.byte_size)}</span>
            </div>
            <p>Diupload: {formatDate(file.created_at)}</p>
            {file.provider_file_id && (
              <p className="text-[10px] text-neutral-500 truncate font-mono">
                Google Drive ID: {file.provider_file_id}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-start md:justify-end gap-2 flex-wrap">
            <NeoButton variant="info" size="sm" onClick={() => onDownload(file)}>
              <Download className="w-4 h-4" />
              <span>Unduh</span>
            </NeoButton>
            <NeoButton variant="success" size="sm" onClick={() => onShare(file)}>
              <Share2 className="w-4 h-4" />
              <span>Bagikan</span>
            </NeoButton>
            {file.provider_file_id && (
              <a
                href={`https://drive.google.com/file/d/${file.provider_file_id}/view`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-neo-ink bg-neo-white hover:bg-neo-yellow text-neo-ink shadow-neo-sm transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Drive</span>
              </a>
            )}
            <NeoButton variant="danger" size="sm" onClick={() => onDelete(file)}>
              <Trash2 className="w-4 h-4" />
              <span>Hapus</span>
            </NeoButton>
          </div>
        </div>
      </div>
    </NeoDialog>
  );
}
