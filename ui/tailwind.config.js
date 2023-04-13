/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable global-require */
const defaultTheme = require('tailwindcss/defaultTheme');

function createColorVariants(colorName) {
  return {
    DEFAULT: `var(--color-${colorName})`,
    soft: `var(--color-${colorName}-soft)`,
    softer: `var(--color-${colorName}-softer)`,
  };
}

function createGrayVariants(colorName) {
  const gray = {};
  for (let i = 50; i <= 900; i += 50) {
    gray[i] = `var(--color-${colorName}-${i})`;
  }
  return gray;
}

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
        white: createColorVariants('white'),
        black: createColorVariants('black'),
        gray: createGrayVariants('gray'),
        red: createColorVariants('red'),
        orange: createColorVariants('orange'),
        yellow: createColorVariants('yellow'),
        green: createColorVariants('green'),
        blue: createColorVariants('blue'),
        indigo: createColorVariants('indigo'),
      },
      minWidth: (theme) => theme('spacing'),
      lineHeight: {
        tight: 1.2,
        snug: 1.33334,
        relaxed: 1.66667,
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
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
};
