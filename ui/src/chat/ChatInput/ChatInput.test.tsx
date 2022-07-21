import fetch from 'cross-fetch';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { render } from '../../../test/utils';
import ChatInput from './ChatInput';

vi.stubGlobal('fetch', (url: string, init: any) =>
  fetch(`http://localhost:3000${url}`, init)
);

// declare which API requests to mock
const server = setupServer(
  // capture "GET /greeting" requests
  rest.get('/~/scry/chat/draft/*', (req, res, ctx) =>
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

// establish API mocking before all tests
beforeAll(() => server.listen());
// reset any request handlers that are declared as a part of our tests
// (i.e. for testing one-time error scenarios)
afterEach(() => server.resetHandlers());
// clean up once the tests are done
afterAll(() => server.close());

describe('ChatInput', () => {
  it('renders as expected', () => {
    const { asFragment } = render(
      <ChatInput
        whom="~zod/test"
        sendMessage={() => {
          // placeholder;
        }}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
