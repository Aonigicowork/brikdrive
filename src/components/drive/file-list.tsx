'use client';

import React from 'react';
import { BrikFile } from '@/types/database';
import { NeoBadge } from '@/components/ui/neo-badge';
import { FileVideo, FileImage, Download, Share2, Trash2, Eye } from 'lucide-react';

export interface FileListProps {
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

export function FileList({ files, onPreview, onDownload, onShare, onDelete }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="w-full bg-neo-white border-3 border-neo-ink shadow-neo overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-neo-yellow border-b-3 border-neo-ink text-xs font-black uppercase text-neo-ink">
            <th className="py-3 px-4">Nama File</th>
            <th className="py-3 px-4">Tipe</th>
            <th className="py-3 px-4">Ukuran</th>
            <th className="py-3 px-4">Tanggal Unggah</th>
            <th className="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-neo-ink/20 font-bold text-sm text-neo-ink">
          {files.map((file) => {
            const isVideo = file.mime_type.startsWith('video/');

            return (
              <tr key={file.id} className="hover:bg-neo-bg/60 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 border-2 border-neo-ink bg-neo-white shrink-0 shadow-neo-sm">
                      {isVideo ? (
                        <FileVideo className="w-4 h-4 text-neo-blue" />
                      ) : (
                        <FileImage className="w-4 h-4 text-neo-pink" />
                      )}
                    </div>
                    <span
                      onClick={() => onPreview(file)}
                      className="font-black text-sm text-neo-ink truncate max-w-xs md:max-w-md cursor-pointer hover:underline"
                    >
                      {file.original_name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <NeoBadge variant={isVideo ? 'blue' : 'pink'} size="sm">
                    {isVideo ? 'VIDEO' : 'FOTO'}
                  </NeoBadge>
                </td>
                <td className="py-3 px-4 text-neutral-600 font-semibold">{formatBytes(file.byte_size)}</td>
                <td className="py-3 px-4 text-neutral-600 font-semibold">{formatDate(file.created_at)}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
