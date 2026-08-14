import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'yellow' | 'pink' | 'blue' | 'green' | 'muted';
  shadowSize?: 'sm' | 'md' | 'lg' | 'none';
  interactive?: boolean;
}

const variantStyles: Record<string, string> = {
  white: 'bg-neo-white text-neo-ink',
  yellow: 'bg-neo-yellow text-neo-ink',
  pink: 'bg-neo-pink text-neo-ink',
  blue: 'bg-neo-blue text-neo-ink',
  green: 'bg-neo-green text-neo-ink',
  muted: 'bg-neo-muted text-neo-ink',
};

const shadowStyles: Record<string, string> = {
  none: '',
  sm: 'shadow-neo-sm',
  md: 'shadow-neo',
  lg: 'shadow-neo-lg',
};

export const NeoCard = React.forwardRef<HTMLDivElement, NeoCardProps>(
  ({ className, variant = 'white', shadowSize = 'md', interactive = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'border-3 border-neo-ink p-5 transition-all duration-150',
            variantStyles[variant],
            shadowStyles[shadowSize],
            interactive &&
              'cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-pressed',
            className
          )
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

NeoCard.displayName = 'NeoCard';
