import '@testing-library/jest-dom';
import fetch from 'cross-fetch';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// Required for React 18+
// See: https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.stubGlobal('fetch', (url: string, init: any) => {
  // console.log(url, init);
  return fetch(`http://localhost:3000${url}`, init);
});

vi.mock('posthog-js', () => ({
  default: {
    init: () => ({}),
    debug: () => ({}),
  },
}));

vi.mock('@react-native-firebase/perf', () => ({
  default: () => ({
    newTrace: (traceName: string) => ({
      start: vi.fn(),
      stop: vi.fn(),
    }),
  }),
}));

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

const server = setupServer(
  // rest.all('*', async (req, res, ctx) => {
  //   const body = await req.json();
  //   console.log(req, body);
  // }),
  rest.put('http://localhost:3000/~/channel/*', (req, res, ctx) => {
    return res(
      ctx.set('Connection', 'keep-alive'),
      ctx.status(204),
      ctx.body('')
    );
  }),
  rest.get('http://localhost:3000/~/channel/*', async (req, res, ctx) => {
    // console.log('event stream', req);
    return res(
      ctx.status(200),
      ctx.set('Connection', 'keep-alive'),
      ctx.set('Content-Type', 'text/event-stream'),
      ctx.body(JSON.stringify('hello'))
    );
  }),
  rest.get('http://localhost:3000/~/scry/chat/draft/*', (req, res, ctx) =>
    // respond using a mocked JSON body
    res(
      ctx.json({
        whom: '~zod/test',
        story: {
          inline: ['test'],
          block: [],
        },
      })
    )
  )
);

server.listen({
  onUnhandledRequest: 'warn',
});

// establish API mocking before all tests
beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'warn',
  })
);
// reset any request handlers that are declared as a part of our tests
// (i.e. for testing one-time error scenarios)
afterEach(() => server.resetHandlers());
// clean up once the tests are done
afterAll(() => server.close());
