import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-neo-yellow text-neo-ink hover:bg-[#FACC15]',
  secondary: 'bg-neo-white text-neo-ink hover:bg-neutral-50',
  accent: 'bg-neo-pink text-neo-ink hover:bg-[#F472B6]',
  info: 'bg-neo-blue text-neo-ink hover:bg-[#60A5FA]',
  success: 'bg-neo-green text-neo-ink hover:bg-[#86EFAC]',
  danger: 'bg-neo-orange text-neo-white hover:bg-[#EA580C]',
  dark: 'bg-neo-ink text-neo-bg hover:bg-neutral-800',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs font-bold gap-1.5 shadow-neo-sm hover:shadow-[1px_1px_0px_0px_#171717]',
  md: 'px-4 py-2 text-sm font-black gap-2 shadow-neo hover:shadow-neo-hover active:shadow-neo-pressed',
  lg: 'px-6 py-3 text-base font-black gap-2.5 shadow-neo-lg hover:shadow-neo-hover active:shadow-neo-pressed',
};

export const NeoButton = React.forwardRef<HTMLButtonElement, NeoButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center border-3 border-neo-ink transition-all duration-150',
            'select-none cursor-pointer active:translate-x-[2px] active:translate-y-[2px]',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-neo-sm',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-blue focus-visible:ring-offset-2',
            variantStyles[variant],
            sizeStyles[size],
            className
          )
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Memuat...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

NeoButton.displayName = 'NeoButton';
