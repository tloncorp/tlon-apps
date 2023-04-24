/* eslint-disable import/no-extraneous-dependencies */
import colors from 'tailwindcss/colors';

const light = {
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
    softer: '#008EFF1A',
  },
  indigo: {
    DEFAULT: '#615FD3',
    soft: '#EFEFFB',
  },
};

const dark = {
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

export default { light, dark };
