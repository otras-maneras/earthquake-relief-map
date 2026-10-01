import type { Config } from 'tailwindcss';

// Tokens espejados de otras maneras (ap-*) para reusar el sistema de diseño.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ap-bg': 'var(--ap-bg)',
        'ap-surface': 'var(--ap-surface)',
        'ap-surface-hover': 'var(--ap-surface-hover)',
        'ap-primary': 'var(--ap-primary)',
        'ap-secondary': 'var(--ap-secondary)',
        'ap-muted': 'var(--ap-muted)',
        'ap-border': 'var(--ap-border)',
        'ap-success': 'var(--ap-success)',
        'ap-red': 'var(--ap-red)',
        'ap-amber': 'var(--ap-amber)',
      },
      borderRadius: {
        'agentos-lg': '13px',
      },
      boxShadow: {
        'agentos-sm': 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.04)',
        'agentos-md': 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 14px rgba(0,0,0,0.10)',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out forwards',
        slideUp: 'slideUp 0.34s cubic-bezier(0.16,1,0.3,1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
