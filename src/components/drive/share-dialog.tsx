'use client';

import React, { useState, useEffect } from 'react';
import { BrikFile, FileShare } from '@/types/database';
import { NeoDialog } from '@/components/ui/neo-dialog';
import { NeoButton } from '@/components/ui/neo-button';
import { NeoBadge } from '@/components/ui/neo-badge';
import { AlertTriangle, Copy, Check, Trash2, Link as LinkIcon, Clock } from 'lucide-react';

export interface ShareDialogProps {
  file: BrikFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ file, isOpen, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<FileShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<number | null>(24); // default 24h
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newlyCreatedUrl, setNewlyCreatedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && file) {
      loadShares(file.id);
      setNewlyCreatedUrl(null);
    }
  }, [isOpen, file]);

  const loadShares = async (fileId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/files/${fileId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShare = async () => {
    if (!file) return;
    setIsCreating(true);
    try {
      const res = await fetch(`/api/v1/files/${file.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInHours }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewlyCreatedUrl(data.shareUrl);
        loadShares(file.id);
      } else {
        const err = await res.json();
        alert(err.error?.message || 'Gagal membuat tautan berbagi');
      }
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!file) return;
    if (!confirm('Apakah Anda yakin ingin mencabut tautan ini? Penerima tidak akan dapat mengakses file lagi.')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/shares/${shareId}/revoke`, { method: 'POST' });
      if (res.ok) {
        setNewlyCreatedUrl(null);
        loadShares(file.id);
      } else {
        const err = await res.json();
        alert(err.error?.message || 'Gagal mencabut tautan');
      }
    } catch {
      alert('Gagal mencabut tautan');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  if (!file) return null;

  return (
    <NeoDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Bagikan "${file.original_name}"`}
      description="Buat tautan berbagi hanya-baca untuk file ini."
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">
        {/* Security Warning Contract */}
        <div className="bg-neo-yellow/30 border-3 border-neo-ink p-4 flex gap-3 shadow-neo-sm">
          <AlertTriangle className="w-6 h-6 text-neo-orange shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-neo-ink flex flex-col gap-1">
            <p className="font-black text-sm">Peringatan Izin Google Drive</p>
            <p>
              Saat tautan publik aktif, BrikDrive menambahkan izin Google Drive <span className="underline">anyone: reader</span> pada file ini. Siapa pun yang memiliki link dapat melihat dan mengunduh file tanpa login Google.
            </p>
            <p className="text-neutral-600">
              Pencabutan tautan dari BrikDrive akan menghapus izin ini dari Google Drive Anda.
            </p>
          </div>
        </div>

        {/* Create Link Section */}
        <div className="bg-neo-white border-3 border-neo-ink p-4 flex flex-col gap-3 shadow-neo-sm">
          <span className="text-xs font-black uppercase text-neo-ink tracking-wide flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-neo-blue" />
            Pilih Masa Berlaku Tautan
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '1 Jam', val: 1 },
              { label: '24 Jam', val: 24 },
              { label: '7 Hari', val: 168 },
              { label: 'Selamanya', val: null },
            ].map((opt) => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => setExpiresInHours(opt.val)}
                className={`py-2 px-3 text-xs font-black border-2 border-neo-ink transition-all shadow-neo-sm ${
                  expiresInHours === opt.val ? 'bg-neo-yellow text-neo-ink shadow-neo-pressed' : 'bg-neo-bg hover:bg-neutral-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <NeoButton
            variant="primary"
            onClick={handleCreateShare}
            isLoading={isCreating}
            className="w-full mt-2"
          >
            <LinkIcon className="w-4 h-4 mr-1.5" />
            Buat Tautan Berbagi Baru
          </NeoButton>
        </div>

        {/* Newly Created Share Alert */}
        {newlyCreatedUrl && (
          <div className="bg-neo-green/30 border-3 border-neo-ink p-4 flex flex-col gap-2 shadow-neo-sm">
            <span className="text-xs font-black text-neo-ink uppercase">Tautan Berhasil Dibuat:</span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={newlyCreatedUrl}
                className="w-full bg-neo-white border-2 border-neo-ink px-3 py-1.5 text-xs font-mono font-bold select-all"
              />
              <NeoButton
                size="sm"
                variant={copiedToken === 'new' ? 'success' : 'dark'}
                onClick={() => copyToClipboard(newlyCreatedUrl, 'new')}
              >
                {copiedToken === 'new' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </NeoButton>
            </div>
          </div>
        )}

        {/* Existing Shares List */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-black uppercase text-neo-ink tracking-wide">
            Tautan Berbagi Aktif ({shares.length})
          </span>

          {isLoading ? (
            <p className="text-xs font-bold text-neutral-500 py-3 text-center">Memuat riwayat...</p>
          ) : shares.length === 0 ? (
            <p className="text-xs font-bold text-neutral-500 py-2">Belum ada tautan aktif untuk file ini.</p>
          ) : (
            <div className="divide-y-2 divide-neo-ink/20 border-2 border-neo-ink bg-neo-white">
              {shares.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <NeoBadge variant="green" size="sm">AKTIF</NeoBadge>
                      <span className="text-neutral-600">
                        {s.expires_at ? `Kedaluwarsa: ${new Date(s.expires_at).toLocaleString('id-ID')}` : 'Tidak kedaluwarsa'}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono mt-0.5">ID: {s.id.slice(0, 8)}...</span>
                  </div>

                  <NeoButton
                    size="sm"
                    variant="danger"
                    onClick={() => handleRevokeShare(s.id)}
                    title="Cabut Tautan"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Cabut
                  </NeoButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </NeoDialog>
  );
}
