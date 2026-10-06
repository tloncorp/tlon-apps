import { isTrustedBrowserViewerHost } from '@tloncorp/api/client/browserSession';

export type BrowserSecureField = {
  id: string;
  purpose: string;
  label: string;
  inputType:
    | 'text'
    | 'password'
    | 'numeric'
    | 'email'
    | 'tel'
    | 'textarea'
    | 'select';
  required: boolean;
  maxLength?: number;
  exactLength?: number;
  options?: { value: string; label: string }[];
};
export type BrowserCredentialHandoff = {
  fillUrl: string;
  formId: string;
  origin: string;
  expiresAt: number;
  kind: 'login' | 'details';
  fields: BrowserSecureField[];
};
export type BrowserCredentialValues = {
  values: Record<string, string>;
  submit?: boolean;
};

function parseViewerUrl(viewerUrl: string): { url: URL; capability: string } {
  const url = new URL(viewerUrl);
  if (url.protocol !== 'https:' || !isTrustedBrowserViewerHost(url.hostname)) {
    throw new Error('This browser link is not from a trusted Tlon host.');
  }
  if (url.username || url.password)
    throw new Error('This browser link is invalid.');
  const match = /^\/s\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (!match) throw new Error('This browser link is invalid or incomplete.');
  return { url, capability: match[1] };
}

export function trustedBrowserViewerUrl(viewerUrl: string): string {
  return parseViewerUrl(viewerUrl).url.toString();
}

export class BrowserFormError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
async function responseJson(
  response: Response
): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => undefined);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

function parseFields(value: unknown): BrowserSecureField[] {
  const invalid = () => new Error('The browser returned invalid form fields.');
  if (!Array.isArray(value) || !value.length || value.length > 40)
    throw invalid();
  const ids = new Set<string>();
  return value.map((field) => {
    if (
      !field ||
      typeof field !== 'object' ||
      typeof field.id !== 'string' ||
      !/^f\d{1,2}$/.test(field.id) ||
      ids.has(field.id) ||
      typeof field.purpose !== 'string' ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(field.purpose) ||
      typeof field.label !== 'string' ||
      !field.label.length ||
      field.label.length > 256 ||
      ![
        'text',
        'password',
        'numeric',
        'email',
        'tel',
        'textarea',
        'select',
      ].includes(field.inputType) ||
      typeof field.required !== 'boolean' ||
      (field.maxLength !== undefined &&
        (!Number.isSafeInteger(field.maxLength) ||
          field.maxLength < 1 ||
          field.maxLength > 4096)) ||
      (field.exactLength !== undefined &&
        (!Number.isSafeInteger(field.exactLength) ||
          field.exactLength < 1 ||
          field.exactLength > 12))
    )
      throw invalid();
    ids.add(field.id);
    let options: BrowserSecureField['options'];
    if (field.inputType === 'select') {
      if (
        !Array.isArray(field.options) ||
        !field.options.length ||
        field.options.length > 512
      )
        throw invalid();
      const choices = new Set<string>();
      options = field.options.map((option: unknown) => {
        if (
          !option ||
          typeof option !== 'object' ||
          !('value' in option) ||
          !('label' in option) ||
          typeof option.value !== 'string' ||
          !/^\d{1,4}$/.test(option.value) ||
          choices.has(option.value) ||
          typeof option.label !== 'string' ||
          option.label.length > 256
        )
          throw invalid();
        choices.add(option.value);
        return { value: option.value, label: option.label };
      });
    }
    return {
      id: field.id,
      purpose: field.purpose,
      label: field.label,
      inputType: field.inputType,
      required: field.required,
      ...(field.maxLength === undefined ? {} : { maxLength: field.maxLength }),
      ...(field.exactLength === undefined
        ? {}
        : { exactLength: field.exactLength }),
      ...(options ? { options } : {}),
    };
  });
}

export async function beginBrowserCredentialHandoff(
  viewerUrl: string,
  signal?: AbortSignal
): Promise<BrowserCredentialHandoff> {
  const { url, capability } = parseViewerUrl(viewerUrl);
  const response = await fetch(
    new URL(`/credentials/${capability}`, url.origin),
    {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    }
  );
  const body = await responseJson(response);
  if (!response.ok)
    throw new BrowserFormError(
      'Could not find a live secure form. Open the browser or try again.',
      response.status
    );
  if (
    typeof body.handoffId !== 'string' ||
    !/^[A-Za-z0-9_-]{40,64}$/.test(body.handoffId) ||
    typeof body.formId !== 'string' ||
    !body.formId.length ||
    body.formId.length > 256 ||
    typeof body.origin !== 'string' ||
    (body.kind !== 'login' && body.kind !== 'details') ||
    typeof body.expiresAt !== 'number' ||
    !Number.isFinite(body.expiresAt) ||
    body.expiresAt <= Date.now()
  ) {
    throw new Error('The browser returned an invalid secure form.');
  }
  const targetOrigin = new URL(body.origin);
  if (targetOrigin.protocol !== 'https:')
    throw new Error('Secure entry requires an HTTPS website.');
  if (targetOrigin.origin !== body.origin)
    throw new Error('The browser returned an invalid form origin.');
  return {
    fillUrl: new URL(
      `/credential-fills/${body.handoffId}`,
      url.origin
    ).toString(),
    formId: body.formId,
    origin: body.origin,
    kind: body.kind,
    expiresAt: body.expiresAt,
    fields: parseFields(body.fields),
  };
}

export function validBrowserFormValues(
  handoff: BrowserCredentialHandoff,
  values: Record<string, string>
): boolean {
  return (
    Object.values(values).some((value) => value.length > 0) &&
    !Object.keys(values).some(
      (id) => !handoff.fields.some((field) => field.id === id)
    ) &&
    handoff.fields.every((field) => {
      const value = values[field.id];
      if (!value) return !field.required;
      return (
        value.length <= (field.maxLength ?? 4096) &&
        (field.exactLength === undefined ||
          value.length === field.exactLength) &&
        (!field.options ||
          field.options.some((option) => option.value === value))
      );
    })
  );
}

export async function submitBrowserCredentials(
  handoff: BrowserCredentialHandoff,
  values: BrowserCredentialValues,
  signal?: AbortSignal
): Promise<{ submitted: boolean }> {
  if (Date.now() >= handoff.expiresAt)
    throw new Error('This secure form has expired.');
  if (!validBrowserFormValues(handoff, values.values))
    throw new Error('Complete the requested form fields.');
  const response = await fetch(handoff.fillUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      values: values.values,
      submit: handoff.kind === 'login' && values.submit === true,
    }),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });
  const body = await responseJson(response);
  // A site response can echo a submitted value; never forward its error text.
  if (!response.ok)
    throw new BrowserFormError(
      'The form could not be filled. Reconnect before trying again.',
      response.status
    );
  if (body.ok !== true)
    throw new Error('The browser did not confirm that the fields were filled.');
  return { submitted: body.submitted === true };
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error('Canceled'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Wait through navigation/rerenders without treating a missing form as proof of success. */
export async function nextBrowserCredentialHandoff(
  viewerUrl: string,
  formId: string,
  signal: AbortSignal
): Promise<BrowserCredentialHandoff | null> {
  const deadline = Date.now() + 5_000;
  let next: BrowserCredentialHandoff | null = null;
  do {
    await pause(300, signal);
    try {
      next = await beginBrowserCredentialHandoff(viewerUrl, signal);
      if (next.formId !== formId) return next;
    } catch (error) {
      if (!(error instanceof BrowserFormError) || error.status !== 404)
        throw error;
      next = null;
    }
  } while (Date.now() < deadline);
  return next;
}
