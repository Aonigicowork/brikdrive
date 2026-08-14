import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface NeoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'white' | 'dark';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, string> = {
  yellow: 'bg-neo-yellow text-neo-ink',
  pink: 'bg-neo-pink text-neo-ink',
  blue: 'bg-neo-blue text-neo-ink',
  green: 'bg-neo-green text-neo-ink',
  orange: 'bg-neo-orange text-neo-white',
  white: 'bg-neo-white text-neo-ink',
  dark: 'bg-neo-ink text-neo-bg',
};

export function NeoBadge({
  className,
  variant = 'yellow',
  size = 'md',
  children,
  ...props
}: NeoBadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-black uppercase tracking-wider border-2 border-neo-ink shadow-[2px_2px_0px_0px_#171717]',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          variantStyles[variant],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
}
