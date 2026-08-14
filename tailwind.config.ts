import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: '#FFF9E8',
          ink: '#171717',
          yellow: '#FFD84D',
          pink: '#FF7EB6',
          blue: '#73C7FF',
          green: '#A7E85A',
          orange: '#FF6B4A',
          purple: '#C4B5FD',
          muted: '#E5DFD0',
          white: '#FFFFFF',
        },
      },
      borderWidth: {
        '3': '3px',
      },
      boxShadow: {
        'neo': '6px 6px 0px 0px #171717',
        'neo-sm': '3px 3px 0px 0px #171717',
        'neo-lg': '8px 8px 0px 0px #171717',
        'neo-xl': '12px 12px 0px 0px #171717',
        'neo-inset': 'inset 3px 3px 0px 0px #171717',
        'neo-hover': '4px 4px 0px 0px #171717',
        'neo-pressed': '1px 1px 0px 0px #171717',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
