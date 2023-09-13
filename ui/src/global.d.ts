type React = import('react');

type Stringified<T> = string & {
  [P in keyof T]: { '_ value': T[P] };
};

declare module '@emoji-mart/react';
declare module 'emoji-mart';
declare module 'react-oembed-container';
namespace JSX {
  interface IntrinsicElements {
    'em-emoji': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & { shortcodes: string; size?: string },
      HTMLElement
    >;
    'urbit-sigil': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & import('types/sigil').SigilProps
    >;
  }
}

declare module 'urbit-ob' {
  function isValidPatp(ship: string): boolean;
  function clan(ship: string): 'galaxy' | 'star' | 'planet' | 'moon' | 'comet';
}
