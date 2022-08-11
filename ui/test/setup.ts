// Required for React 18+
// See: https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom';

// Prevent vite from failing when resizeObserver is used

Object.defineProperty(global, 'ResizeObserver', {
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

Object.defineProperty(window, 'ship', {
  writable: true,
  value: 'finned-palmer',
});

Object.defineProperty(window, 'our', {
  writable: true,
  value: '~finned-palmer',
});

// This prevents vite from failing when testing media queries that use matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
