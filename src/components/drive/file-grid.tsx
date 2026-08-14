'use client';

import React from 'react';
import { BrikFile } from '@/types/database';
import { NeoCard } from '@/components/ui/neo-card';
import { NeoBadge } from '@/components/ui/neo-badge';
import { FileVideo, FileImage, Download, Share2, Trash2, Eye } from 'lucide-react';

export interface FileGridProps {
  files: BrikFile[];
  onPreview: (file: BrikFile) => void;
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
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function FileGrid({ files, onPreview, onDownload, onShare, onDelete }: FileGridProps) {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {files.map((file) => {
        const isVideo = file.mime_type.startsWith('video/');

        return (
          <NeoCard
            key={file.id}
            variant="white"
            shadowSize="sm"
            className="p-3 group flex flex-col justify-between relative hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo transition-all"
          >
            {/* Thumbnail / Media Placeholder */}
            <div
              onClick={() => onPreview(file)}
              className="relative aspect-video w-full bg-neo-bg border-2 border-neo-ink flex items-center justify-center cursor-pointer overflow-hidden group-hover:bg-neo-yellow/20 transition-colors"
            >
              {file.provider_file_id ? (
                // Google Drive thumbnail image preview
                <img
                  src={`https://drive.google.com/thumbnail?id=${file.provider_file_id}&sz=w600`}
                  alt={file.original_name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to icon on thumbnail error
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}

              {/* Center icon if video or fallback */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-neo-ink/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-2 bg-neo-white border-2 border-neo-ink shadow-neo-sm">
                  <Eye className="w-5 h-5 text-neo-ink" />
                </div>
              </div>

              {/* File Type Badge */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <NeoBadge variant={isVideo ? 'blue' : 'pink'} size="sm">
                  {isVideo ? 'VIDEO' : 'FOTO'}
                </NeoBadge>
              </div>
            </div>

            {/* Metadata */}
            <div className="mt-3 flex flex-col gap-1">
              <p
                onClick={() => onPreview(file)}
                title={file.original_name}
                className="font-black text-sm text-neo-ink truncate cursor-pointer hover:underline"
              >
                {file.original_name}
              </p>
              <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
                <span>{formatBytes(file.byte_size)}</span>
                <span>{formatDate(file.created_at)}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-3 pt-2.5 border-t-2 border-neo-ink/20 flex items-center justify-between gap-1">
              <button
                onClick={() => onPreview(file)}
                title="Pratinjau"
                className="p-1.5 border-2 border-neo-ink bg-neo-white hover:bg-neo-yellow text-neo-ink shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDownload(file)}
                title="Unduh"
                className="p-1.5 border-2 border-neo-ink bg-neo-white hover:bg-neo-blue text-neo-ink shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onShare(file)}
                title="Bagikan"
                className="p-1.5 border-2 border-neo-ink bg-neo-white hover:bg-neo-green text-neo-ink shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(file)}
                title="Hapus"
                className="p-1.5 border-2 border-neo-ink bg-neo-white hover:bg-neo-orange hover:text-neo-white text-neo-ink shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </NeoCard>
        );
      })}
    </div>
  );
}
