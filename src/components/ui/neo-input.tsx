import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const NeoInput = React.forwardRef<HTMLInputElement, NeoInputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-black uppercase tracking-wider text-neo-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2.5 bg-neo-white text-neo-ink font-bold border-3 border-neo-ink shadow-neo-sm',
              'placeholder:text-neutral-400 focus:outline-none focus:ring-4 focus:ring-neo-yellow focus:border-neo-ink focus:shadow-neo',
              'disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all duration-150',
              error && 'border-neo-orange focus:ring-neo-orange/40 bg-red-50/50',
              className
            )
          )}
          {...props}
        />
        {error && <span className="text-xs font-black text-neo-orange">{error}</span>}
      </div>
    );
  }
);

NeoInput.displayName = 'NeoInput';
