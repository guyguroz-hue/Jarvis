/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jarvis: {
          cyan: '#22d3ee',
          ice: '#7dd3fc',
          deep: '#0a1420',
          void: '#040a10',
          amber: '#fbbf24',
          alert: '#f87171',
          ok: '#4ade80',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.65', filter: 'brightness(1.4)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '94%': { opacity: '0.4' },
          '96%': { opacity: '1' },
        },
sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        scan: 'scan 6s linear infinite',
        flicker: 'flicker 4s linear infinite',
        sweep: 'sweep 4s linear infinite',
      },
    },
  },
  plugins: [],
}
