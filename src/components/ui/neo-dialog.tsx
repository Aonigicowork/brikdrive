'use client';

import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

export interface NeoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

const maxWidthStyles: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

export function NeoDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}: NeoDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neo-ink/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={twMerge(
          clsx(
            'relative w-full bg-neo-bg border-3 border-neo-ink shadow-neo-xl p-6 z-10 animate-in fade-in zoom-in-95 duration-150',
            maxWidthStyles[maxWidth]
          )
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-3 border-neo-ink pb-4 mb-5">
          <div>
            <h2 id="dialog-title" className="text-xl font-black text-neo-ink tracking-tight">
              {title}
            </h2>
            {description && <p className="text-sm font-semibold text-neutral-600 mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 border-2 border-neo-ink bg-neo-white hover:bg-neo-pink text-neo-ink shadow-neo-sm hover:shadow-[1px_1px_0px_0px_#171717] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
