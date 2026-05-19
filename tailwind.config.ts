import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modes/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0a0a', soft: '#141414', card: '#1c1c1e' },
        fg: { DEFAULT: '#fafafa', muted: '#a0a0a0', dim: '#606060' },
        accent: { DEFAULT: '#fbbf24', hover: '#f59e0b' },
        success: '#22c55e',
        warning: '#fbbf24',
        danger: '#ef4444',
        priority: {
          urgent_important: '#e53935',
          not_urgent_important: '#fbc02d',
          urgent_not_important: '#1e88e5',
          not_urgent_not_important: '#43a047',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};

export default config;
