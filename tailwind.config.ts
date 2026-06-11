import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        paper: '#ffffff',
      },
      fontFamily: {
        // Single typeface across the console — Saans SemiBold. The mono utility
        // keeps the name (still used semantically for "treat me as monospace-aligned")
        // but resolves to Saans + tabular-nums for OpenType column alignment.
        sans: ['var(--font-saans)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['var(--font-saans)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        ops: '0.12em',
        opsx: '0.16em',
      },
    },
  },
  plugins: [],
}
export default config
