module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: 'rgb(var(--t-bg) / <alpha-value>)',
          card: 'rgb(var(--t-card) / <alpha-value>)',
          sidebar: 'rgb(var(--t-sidebar) / <alpha-value>)',
          border: 'rgb(var(--t-border) / <alpha-value>)',
          hover: 'rgb(var(--t-hover) / <alpha-value>)',
          input: 'rgb(var(--t-input) / <alpha-value>)',
        },
        gold: {
          50: 'rgb(var(--t-accent-50) / <alpha-value>)',
          100: 'rgb(var(--t-accent-100) / <alpha-value>)',
          200: 'rgb(var(--t-accent-200) / <alpha-value>)',
          300: 'rgb(var(--t-accent-300) / <alpha-value>)',
          400: 'rgb(var(--t-accent-400) / <alpha-value>)',
          500: 'rgb(var(--t-accent-500) / <alpha-value>)',
          600: 'rgb(var(--t-accent-600) / <alpha-value>)',
          700: 'rgb(var(--t-accent-700) / <alpha-value>)',
          800: 'rgb(var(--t-accent-800) / <alpha-value>)',
          900: 'rgb(var(--t-accent-900) / <alpha-value>)',
        },
        white: 'rgb(var(--t-white) / <alpha-value>)',
        black: 'rgb(var(--t-black) / <alpha-value>)',
        gray: {
          200: 'rgb(var(--t-gray-200) / <alpha-value>)',
          300: 'rgb(var(--t-gray-300) / <alpha-value>)',
          400: 'rgb(var(--t-gray-400) / <alpha-value>)',
          500: 'rgb(var(--t-gray-500) / <alpha-value>)',
          600: 'rgb(var(--t-gray-600) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
