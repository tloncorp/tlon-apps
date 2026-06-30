import type { FakeModelClient, ReceivedCall } from '../../fake-model/index.js';
import type { ModelScript } from '../../drivers/types.js';

export async function registerModelScript(
  fakeModel: FakeModelClient,
  key: string,
  script: ModelScript
): Promise<string> {
  await fakeModel.script(key, script.steps, script.options ?? {});
  return `[tlon-test:${key}]`;
}

export async function expectModelExpectations(
  fakeModel: FakeModelClient,
  key: string,
  script: ModelScript
): Promise<ReceivedCall[]> {
  const calls = await fakeModel.received(key);
  const expectations = script.expectations;
  if (!expectations) {
    return calls;
  }

  if (
    expectations.expectedCallCount !== undefined &&
    !callCountInExpectedRange(calls.length, script)
  ) {
    const max = maxExpectedCallCount(script);
    throw new Error(
      `Expected ${expectations.expectedCallCount}` +
        (max > expectations.expectedCallCount ? `-${max}` : '') +
        ` model call(s) for ${key}, ` +
        `got ${calls.length}.`
    );
  }

  if (expectations.advertisedTools) {
    assertAllAdvertisedTools(calls, script, key);
  }

  if (expectations.streamedToolLoop) {
    assertStreamedToolLoop(calls, key);
  }

  if (expectations.expectedCallSequence) {
    assertCallSequence(calls, script, key);
  }

  return calls;
}

function callCountInExpectedRange(count: number, script: ModelScript): boolean {
  const expected = script.expectations?.expectedCallCount;
  if (expected === undefined) {
    return true;
  }
  return count >= expected && count <= maxExpectedCallCount(script);
}

function maxExpectedCallCount(script: ModelScript): number {
  return (
    (script.expectations?.expectedCallCount ?? 0) +
    (script.options?.allowExtraCalls ?? 0)
  );
}

export async function expectNoModelCalls(
  fakeModel: FakeModelClient,
  key?: string
): Promise<void> {
  const calls = await fakeModel.received(key);
  if (calls.length > 0) {
    const scope = key ? ` for ${key}` : '';
    const summary = calls
      .map((call) => call.key ?? '<unkeyed>')
      .slice(0, 5)
      .join(', ');
    throw new Error(
      `Expected no model calls${scope}, got ${calls.length}` +
        (summary ? ` (${summary})` : '') +
        `.`
    );
  }
}

function assertAllAdvertisedTools(
  calls: ReceivedCall[],
  script: ModelScript,
  key: string
): void {
  const expected = script.expectations?.advertisedTools;
  if (!expected) {
    return;
  }
  if (calls.length === 0) {
    throw new Error(`Cannot assert advertised tools for ${key}: no model calls.`);
  }
  const expectedCallCount = script.expectations?.expectedCallCount;
  if (expectedCallCount === undefined) {
    calls.forEach((call, index) => {
      assertAdvertisedTools(call, expected, `${key} call #${index + 1}`);
    });
    return;
  }

  const requiredCalls = calls.slice(0, expectedCallCount);
  if (requiredCalls.length < expectedCallCount) {
    throw new Error(
      `Cannot assert advertised tools for ${key}: expected ` +
        `${expectedCallCount} required model call(s), got ${calls.length}.`
    );
  }
  requiredCalls.forEach((call, index) => {
    assertAdvertisedTools(call, expected, `${key} required call #${index + 1}`);
  });

  calls.slice(expectedCallCount).forEach((call, index) => {
    if ((call.toolNames ?? []).length === 0) {
      return;
    }
    assertAdvertisedTools(
      call,
      expected,
      `${key} extra call #${expectedCallCount + index + 1}`
    );
  });
}

function assertAdvertisedTools(
  call: ReceivedCall | undefined,
  expected: NonNullable<ModelScript['expectations']>['advertisedTools'],
  key: string
): void {
  if (!expected) {
    return;
  }
  if (!call) {
    throw new Error(`Cannot assert advertised tools for ${key}: no model calls.`);
  }
  const actual = call.toolNames ?? [];
  const missing = (expected.include ?? []).filter((tool) => !actual.includes(tool));
  const forbidden = (expected.exclude ?? []).filter((tool) => actual.includes(tool));
  if (missing.length > 0 || forbidden.length > 0) {
    throw new Error(
      `Advertised tools mismatch for ${key}: actual=${JSON.stringify(actual)}, ` +
        `missing=${JSON.stringify(missing)}, forbidden=${JSON.stringify(forbidden)}.`
    );
  }
  if (expected.exact) {
    const actualSorted = [...actual].sort();
    const expectedSorted = [...expected.exact].sort();
    if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
      throw new Error(
        `Expected exact advertised tools ${JSON.stringify(expectedSorted)} for ${key}, ` +
          `got ${JSON.stringify(actualSorted)}.`
      );
    }
  }
}

function assertStreamedToolLoop(calls: ReceivedCall[], key: string): void {
  if (calls.length < 2) {
    throw new Error(`Expected streamed tool loop for ${key}, got ${calls.length} call(s).`);
  }
  if (!calls[0].stream) {
    throw new Error(`Expected first model request for ${key} to be streamed.`);
  }
  if (calls[1].messageCount <= calls[0].messageCount) {
    throw new Error(
      `Expected second model request for ${key} to include tool-result history.`
    );
  }
}

function assertCallSequence(
  calls: ReceivedCall[],
  script: ModelScript,
  key: string
): void {
  const expected = script.expectations?.expectedCallSequence ?? [];
  let modelRequestCount = 0;
  let toolStepIndex = 0;
  let textStepIndex = 0;
  for (const item of expected) {
    if (item.kind === 'model_request') {
      modelRequestCount += 1;
      if (calls.length < modelRequestCount) {
        throw new Error(
          `Expected model request #${modelRequestCount} for ${key}, got ${calls.length}.`
        );
      }
      continue;
    }

    if (item.kind === 'tool_call') {
      const toolStep = script.steps
        .slice(toolStepIndex)
        .find((step) => step.kind === 'tool_call');
      if (!toolStep || toolStep.name !== item.toolName) {
        throw new Error(
          `Expected scripted tool call ${item.toolName ?? '(any)'} for ${key}.`
        );
      }
      toolStepIndex = script.steps.indexOf(toolStep) + 1;
      continue;
    }

    const textStep = script.steps
      .slice(textStepIndex)
      .find((step) => step.kind === 'text');
    if (!textStep) {
      throw new Error(`Expected scripted final model text for ${key}.`);
    }
    textStepIndex = script.steps.indexOf(textStep) + 1;
  }
}
