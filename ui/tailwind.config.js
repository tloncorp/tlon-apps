/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable global-require */
const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

const lightColors = {
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F5F5F5',
    100: '#E5E5E5',
    200: '#CCCCCC',
    300: '#B3B3B3',
    400: '#999999',
    500: '#808080',
    600: '#666666',
    700: '#4C4C4C',
    800: '#333333',
    900: '#1A1A1A',
  },
  red: {
    DEFAULT: '#FF6240',
    soft: '#FFEFEC',
  },
  orange: {
    DEFAULT: '#FF9040',
    soft: '#FFF4EC',
  },
  yellow: {
    DEFAULT: '#FADE7A',
    soft: '#FAF5D9',
  },
  green: {
    DEFAULT: '#2AD546',
    soft: '#EAFBEC',
  },
  blue: {
    DEFAULT: '#008EFF',
    soft: '#E5F4FF',
    softer: 'rgba(0, 142, 255, 0.1)',
  },
  indigo: {
    DEFAULT: '#615FD3',
    soft: '#EFEFFB',
  },
};

const darkColors = {
  white: '#000000',
  black: '#FFFFFF',
  gray: {
    50: '#1A1A1A',
    100: '#333333',
    200: '#4C4C4C',
    300: '#666666',
    400: '#808080',
    500: '#999999',
    600: '#B3B3B3',
    700: '#CCCCCC',
    800: '#E5E5E5',
    900: '#F5F5F5',
  },
  red: {
    DEFAULT: '#FF6240',
    soft: colors.red['900'],
  },
  orange: {
    DEFAULT: '#FF9040',
    soft: colors.orange['900'],
  },
  yellow: {
    DEFAULT: '#FADE7A',
    soft: colors.yellow['900'],
  },
  green: {
    DEFAULT: '#2AD546',
    soft: colors.green['900'],
  },
  blue: {
    DEFAULT: '#008EFF',
    soft: colors.blue['900'],
    softer: 'rgba(0, 142, 255, 0.2)',
  },
  indigo: {
    DEFAULT: '#615FD3',
    soft: colors.indigo['900'],
  },
};

const base = {
  theme: {
    colors: lightColors,
  },
};

const dark = {
  theme: {
    colors: darkColors,
  },
};

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // or 'media' or 'class'
  // This disables CSS hovers on mobile, avoiding double-tap scenarios
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    fontFamily: {
      sans: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        'San Francisco',
        'Helvetica Neue',
        'Arial',
        'sans-serif',
      ],
      mono: ['Source Code Pro', 'Roboto mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: ['.625rem', '1rem'],
      sm: ['.75rem', '1rem'],
      base: ['.875rem', '1rem'],
      lg: ['1rem', '1.5rem'],
      xl: ['1.25rem', '2rem'],
      '2xl': ['1.5rem', '2rem'],
      '3xl': ['2rem', '3rem'],
    },
    extend: {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
      },
      minWidth: (theme) => theme('spacing'),
      lineHeight: {
        tight: 1.2,
        snug: 1.33334,
        relaxed: 1.66667,
      },
      boxShadow: {
        xl: '0px 4px 16px rgba(0, 0, 0, 0.20)',
      },
      lineClamp: {
        7: '7',
        8: '8',
        9: '9',
      },
      zIndex: {
        45: '45',
      },
      typography: {
        DEFAULT: {
          css: {
            code: {
              display: 'inline-block',
              padding: '0 0.25rem',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
    },
  },
  screens: {
    ...defaultTheme.screens,
    xl: '1440px',
    '2xl': '2200px',
  },
  variants: {
    extend: {
      opacity: ['hover-none'],
      display: ['group-hover'],
    },
  },
  plugins: [
    require('tailwindcss-scoped-groups')({
      groups: ['one', 'two'],
    }),
    require('@tailwindcss/aspect-ratio'),
    require('tailwindcss-theme-swapper')({
      themes: [
        { name: 'base', selectors: [':root'], theme: base.theme },
        { name: 'dark', selectors: ['.dark'], theme: dark.theme },
      ],
    }),
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
};
