import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F3FF',
          100: '#CCE7FF',
          200: '#99CFFF',
          300: '#66B7FF',
          400: '#339FFF',
          500: '#0078D4',
          600: '#0060AA',
          700: '#004880',
          800: '#003056',
          900: '#00182B',
        },
        secondary: {
          50: '#E6F9FF',
          100: '#CCF3FF',
          200: '#99E7FF',
          300: '#66DBFF',
          400: '#50E6FF',
          500: '#00B7F0',
          600: '#0092C0',
          700: '#006D90',
          800: '#004960',
          900: '#002430',
        },
        success: {
          50: '#E6F5E6',
          100: '#CCEBCC',
          200: '#99D799',
          300: '#66C366',
          400: '#33AF33',
          500: '#107C10',
          600: '#0D630D',
          700: '#0A4A0A',
          800: '#073107',
          900: '#041904',
        },
        warning: {
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#FFB900',
          600: '#CC9400',
          700: '#996F00',
          800: '#664A00',
          900: '#332500',
        },
        danger: {
          50: '#FCE6E7',
          100: '#F9CCCE',
          200: '#F3999D',
          300: '#ED666C',
          400: '#E7333B',
          500: '#D13438',
          600: '#A72A2D',
          700: '#7D1F22',
          800: '#541517',
          900: '#2A0A0B',
        },
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.08)',
        elevated: '0 4px 16px rgba(0, 0, 0, 0.12)',
        dropdown: '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [forms, typography],
};

export default config;
