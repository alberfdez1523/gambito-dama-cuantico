import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a0b',
          1: '#121214',
          2: '#1b1b1e',
          3: '#242428',
          4: '#2f2f34',
        },
        accent: {
          DEFAULT: '#c8a951',
          hover: '#b8963e',
          light: '#dfc06b',
          muted: '#8b7635',
        },
        quantum: {
          DEFAULT: '#818cf8',
          light: '#a5b4fc',
          dark: '#6366f1',
          muted: '#4f46e5',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        serif: ['DM Serif Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'ui-xs': 'var(--text-ui-xs)',
        'ui-sm': 'var(--text-ui-sm)',
        'ui-base': 'var(--text-ui-base)',
        'ui-lg': 'var(--text-ui-lg)',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0,0,0,0.15)',
        card: '0 4px 24px -6px rgba(0,0,0,0.25)',
        board: '0 8px 40px -10px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
} satisfies Config
