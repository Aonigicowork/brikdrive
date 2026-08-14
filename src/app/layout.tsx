import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrikDrive — Cloud Drive Pribadi di Google Drive Anda',
  description:
    'Simpan, temukan, lihat, dan bagikan foto serta video resolusi penuh langsung di Google Drive milik Anda dengan gaya Neobrutalism yang tegas dan privat.',
  keywords: ['cloud drive', 'google drive storage', 'personal cloud', 'photo backup', 'video backup', 'neobrutalism'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-neo-bg text-neo-ink antialiased selection:bg-neo-pink selection:text-neo-ink">
        {children}
      </body>
    </html>
  );
}
