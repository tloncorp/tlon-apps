import { useEffect, useState } from 'react';

import BrowserHandoffDemo, {
  browserHandoffDemoUrl,
} from './BrowserHandoffDemo.fixture';

// Only these fixture endpoints are intercepted. The real card, sheet,
// validation, and native inputs run unchanged; no entered value leaves the app.
export default function BrowserCredentialChatFixture() {
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    const viewer = new URL(browserHandoffDemoUrl);
    const formUrl = `${viewer.origin}/credentials/${viewer.pathname.slice(3)}`;
    const handoffId = 'wikipedia-design-fixture-handoff-000000000000';
    const fillUrl = `${viewer.origin}/credential-fills/${handoffId}`;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const fixtureFetch: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url === formUrl) {
        if (init?.method === 'DELETE') return json({ ok: true });
        return json({
          handoffId,
          formId: 'wikipedia-login',
          origin: 'https://www.wikipedia.org',
          kind: 'login',
          expiresAt: Date.now() + 60 * 60 * 1000,
          fields: [
            {
              id: 'f1',
              purpose: 'username',
              label: 'Email',
              inputType: 'email',
              required: true,
            },
            {
              id: 'f2',
              purpose: 'current-password',
              label: 'Password',
              inputType: 'password',
              required: true,
            },
          ],
        });
      }
      if (url === fillUrl) {
        setSubmitted(true);
        return json({ ok: true, submitted: false });
      }
      return originalFetch(input, init);
    };
    globalThis.fetch = fixtureFetch;
    setReady(true);
    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);
  return ready ? (
    <BrowserHandoffDemo credentialOnly submitted={submitted} />
  ) : null;
}
