type Stringified<T> = string & {
  [P in keyof T]: { '_ value': T[P] };
};

declare module 'react-oembed-container';
