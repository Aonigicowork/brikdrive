import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface NeoProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  variant?: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const colorStyles: Record<string, string> = {
  yellow: 'bg-neo-yellow',
  green: 'bg-neo-green',
  blue: 'bg-neo-blue',
  pink: 'bg-neo-pink',
  orange: 'bg-neo-orange',
};

const heightStyles: Record<string, string> = {
  sm: 'h-2.5',
  md: 'h-4',
  lg: 'h-6',
};

export function NeoProgressBar({
  value,
  variant = 'yellow',
  size = 'md',
  showLabel = false,
  className,
  ...props
}: NeoProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className="w-full flex flex-col gap-1.5" {...props}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-black text-neo-ink">
          <span>Progress</span>
          <span>{clampedValue}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={twMerge(
          clsx(
            'w-full bg-neo-white border-3 border-neo-ink shadow-neo-sm overflow-hidden p-0.5',
            heightStyles[size],
            className
          )
        )}
      >
        <div
          className={clsx('h-full transition-all duration-200 border-r-2 border-neo-ink', colorStyles[variant])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
