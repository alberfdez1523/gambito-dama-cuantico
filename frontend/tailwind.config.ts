import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0A0A0A',
          1: '#111111',
          2: '#1A1A1A',
          3: '#222222',
          4: '#2A2A2A',
        },
        accent: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
          light: '#FDBA74',
          muted: '#9A3412',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px -5px rgba(249, 115, 22, 0.4)',
        'glow-sm': '0 0 10px -3px rgba(249, 115, 22, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config
