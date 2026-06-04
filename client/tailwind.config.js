/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0d0d0d',
        surface: '#1a1a1a',
        'surface-2': '#242424',
        accent: '#00ff88',
        'accent-dim': '#00cc6a',
        muted: '#6b7280',
        border: '#2a2a2a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 136, 0.15)',
        'glow-lg': '0 0 40px rgba(0, 255, 136, 0.2)',
      },
    },
  },
  plugins: [],
};

