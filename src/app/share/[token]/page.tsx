'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { NeoButton } from '@/components/ui/neo-button';
import { NeoCard } from '@/components/ui/neo-card';
import { NeoBadge } from '@/components/ui/neo-badge';
import { Download, AlertCircle, FileVideo, FileImage, ShieldCheck } from 'lucide-react';

interface PublicFileMetadata {
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  expiresAt: string | null;
  contentUrl: string;
  downloadUrl: string;
  previewUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PublicSharePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<PublicFileMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPublicFile() {
      try {
        const res = await fetch(`/api/v1/public/shares/${token}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          const err = await res.json().catch(() => ({ error: { message: 'Tautan tidak valid atau telah kedaluwarsa.' } }));
          setError(err.error?.message || 'Tautan tidak valid.');
        }
      } catch {
        setError('Terjadi kesalahan saat memuat file.');
      } finally {
        setIsLoading(false);
      }
    }

    loadPublicFile();
  }, [token]);

  const handleDownload = async () => {
    if (!data) return;
    window.open(data.downloadUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neo-bg flex items-center justify-center p-4">
        <NeoCard variant="white" shadowSize="md" className="p-8 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-neo-ink border-t-transparent animate-spin" />
          <p className="font-black text-sm text-neo-ink">Memverifikasi tautan berbagi...</p>
        </NeoCard>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neo-bg flex items-center justify-center p-4">
        <NeoCard variant="white" shadowSize="lg" className="p-8 max-w-md text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-neo-orange border-3 border-neo-ink shadow-neo-sm flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-neo-white" />
          </div>
          <div>
            <h2 className="font-black text-xl text-neo-ink">Tautan Tidak Tersedia</h2>
            <p className="text-xs font-bold text-neutral-600 mt-2">
              {error || 'Tautan ini telah dicabut oleh pemiliknya, masa berlakunya telah habis, atau file telah dihapus.'}
            </p>
          </div>
          <Link href="/">
            <NeoButton size="sm" variant="secondary">
              Kembali ke Beranda
            </NeoButton>
          </Link>
        </NeoCard>
      </div>
    );
  }

  const isVideo = data.mimeType.startsWith('video/');

  return (
    <div className="min-h-screen bg-neo-bg text-neo-ink flex flex-col justify-between p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between border-3 border-neo-ink bg-neo-white px-6 py-4 shadow-neo">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neo-yellow border-2 border-neo-ink shadow-neo-sm flex items-center justify-center font-black text-base">
            B
          </div>
          <span className="text-lg font-black tracking-tight text-neo-ink">BrikDrive Share</span>
        </div>

        <div className="flex items-center gap-2">
          <NeoBadge variant="green" size="sm">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Tautan Publik
          </NeoBadge>
        </div>
      </header>

      {/* Main Shared Content */}
      <main className="my-8 flex flex-col gap-6">
        <NeoCard variant="white" shadowSize="lg" className="p-6">
          {/* File Title & Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-3 border-neo-ink pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-neo-ink bg-neo-bg shadow-neo-sm">
                {isVideo ? (
                  <FileVideo className="w-6 h-6 text-neo-blue" />
                ) : (
                  <FileImage className="w-6 h-6 text-neo-pink" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-black text-neo-ink truncate max-w-lg">{data.fileName}</h1>
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 mt-1">
                  <span>{formatBytes(data.byteSize)}</span>
                  <span>•</span>
                  <span>{data.mimeType}</span>
                </div>
              </div>
            </div>

            <NeoButton size="md" variant="primary" onClick={handleDownload} className="shrink-0">
              <Download className="w-4 h-4 mr-2" />
              Unduh File
            </NeoButton>
          </div>

          {/* Media Preview Box */}
          <div className="w-full bg-neo-ink border-3 border-neo-ink min-h-[350px] max-h-[600px] flex items-center justify-center overflow-hidden">
            {isVideo ? (
              <iframe
                src={data.previewUrl}
                title={data.fileName}
                className="w-full h-[450px] border-none"
                allow="autoplay"
              />
            ) : (
              <img
                src={data.contentUrl}
                alt={data.fileName}
                className="max-h-[550px] max-w-full object-contain select-none p-2"
              />
            )}
          </div>

          {/* Share Notice */}
          <div className="mt-4 text-xs font-bold text-neutral-500 flex items-center justify-between">
            <span>Dibagikan secara privat via Google Drive</span>
            {data.expiresAt && (
              <span>Kedaluwarsa: {new Date(data.expiresAt).toLocaleDateString('id-ID')}</span>
            )}
          </div>
        </NeoCard>
      </main>

      {/* Footer */}
      <footer className="border-t-3 border-neo-ink pt-4 text-center text-xs font-bold text-neutral-500">
        <p>BrikDrive — Personal Cloud Storage for Photos & Videos.</p>
      </footer>
    </div>
  );
}
