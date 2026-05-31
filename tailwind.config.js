/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // v4 Design System - Slate 900 dark palette
        'slate-900': '#0F172A',
        'slate-800': '#1E293B',
        'slate-700': '#334155',
        'slate-600': '#475569',
        'slate-500': '#64748B',
        'slate-400': '#94A3B8',
        'slate-50': '#F8FAFC',
        
        // Accent
        'blue-500': '#3B82F6',
        'blue-600': '#2563EB',
        'blue-400': '#60A5FA',
        
        // Semantic colors
        'success': '#22C55E',
        'warning': '#F59E0B',
        
        // Legacy aliases - mapped to new palette
        'deep-space': '#0F172A',
        'panel-dark': '#1E293B',
        'panel-medium': '#334155',
        'grid-blue': '#475569',
        'accent': '#3B82F6',
        'cyan-accent': '#3B82F6',
        'alert-red': '#EF4444',
        'live-green': '#22C55E',
        'info-blue': '#3B82F6',
        'warning-gold': '#F59E0B',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fade-in 500ms ease-out forwards',
        'slide-up': 'slide-up 400ms ease-out forwards',
        'slide-in-right': 'slide-in-right 300ms ease-out forwards',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        'slide-in-right': {
          '0%': { 
            opacity: '0',
            transform: 'translateX(20px)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateX(0)'
          },
        },
      },
      backgroundImage: {
        // Removed HUD scanline and grid backgrounds
      },
      boxShadow: {
        'panel': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'panel-lg': '0 8px 30px rgba(0, 0, 0, 0.6)',
        'accent': '0 0 20px rgba(59, 130, 246, 0.3)',
      },
    },
  },
  plugins: [],
}
