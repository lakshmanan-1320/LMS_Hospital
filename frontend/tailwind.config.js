/** @type {import('tailwindcss').Config} */
const defaultColors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

/*
 * Themeable palette.
 * Every color family below is emitted as `rgb(var(--tw-c-<family>-<shade>) / <alpha-value>)`.
 *  - :root keeps the exact original values, so the public site looks the same as before.
 *  - .dashboard-shell swaps them for the dashboard's red (#D01302) + neutral design system.
 */

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// Dashboard scales
const red = {
  50: '#fff5f4', 100: '#fce9e7', 200: '#f8cfca', 300: '#f1a79f', 400: '#e5675b',
  500: '#da2e1e', 600: '#d01302', 700: '#b81002', 800: '#960d02', 900: '#7a0b02', 950: '#450601',
};
const neutral = defaultColors.gray;
const rose = defaultColors.rose;

// Original (public site) values for each overridable family
const originalScales = {
  indigo: defaultColors.indigo,
  violet: defaultColors.violet,
  purple: defaultColors.purple,
  blue: defaultColors.blue,
  sky: defaultColors.sky,
  cyan: defaultColors.cyan,
  slate: defaultColors.slate,
  teal: defaultColors.teal,
  brand: {
    50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
    500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e',
  },
};

// What each family becomes inside the dashboard
const dashboardScales = {
  indigo: red,
  teal: red,
  brand: red,
  violet: rose,
  purple: rose,
  blue: neutral,
  sky: neutral,
  cyan: neutral,
  slate: neutral,
};

// Single-value tokens
const originalTokens = {
  ink: '#191b38',
  muted: '#656b86',
  cream: '#f7f6ff',
  paper: '#ffffff',
  'teal-DEFAULT': '#5558e8',
  'teal-dark': '#4144c7',
  mint: '#e9e8ff',
  coral: '#ffbd59',
  line: '#e6e5f2',
  lavender: '#eeeaff',
};
const dashboardTokens = {
  ink: '#1c1c1c',
  muted: '#6b7280',
  cream: '#f7f7f8',
  'teal-DEFAULT': '#d01302',
  'teal-dark': '#b81002',
  mint: '#fce9e7',
  line: '#e5e7eb',
  lavender: '#fff5f4',
};

const v = (name) => `rgb(var(--tw-c-${name}) / <alpha-value>)`;

const themedColors = {};
for (const family of Object.keys(originalScales)) {
  themedColors[family] = {};
  for (const shade of SHADES) themedColors[family][shade] = v(`${family}-${shade}`);
}
themedColors.teal.DEFAULT = v('teal-DEFAULT');
themedColors.teal.dark = v('teal-dark');
for (const token of ['ink', 'muted', 'cream', 'paper', 'mint', 'coral', 'line', 'lavender']) {
  themedColors[token] = v(token);
}

const buildVars = (scales, tokens) => {
  const out = {};
  for (const [family, scale] of Object.entries(scales)) {
    for (const shade of SHADES) {
      if (scale[shade]) out[`--tw-c-${family}-${shade}`] = hexToRgb(scale[shade]);
    }
  }
  for (const [token, hex] of Object.entries(tokens)) out[`--tw-c-${token}`] = hexToRgb(hex);
  return out;
};

module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/modules/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: themedColors,
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        heading: ['var(--font-jakarta)', 'sans-serif'],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': buildVars(originalScales, originalTokens),
        '.dashboard-shell': buildVars(dashboardScales, dashboardTokens),
      });
    }),
  ],
};
