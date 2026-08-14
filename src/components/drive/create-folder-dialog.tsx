'use client';

import React, { useState } from 'react';
import { NeoDialog } from '@/components/ui/neo-dialog';
import { NeoButton } from '@/components/ui/neo-button';
import { NeoInput } from '@/components/ui/neo-input';
import { FolderPlus } from 'lucide-react';

export interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  onFolderCreated: () => void;
}

export function CreateFolderDialog({ isOpen, onClose, parentId, onFolderCreated }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama folder wajib diisi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentId: parentId || null }),
      });

      if (res.ok) {
        setName('');
        onFolderCreated();
        onClose();
      } else {
        const err = await res.json();
        setError(err.error?.message || 'Gagal membuat folder');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NeoDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Buat Folder Baru"
      description="Folder akan dibuat di BrikDrive dan disinkronkan ke Google Drive Anda."
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <NeoInput
          label="Nama Folder"
          placeholder="contoh: Liburan Bali 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error || undefined}
          autoFocus
        />

        <div className="flex justify-end gap-2 mt-2">
          <NeoButton type="button" variant="secondary" size="sm" onClick={onClose}>
            Batal
          </NeoButton>
          <NeoButton type="submit" variant="primary" size="sm" isLoading={isLoading}>
            <FolderPlus className="w-4 h-4 mr-1.5" />
            Buat Folder
          </NeoButton>
        </div>
      </form>
    </NeoDialog>
  );
}
