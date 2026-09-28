import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool neutral ramp — the app is mostly text, so these do the heavy lifting.
        ink: '#0f1720',
        body: '#3d4a57',
        muted: '#6b7885',
        faint: '#98a3ae',
        line: '#e6eaef',
        hair: '#f0f3f6',
        wash: '#f7f9fb',
        page: '#f4f6f9',
        surface: '#ffffff',
        brand: {
          DEFAULT: '#1f5fa8',
          soft: '#eaf2fb',
          hover: '#194d89',
          ring: '#9cc3ea',
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 32, 0.04), 0 1px 3px rgba(15, 23, 32, 0.06)',
        lift: '0 2px 4px rgba(15, 23, 32, 0.05), 0 8px 20px rgba(15, 23, 32, 0.08)',
      },
      borderRadius: {
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
