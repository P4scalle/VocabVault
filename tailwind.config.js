/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './apps/**/src/**/*.{html,ts}',
    './libs/**/src/**/*.{html,ts}',
    '!**/*.spec.ts',
    '!**/*.test.ts',
  ],
  theme: {
    extend: {
      colors: {
        vv: {
          bg: 'rgb(var(--vv-rgb-bg) / <alpha-value>)',
          surface: 'rgb(var(--vv-rgb-surface) / <alpha-value>)',
          brand: 'rgb(var(--vv-rgb-brand) / <alpha-value>)',
          'brand-dark': '#2F6380',
          brandLight: '#E8F4F8',
        },
      },
      screens: {
        xs: '375px',
        mobile: '480px',
      },
      maxWidth: {
        app: '30rem',
        mobile: '480px',
        'desktop-content': '52vw',
      },
      spacing: {
        card: 'var(--vv-space-card)',
        gap: 'var(--vv-space-gap)',
        icon: 'var(--vv-size-icon)',
        btn: 'var(--vv-size-btn)',
        scroller: 'var(--vv-space-scroller)',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1' }],
      },
      boxShadow: {
        card: '0 2px 10px rgba(15, 23, 42, 0.06)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        'pulse-success': {
          '0%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
          '70%': { boxShadow: '0 0 0 8px rgba(34, 197, 94, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0)' },
        },
        'pulse-error': {
          '0%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
          '70%': { boxShadow: '0 0 0 8px rgba(239, 68, 68, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-brand': {
          '0%': { boxShadow: '0 0 0 0 rgba(58, 124, 165, 0.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(58, 124, 165, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(58, 124, 165, 0)' },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'count-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shake: 'shake 300ms ease-in-out',
        'pulse-success': 'pulse-success 400ms ease-out',
        'pulse-error': 'pulse-error 400ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-in-up': 'fade-in-up 250ms ease-out both',
        'scale-in': 'scale-in 200ms ease-out both',
        'pulse-brand': 'pulse-brand 500ms ease-out',
        'slide-in-up': 'slide-in-up 250ms ease-out both',
        'count-pop': 'count-pop 300ms ease-out',
        'slide-up': 'slide-up 250ms ease-out both',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
