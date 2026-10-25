/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vault: {
          950: '#050907', // deep midnight background
          900: '#0A120E', // panel / card background
          850: '#101B15', // elevated card / hover
          800: '#182720', // subtle border
          700: '#243A2F', // visible border / input
          600: '#335142',
          500: '#466C5A',
          400: '#6B9D86',
          accent: '#3B82F6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          cyan: '#06B6D4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(59, 130, 246, 0.25)',
        'glow-success': '0 0 15px -3px rgba(16, 185, 129, 0.25)',
        'glow-danger': '0 0 15px -3px rgba(239, 68, 68, 0.25)',
      }
    },
  },
  plugins: [],
}
