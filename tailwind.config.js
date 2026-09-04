/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f6',
          100: '#e9ece9',
          200: '#d1d7d1',
          300: '#a9b4a9',
          400: '#7c8b7c',
          500: '#5c6d5c',
          600: '#465546',
          700: '#39453a',
          800: '#2c3630',
          900: '#1c231e',
          950: '#0f1410',
        },
        moss: {
          50: '#f2f6ef',
          100: '#e1ebda',
          200: '#c4d8b7',
          300: '#9dbd89',
          400: '#77a161',
          500: '#588243',
          600: '#436633',
          700: '#37522a',
          800: '#2d4224',
          900: '#26371f',
        },
        clay: {
          50: '#fbf4ee',
          100: '#f5e3d3',
          200: '#eac4a4',
          300: '#dc9d6c',
          400: '#cf7c42',
          500: '#c1622c',
          600: '#a34c22',
          700: '#823a1e',
          800: '#69301e',
          900: '#57291b',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 35, 30, 0.06), 0 1px 1px rgba(28, 35, 30, 0.04)',
      },
    },
  },
  plugins: [],
};
