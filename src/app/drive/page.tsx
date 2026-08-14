'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BrikFile, Folder, StorageUsageResponse } from '@/types/database';
import { NeoButton } from '@/components/ui/neo-button';
import { NeoCard } from '@/components/ui/neo-card';
import { NeoBadge } from '@/components/ui/neo-badge';
import { NeoProgressBar } from '@/components/ui/neo-progress';
import { FileGrid } from '@/components/drive/file-grid';
import { FileList } from '@/components/drive/file-list';
import { MediaViewer } from '@/components/drive/media-viewer';
import { ShareDialog } from '@/components/drive/share-dialog';
import { CreateFolderDialog } from '@/components/drive/create-folder-dialog';
import { UploadQueuePanel } from '@/components/upload/upload-queue-panel';
import { uploadManager } from '@/components/upload/upload-manager';
import { createClient } from '@/lib/db/supabase-client';
import {
  HardDrive,
  FolderPlus,
  Upload,
  LayoutGrid,
  List as ListIcon,
  Search,
  ChevronRight,
  Folder as FolderIcon,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  LogOut,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DriveDashboardPage() {
  // Navigation & Location
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);

  // Data States
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<BrikFile[]>([]);
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(true);
  const [providerEmail, setProviderEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [activeUploads, setActiveUploads] = useState<any[]>([]);

  useEffect(() => {
    return uploadManager.subscribe((items) => {
      const active = items.filter((i) => i.status === 'uploading' || i.status === 'queued');
      setActiveUploads(active);
    });
  }, []);

  // Modals
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<BrikFile | null>(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState<BrikFile | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper for authenticated requests
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers = new Headers(options.headers || {});
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
      return fetch(url, { ...options, headers });
    } catch {
      return fetch(url, options);
    }
  }, []);

  // Load Data
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Storage Usage & Connection Status
      const usageRes = await authFetch('/api/v1/storage/usage');
      if (usageRes.ok) {
        const usageData: StorageUsageResponse = await usageRes.json();
        setUsage(usageData);
        setIsDriveConnected(usageData.is_connected);
        setProviderEmail(usageData.provider_email || null);
      }

      // 2. Fetch Folders
      const folderUrl = currentFolderId
        ? `/api/v1/folders?parentId=${currentFolderId}`
        : '/api/v1/folders';
      const foldersRes = await authFetch(folderUrl);
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData.folders || []);
      }

      // 3. Fetch Files
      const params = new URLSearchParams({
        sort: sortBy,
      });
      if (currentFolderId) params.append('folderId', currentFolderId);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const filesRes = await authFetch(`/api/v1/files?${params.toString()}`);
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);
      }
    } catch (err) {
      console.error('Failed to load drive data', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, currentFolderId, searchQuery, sortBy]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Realtime Upload Completed Listener
  useEffect(() => {
    const handleUploadCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ file?: BrikFile | null; folderId?: string | null }>;
      const newFile = customEvent.detail?.file;
      const uploadedFolderId = customEvent.detail?.folderId;

      // If uploaded in current folder view, prepend immediately to files state for instant 0ms feedback
      if (newFile && (uploadedFolderId || null) === (currentFolderId || null)) {
        setFiles((prev) => {
          if (prev.some((f) => f.id === newFile.id)) return prev;
          return [newFile, ...prev];
        });
      }

      // Sync complete dashboard statistics
      loadDashboardData();
    };

    window.addEventListener('brikdrive:upload-completed', handleUploadCompleted);
    return () => {
      window.removeEventListener('brikdrive:upload-completed', handleUploadCompleted);
    };
  }, [currentFolderId, loadDashboardData]);

  // Supabase Realtime DB changes subscription for multi-tab and server-side updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('realtime:drive-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
        },
        () => {
          loadDashboardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'folders',
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  // Handle Folder Navigation
  const openFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
  };

  // Connect Google Drive Action
  const handleConnectDrive = async () => {
    try {
      const res = await authFetch('/api/v1/drive-connection/start', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        const errorMsg = data?.error?.message || 'Gagal memulai koneksi Google Drive.';
        if (data?.error?.code === 'UNAUTHENTICATED') {
          alert('Sesi login telah berakhir. Silakan login kembali.');
          window.location.href = '/';
        } else {
          alert(`Koneksi Gagal: ${errorMsg}`);
        }
      }
    } catch {
      alert('Terjadi kesalahan jaringan saat menghubungkan Google Drive.');
    }
  };

  // Disconnect Google Drive
  const handleDisconnectDrive = async () => {
    if (!confirm('Apakah Anda yakin ingin memutus koneksi Google Drive? Upload baru akan dihentikan.')) {
      return;
    }
    try {
      const res = await authFetch('/api/v1/drive-connection', { method: 'DELETE' });
      if (res.ok) {
        loadDashboardData();
      } else {
        alert('Gagal memutus koneksi Drive.');
      }
    } catch {
      alert('Gagal memutus koneksi.');
    }
  };

  // Sign out from Supabase Auth
  const handleLogout = async () => {
    if (!confirm('Apakah Anda yakin ingin keluar dari akun BrikDrive?')) return;
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Signout error', err);
    } finally {
      window.location.href = '/';
    }
  };

  // Handle File Uploads
  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const fileArray = Array.from(selectedFiles);
    uploadManager.addFiles(fileArray, currentFolderId);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // File Actions
  const handleDownload = async (file: BrikFile) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const tokenParam = session?.access_token ? `?token=${encodeURIComponent(session.access_token)}` : '';
      const downloadUrl = `/api/v1/files/${file.id}/download${tokenParam}`;

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.setAttribute('download', file.original_name);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 1000);
    } catch (err) {
      alert('Gagal memproses unduhan: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Instant Optimistic Delete Action
  const handleDelete = async (file: BrikFile) => {
    if (!confirm(`Pindahkan "${file.original_name}" ke tempat sampah?`)) return;

    // 1. Instant 0ms Optimistic UI removal
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (usage) {
      setUsage((prev) =>
        prev
          ? {
              ...prev,
              used_bytes: Math.max(0, prev.used_bytes - file.byte_size),
              active_file_count: Math.max(0, prev.active_file_count - 1),
            }
          : null
      );
    }

    try {
      const res = await authFetch(`/api/v1/files/${file.id}`, { method: 'DELETE' });
      if (res.ok) {
        loadDashboardData();
      } else {
        alert('Gagal menghapus file.');
        loadDashboardData(); // Revert on failure
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
      loadDashboardData(); // Revert on failure
    }
  };

  const usagePercent = usage && usage.quota_bytes > 0
    ? Math.min(100, Math.round((usage.used_bytes / usage.quota_bytes) * 100))
    : 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-neo-bg text-neo-ink pb-20"
    >
      {/* Global Running Candybar Progress Indicator when Uploading */}
      {activeUploads.length > 0 && (
        <div className="sticky top-0 z-40 w-full bg-neo-yellow border-b-3 border-neo-ink shadow-neo-sm overflow-hidden flex flex-col">
          <div className="w-full h-3 neo-top-runner" />
          <div className="px-4 py-1 bg-neo-yellow flex items-center justify-between text-xs font-black text-neo-ink">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neo-ink animate-ping inline-block" />
              <span>
                Sedang mengunggah {activeUploads.length} file ke Google Drive: {activeUploads[0].file?.name}
              </span>
            </span>
            <span className="bg-neo-white px-2 py-0.5 border border-neo-ink shadow-neo-sm">
              {activeUploads[0].progress}%
            </span>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-neo-white border-b-3 border-neo-ink px-4 md:px-8 py-3 shadow-neo-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Connection Badge */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-neo-yellow border-2 border-neo-ink shadow-neo-sm flex items-center justify-center font-black text-lg">
              B
            </div>
            <span className="text-xl font-black tracking-tight text-neo-ink">BrikDrive</span>
          </Link>

          {isDriveConnected ? (
            <div className="flex items-center gap-2">
              <NeoBadge variant="green" size="sm" className="hidden sm:inline-flex">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Drive Terhubung
              </NeoBadge>
              {providerEmail && (
                <span className="text-xs font-black text-neutral-600 truncate max-w-[150px] sm:max-w-[200px]">
                  {providerEmail}
                </span>
              )}
            </div>
          ) : (
            <NeoBadge variant="orange" size="sm">
              <AlertCircle className="w-3.5 h-3.5 mr-1" />
              Drive Terputus
            </NeoBadge>
          )}
        </div>

        {/* Global Search Bar */}
        <div className="w-full md:max-w-md relative">
          <input
            type="text"
            placeholder="Cari foto atau video..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neo-bg border-2 border-neo-ink px-3 py-1.5 pl-9 text-xs font-bold shadow-neo-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neo-blue"
          />
          <Search className="w-4 h-4 text-neo-ink absolute left-2.5 top-2.5 pointer-events-none" />
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          <NeoButton size="sm" variant="secondary" onClick={() => loadDashboardData()} title="Muat Ulang Data">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </NeoButton>

          {isDriveConnected ? (
            <NeoButton size="sm" variant="danger" onClick={handleDisconnectDrive} title="Putus Koneksi Google Drive">
              <Unlink className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Putus Drive</span>
            </NeoButton>
          ) : (
            <NeoButton size="sm" variant="primary" onClick={handleConnectDrive} title="Hubungkan Google Drive">
              <LinkIcon className="w-3.5 h-3.5 mr-1" />
              <span>Hubungkan Drive</span>
            </NeoButton>
          )}

          <NeoButton size="sm" variant="dark" onClick={handleLogout} title="Keluar dari Akun BrikDrive">
            <LogOut className="w-3.5 h-3.5 mr-1" />
            <span>Keluar</span>
          </NeoButton>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 flex flex-col gap-6">
        {/* Drive Not Connected Hero Banner */}
        {!isDriveConnected && (
          <NeoCard variant="yellow" shadowSize="md" className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-neo-white border-3 border-neo-ink shadow-neo-sm">
                <HardDrive className="w-8 h-8 text-neo-ink" />
              </div>
              <div>
                <h3 className="font-black text-lg text-neo-ink">Hubungkan Akun Google Drive Anda</h3>
                <p className="text-xs font-bold text-neutral-800 mt-0.5">
                  BrikDrive akan membuat folder <code className="bg-neo-white px-1.5 py-0.5 border border-neo-ink font-mono">BrikDrive</code> dengan izin minimal <code className="bg-neo-white px-1.5 py-0.5 border border-neo-ink font-mono">drive.file</code>.
                </p>
              </div>
            </div>
            <NeoButton size="md" variant="dark" onClick={handleConnectDrive} className="shrink-0">
              <LinkIcon className="w-4 h-4 mr-2" />
              Hubungkan Sekarang
            </NeoButton>
          </NeoCard>
        )}

        {/* Dashboard Status & Storage Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NeoCard variant="white" shadowSize="sm" className="p-4 flex flex-col justify-between">
            <span className="text-xs font-black uppercase text-neutral-500">Pemakaian BrikDrive</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-neo-ink">
                {formatBytes(usage?.used_bytes || 0)}
              </span>
              <span className="text-xs font-bold text-neutral-500">
                dari {formatBytes(usage?.quota_bytes || 107374182400)}
              </span>
            </div>
            <div className="mt-2">
              <NeoProgressBar value={usagePercent} size="sm" variant="green" />
            </div>
          </NeoCard>

          <NeoCard variant="white" shadowSize="sm" className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase text-neutral-500">File Tersimpan</span>
              <p className="text-2xl font-black text-neo-ink mt-1">{usage?.active_file_count || files.length}</p>
            </div>
            <div className="p-3 bg-neo-pink/30 border-2 border-neo-ink shadow-neo-sm">
              <HardDrive className="w-6 h-6 text-neo-ink" />
            </div>
          </NeoCard>

          <NeoCard variant="white" shadowSize="sm" className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase text-neutral-500">Folder Aktif</span>
              <p className="text-2xl font-black text-neo-ink mt-1">{usage?.active_folder_count || folders.length}</p>
            </div>
            <div className="p-3 bg-neo-blue/30 border-2 border-neo-ink shadow-neo-sm">
              <FolderIcon className="w-6 h-6 text-neo-ink" />
            </div>
          </NeoCard>
        </div>

        {/* Action Toolbar & Breadcrumbs */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-neo-white border-3 border-neo-ink p-4 shadow-neo">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 flex-wrap font-black text-sm">
            {folderPath.map((item, idx) => (
              <React.Fragment key={item.id || 'root'}>
                {idx > 0 && <ChevronRight className="w-4 h-4 text-neutral-400" />}
                <button
                  onClick={() => navigateToBreadcrumb(idx)}
                  className={`hover:underline transition-all ${
                    idx === folderPath.length - 1 ? 'text-neo-ink font-black' : 'text-neutral-500'
                  }`}
                >
                  {item.name}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center border-2 border-neo-ink bg-neo-bg shadow-neo-sm p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-neo-yellow text-neo-ink' : 'text-neutral-500'}`}
                title="Tampilan Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-neo-yellow text-neo-ink' : 'text-neutral-500'}`}
                title="Tampilan List"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-neo-white border-2 border-neo-ink px-2.5 py-1.5 text-xs font-black shadow-neo-sm focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Terbaru</option>
              <option value="date_asc">Terlama</option>
              <option value="name_asc">Nama (A-Z)</option>
              <option value="name_desc">Nama (Z-A)</option>
              <option value="size_desc">Ukuran Terbesar</option>
              <option value="size_asc">Ukuran Terkecil</option>
            </select>

            <NeoButton size="sm" variant="secondary" onClick={() => setIsCreateFolderOpen(true)}>
              <FolderPlus className="w-4 h-4 mr-1" />
              Folder Baru
            </NeoButton>

            <NeoButton size="sm" variant="primary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />
              Unggah Media
            </NeoButton>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
        </div>

        {/* Drag & Drop Visual Overlay Zone */}
        {isDragging && (
          <div className="border-3 border-dashed border-neo-ink bg-neo-yellow/30 p-10 flex flex-col items-center justify-center gap-3 animate-pulse shadow-neo">
            <Upload className="w-12 h-12 text-neo-ink" />
            <p className="font-black text-lg uppercase text-neo-ink">Lepaskan Foto/Video di Sini untuk Mengunggah</p>
          </div>
        )}

        {/* Subfolders Grid */}
        {folders.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider">Folder</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {folders.map((f) => (
                <NeoCard
                  key={f.id}
                  variant="white"
                  shadowSize="sm"
                  interactive
                  onClick={() => openFolder(f)}
                  className="p-3 flex items-center gap-2.5 truncate"
                >
                  <FolderOpen className="w-5 h-5 text-neo-yellow shrink-0 fill-neo-yellow" />
                  <span className="font-black text-xs text-neo-ink truncate">{f.name}</span>
                </NeoCard>
              ))}
            </div>
          </div>
        )}

        {/* Files Content Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider">
              File Foto & Video ({files.length})
            </h4>
          </div>

          {files.length === 0 && folders.length === 0 ? (
            <NeoCard variant="white" shadowSize="md" className="p-12 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-neo-yellow border-3 border-neo-ink shadow-neo-sm flex items-center justify-center">
                <Upload className="w-8 h-8 text-neo-ink" />
              </div>
              <div>
                <h3 className="font-black text-lg text-neo-ink">Folder Ini Masih Kosong</h3>
                <p className="text-xs font-bold text-neutral-600 mt-1 max-w-sm">
                  Tarik dan lepas foto atau video Anda ke sini, atau klik tombol di bawah untuk mulai mengunggah langsung ke Google Drive.
                </p>
              </div>
              <NeoButton size="md" variant="primary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Pilih File untuk Diunggah
              </NeoButton>
            </NeoCard>
          ) : viewMode === 'grid' ? (
            <FileGrid
              files={files}
              onPreview={(f) => setSelectedFileForPreview(f)}
              onDownload={handleDownload}
              onShare={(f) => setSelectedFileForShare(f)}
              onDelete={handleDelete}
            />
          ) : (
            <FileList
              files={files}
              onPreview={(f) => setSelectedFileForPreview(f)}
              onDownload={handleDownload}
              onShare={(f) => setSelectedFileForShare(f)}
              onDelete={handleDelete}
            />
          )}
        </div>
      </main>

      {/* Floating Upload Queue Panel */}
      <UploadQueuePanel />

      {/* Media Viewer Modal */}
      <MediaViewer
        file={selectedFileForPreview}
        isOpen={!!selectedFileForPreview}
        onClose={() => setSelectedFileForPreview(null)}
        onDownload={handleDownload}
        onShare={(f) => {
          setSelectedFileForPreview(null);
          setSelectedFileForShare(f);
        }}
        onDelete={(f) => {
          setSelectedFileForPreview(null);
          handleDelete(f);
        }}
      />

      {/* Share Link Modal */}
      <ShareDialog
        file={selectedFileForShare}
        isOpen={!!selectedFileForShare}
        onClose={() => setSelectedFileForShare(null)}
      />

      {/* Create Folder Modal */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        parentId={currentFolderId}
        onFolderCreated={loadDashboardData}
      />
    </div>
  );
}
