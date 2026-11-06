/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0B1120',
          900: '#111827',
          800: '#1C2536',
          700: '#2C3649',
          600: '#4B5565',
          500: '#6B7280',
          400: '#9AA0AB',
          300: '#C4C7CE',
        },
        canvas: '#F3F0EA',
        paper: '#FBFAF7',
        line: { DEFAULT: '#E6E1D8', strong: '#D6CFC3' },
        wine: {
          50: '#FBF2F4',
          100: '#F5DFE5',
          200: '#EAC0CB',
          400: '#B65A75',
          500: '#93304E',
          600: '#7C2541',
          700: '#651C35',
          800: '#4D1528',
        },
        gold: { 100: '#F7EDD6', 300: '#E5CA8E', 500: '#C59E4F', 600: '#A6823A', 700: '#7F6229' },
        ok: { 50: '#EEF7F1', 500: '#2F7D57', 600: '#246647' },
        warn: { 50: '#FDF5E6', 500: '#B7791F', 600: '#975F12' },
        bad: { 50: '#FDEEEC', 500: '#B42318', 600: '#912018' },
        floor: { light: '#EFE4D2', DEFAULT: '#E6D6BC', dark: '#CDB894' },
        wall: '#2A2622',
      },
      borderRadius: { xl2: '1.25rem', shell: '1.75rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(17,24,39,.04), 0 4px 16px -4px rgba(17,24,39,.06)',
        lift: '0 2px 4px rgba(17,24,39,.04), 0 12px 32px -8px rgba(17,24,39,.12)',
        float: '0 24px 64px -16px rgba(11,17,32,.28)',
        ring: '0 0 0 4px rgba(147,48,78,.12)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        scan: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(250%)' } },
        pulseRing: { '0%': { transform: 'scale(.6)', opacity: '.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        scan: 'scan 1.1s cubic-bezier(.4,0,.2,1) infinite',
        pulseRing: 'pulseRing 1.8s cubic-bezier(.2,.6,.3,1) infinite',
      },
    },
  },
  plugins: [],
}
