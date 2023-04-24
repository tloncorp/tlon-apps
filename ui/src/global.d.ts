type React = import('react');

type StringifiedWithKey<T> = string & {
  [P in keyof T]: { '_ value': T[P] };
};

type Stringified<T> = string;

declare module '@emoji-mart/react';
declare module 'emoji-mart';
declare module 'react-oembed-container';
namespace JSX {
  interface IntrinsicElements {
    'em-emoji': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & { shortcodes: string },
      HTMLElement
    >;
  }
}

declare module 'urbit-ob' {
  function isValidPatp(ship: string): boolean;
  function clan(ship: string): 'galaxy' | 'star' | 'planet' | 'moon' | 'comet';
}

interface ThemeColors {
  white: string;
  black: string;
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  red: {
    DEFAULT: string;
    soft: string;
  };
  orange: {
    DEFAULT: string;
    soft: string;
  };
  yellow: {
    DEFAULT: string;
    soft: string;
  };
  green: {
    DEFAULT: string;
    soft: string;
  };
  blue: {
    DEFAULT: string;
    soft: string;
    softer: string;
  };
  indigo: {
    DEFAULT: string;
    soft: string;
  };
}

interface Theme {
  light: ThemeColors;
  dark: ThemeColors;
}
