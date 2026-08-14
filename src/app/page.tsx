'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { NeoButton } from '@/components/ui/neo-button';
import { NeoCard } from '@/components/ui/neo-card';
import { NeoBadge } from '@/components/ui/neo-badge';
import { createClient } from '@/lib/db/supabase-client';
import {
  HardDrive,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  FolderLock,
  Share2,
  Video,
  Image as ImageIcon,
} from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const appUrl = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appUrl}/drive`,
          scopes: 'email profile',
        },
      });

      if (error) {
        // If Supabase OAuth is not configured yet in local development, direct to /drive for preview
        window.location.href = '/drive';
      }
    } catch {
      window.location.href = '/drive';
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 max-w-6xl mx-auto">
      {/* Navbar */}
      <header className="flex items-center justify-between border-3 border-neo-ink bg-neo-white px-6 py-4 shadow-neo">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neo-yellow border-2 border-neo-ink shadow-neo-sm flex items-center justify-center font-black text-xl">
            B
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-neo-ink">BrikDrive</h1>
            <p className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">
              Personal Cloud Drive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NeoBadge variant="green" size="sm">V1.1 AKTIF</NeoBadge>
          <Link href="/drive">
            <NeoButton size="sm" variant="secondary">
              Buka Drive
            </NeoButton>
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="my-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headline & CTA */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <NeoBadge variant="yellow" size="md">
              GOOGLE DRIVE STORAGE
            </NeoBadge>
            <NeoBadge variant="pink" size="md">
              5 GIB RESUMABLE
            </NeoBadge>
          </div>

          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] text-neo-ink">
            Ruangmu. <br />
            <span className="bg-neo-yellow px-2 border-3 border-neo-ink inline-block mt-2 shadow-neo">
              Aturanmu.
            </span>
          </h2>

          <p className="text-base md:text-lg font-bold text-neutral-800 leading-relaxed max-w-xl">
            Cloud drive privat untuk menyimpan, menemukan, melihat, dan membagikan foto serta video resolusi penuh langsung di <strong>Google Drive milik Anda sendiri</strong>.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-start gap-2.5 bg-neo-white border-2 border-neo-ink p-3 shadow-neo-sm">
              <Zap className="w-5 h-5 text-neo-yellow shrink-0 mt-0.5" />
              <div className="text-xs font-bold">
                <p className="font-black text-sm">Resumable Direct Upload</p>
                <p className="text-neutral-600">Byte media mengalir langsung browser ↔ Google Drive.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-neo-white border-2 border-neo-ink p-3 shadow-neo-sm">
              <ShieldCheck className="w-5 h-5 text-neo-green shrink-0 mt-0.5" />
              <div className="text-xs font-bold">
                <p className="font-black text-sm">Privat & Terisolasi</p>
                <p className="text-neutral-600">Hanya izin folder <code className="bg-neo-bg px-1">drive.file</code>, bukan seluruh drive.</p>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-3 flex flex-col sm:flex-row gap-4 items-start">
            <NeoButton
              size="lg"
              variant="primary"
              onClick={handleGoogleLogin}
              isLoading={isLoading}
              className="w-full sm:w-auto"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Masuk dengan Google
            </NeoButton>

            <Link href="/drive" className="w-full sm:w-auto">
              <NeoButton size="lg" variant="secondary" className="w-full">
                Eksplor Antarmuka
                <ArrowRight className="w-5 h-5 ml-1.5" />
              </NeoButton>
            </Link>
          </div>
        </div>

        {/* Right Column: Interactive Card Visual */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <NeoCard variant="white" shadowSize="lg" className="p-6">
            <div className="flex items-center justify-between border-b-3 border-neo-ink pb-3 mb-4">
              <span className="font-black text-sm uppercase">Arsitektur Terpercaya</span>
              <Lock className="w-5 h-5 text-neo-pink" />
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-neo-yellow/20 border-2 border-neo-ink flex items-center gap-3">
                <HardDrive className="w-8 h-8 text-neo-ink shrink-0" />
                <div className="text-xs font-bold">
                  <p className="font-black text-sm">Penyimpanan Anda Sendiri</p>
                  <p className="text-neutral-600">File berada di folder /BrikDrive pada Google Drive Anda.</p>
                </div>
              </div>

              <div className="p-3 bg-neo-blue/20 border-2 border-neo-ink flex items-center gap-3">
                <FolderLock className="w-8 h-8 text-neo-blue shrink-0" />
                <div className="text-xs font-bold">
                  <p className="font-black text-sm">Envelope Encryption</p>
                  <p className="text-neutral-600">Kredensial refresh token terenkripsi AES-256-GCM di server.</p>
                </div>
              </div>

              <div className="p-3 bg-neo-green/20 border-2 border-neo-ink flex items-center gap-3">
                <Share2 className="w-8 h-8 text-neo-green shrink-0" />
                <div className="text-xs font-bold">
                  <p className="font-black text-sm">Tautan Berbagi Terkendali</p>
                  <p className="text-neutral-600">Opt-in, dapat dicabut kapan saja, dan berbatas waktu.</p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t-2 border-neo-ink/20 flex items-center justify-between text-xs font-bold text-neutral-500">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-4 h-4 text-neo-pink" /> Foto JPG, PNG, WEBP, RAW
              </span>
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4 text-neo-blue" /> Video MP4, MOV, MKV
              </span>
            </div>
          </NeoCard>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-3 border-neo-ink pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-neutral-600">
        <p>© 2026 BrikDrive — Cloud Drive Pribadi Berbasis Google Drive API.</p>
        <div className="flex items-center gap-4">
          <span className="bg-neo-yellow px-2 py-0.5 border border-neo-ink text-neo-ink font-black">
            Neobrutalism UI
          </span>
          <span>Next.js + Supabase</span>
        </div>
      </footer>
    </div>
  );
}
