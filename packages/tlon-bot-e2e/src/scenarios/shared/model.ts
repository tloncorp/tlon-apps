import type { FakeModelClient, ReceivedCall } from '../../fake-model/index.js';
import type {
  ModelAuxiliaryCallKind,
  ModelScript,
} from '../../drivers/types.js';
import { sleep } from '../../runtime/waiters.js';

export const MODEL_EXPECTATION_SETTLE_MS = 1_500;

export interface ExpectModelExpectationsOptions {
  settleMs?: number;
  settleTimeoutMs?: number;
  pollIntervalMs?: number;
}

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
  script: ModelScript,
  options: ExpectModelExpectationsOptions = {}
): Promise<ReceivedCall[]> {
  assertExtraCallAllowanceIsClassified(script, key);
  const calls = await receivedCallsAfterSettle(
    fakeModel,
    key,
    script,
    options
  );
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

  assertAllowedAuxiliaryCalls(calls, script, key);

  if (expectations.streamedToolLoop) {
    assertStreamedToolLoop(calls, script, key);
  } else if (expectations.toolLoopResult) {
    assertToolLoopResult(calls, script, key);
  }

  if (expectations.expectedCallSequence) {
    assertCallSequence(calls, script, key);
  }

  return calls;
}

async function receivedCallsAfterSettle(
  fakeModel: FakeModelClient,
  key: string,
  script: ModelScript,
  options: ExpectModelExpectationsOptions
): Promise<ReceivedCall[]> {
  const settleMs = options.settleMs ?? MODEL_EXPECTATION_SETTLE_MS;
  if (settleMs <= 0) {
    return fakeModel.received(key);
  }

  const expectedMinimum = script.expectations?.expectedCallCount ?? 0;
  const pollIntervalMs = options.pollIntervalMs ?? Math.min(100, settleMs);
  const settleTimeoutMs =
    options.settleTimeoutMs ?? Math.max(settleMs * 2, settleMs + 500);
  const deadline = Date.now() + settleTimeoutMs;
  let calls = await fakeModel.received(key);
  let lastCount = calls.length;
  let quietSince = Date.now();

  while (Date.now() < deadline) {
    if (
      calls.length >= expectedMinimum &&
      Date.now() - quietSince >= settleMs
    ) {
      return calls;
    }

    await sleep(pollIntervalMs);
    calls = await fakeModel.received(key);
    if (calls.length !== lastCount) {
      lastCount = calls.length;
      quietSince = Date.now();
    }
  }

  return calls;
}

function assertExtraCallAllowanceIsClassified(
  script: ModelScript,
  key: string
): void {
  const allowExtraCalls = script.options?.allowExtraCalls ?? 0;
  if (allowExtraCalls <= 0) {
    return;
  }
  const expectations = script.expectations;
  if ((expectations?.allowedAuxiliaryCalls ?? []).length > 0) {
    return;
  }
  if (expectations?.allowUnclassifiedExtraCallsForDriverQuirk?.reason.trim()) {
    return;
  }
  throw new Error(
    `Model script ${key} allows ${allowExtraCalls} extra call(s) without ` +
      `allowedAuxiliaryCalls or allowUnclassifiedExtraCallsForDriverQuirk.`
  );
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
  const calls = (await fakeModel.received(key)).filter(
    (call) => !isBenignBackgroundModelCall(call)
  );
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

export function isBenignBackgroundModelCall(call: ReceivedCall): boolean {
  return call.key === null && call.userText.startsWith('[OpenClaw heartbeat poll]');
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

function assertAllowedAuxiliaryCalls(
  calls: ReceivedCall[],
  script: ModelScript,
  key: string
): void {
  const expectedCallCount = script.expectations?.expectedCallCount;
  if (expectedCallCount === undefined || calls.length <= expectedCallCount) {
    return;
  }

  const allowed = script.expectations?.allowedAuxiliaryCalls ?? [];
  if (allowed.length === 0) {
    return;
  }

  for (const [offset, call] of calls.slice(expectedCallCount).entries()) {
    if (allowed.some((kind) => auxiliaryCallMatches(call, kind))) {
      continue;
    }
    throw new Error(
      `Unexpected auxiliary model call for ${key} ` +
        `#${expectedCallCount + offset + 1}: ` +
        `${summarizeCallForError(call)}.`
    );
  }
}

function auxiliaryCallMatches(
  call: ReceivedCall,
  kind: ModelAuxiliaryCallKind
): boolean {
  if (kind === 'hermes_title_generation') {
    return isHermesTitleGenerationCall(call);
  }
  return false;
}

function isHermesTitleGenerationCall(call: ReceivedCall): boolean {
  if ((call.toolNames ?? []).length > 0) {
    return false;
  }
  const systemText = call.messages.find((message) => message.role === 'system')
    ?.content?.text;
  return (
    typeof systemText === 'string' &&
    systemText.startsWith('Generate a short, descriptive title') &&
    call.userText.includes('User:') &&
    call.userText.includes('Assistant:')
  );
}

function summarizeCallForError(call: ReceivedCall): string {
  const roles = call.messages.map((message) => message.role).join(',');
  const firstText = call.messages
    .map((message) => message.content?.text)
    .find((text): text is string => typeof text === 'string');
  return (
    `tools=${JSON.stringify(call.toolNames ?? [])}, ` +
    `roles=[${roles}], ` +
    `firstText=${JSON.stringify(firstText?.slice(0, 120) ?? '')}`
  );
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

function assertStreamedToolLoop(
  calls: ReceivedCall[],
  script: ModelScript,
  key: string
): void {
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
  assertToolLoopResult(calls, script, key);
}

function assertToolLoopResult(
  calls: ReceivedCall[],
  script: ModelScript,
  key: string
): void {
  if (calls.length < 2) {
    throw new Error(`Expected tool loop for ${key}, got ${calls.length} call(s).`);
  }
  const expectedTool = script.steps.find((step) => step.kind === 'tool_call');
  if (!expectedTool) {
    throw new Error(`Cannot assert tool loop for ${key}: script has no tool call.`);
  }
  const emittedToolCall = calls[0].responseToolCalls.find(
    (toolCall) => toolCall.function.name === expectedTool.name
  );
  if (!emittedToolCall?.id) {
    throw new Error(
      `Expected first model response for ${key} to emit tool ${expectedTool.name}.`
    );
  }

  const followupMessages = calls[1].messages ?? [];
  const assistantEcho = followupMessages
    .flatMap((message) =>
      message.role === 'assistant' ? message.tool_calls ?? [] : []
    )
    .find((toolCall) => toolCall.id === emittedToolCall.id);
  if (assistantEcho && assistantEcho.function.name !== expectedTool.name) {
    throw new Error(
      `Expected assistant tool call ${emittedToolCall.id} for ${key} to be ` +
        `${expectedTool.name}, got ${assistantEcho.function.name ?? '<missing>'}.`
    );
  }

  const toolResult = followupMessages.find(
    (message) =>
      (message.role === 'tool' || message.role === 'function') &&
      message.tool_call_id === emittedToolCall.id
  );
  if (!toolResult) {
    throw new Error(
      `Expected second model request for ${key} to include a tool-result message ` +
        `with tool_call_id ${emittedToolCall.id}.`
    );
  }
  if (!toolResult.content) {
    throw new Error(
      `Expected tool-result message ${emittedToolCall.id} for ${key} to include ` +
        `sanitized content summary.`
    );
  }
}

function assertCallSequence(
  calls: ReceivedCall[],
  script: ModelScript,
  key: string
): void {
  const expected = script.expectations?.expectedCallSequence ?? [];
  let currentCallIndex = -1;
  let toolStepIndex = 0;
  let textStepIndex = 0;
  for (const item of expected) {
    if (item.kind === 'model_request') {
      currentCallIndex += 1;
      if (calls.length <= currentCallIndex) {
        throw new Error(
          `Expected model request #${currentCallIndex + 1} for ${key}, ` +
            `got ${calls.length}.`
        );
      }
      continue;
    }

    if (item.kind === 'tool_call') {
      const call = calls[currentCallIndex];
      if (!call) {
        throw new Error(
          `Expected a model request before tool call ${item.toolName ?? '(any)'} ` +
            `for ${key}.`
        );
      }
      const expectedToolName =
        item.toolName ?? nextScriptToolName(script, toolStepIndex);
      if (!expectedToolName) {
        throw new Error(`Expected scripted tool call for ${key}.`);
      }
      const emittedTool = call.responseToolCalls.find(
        (toolCall) => toolCall.function.name === expectedToolName
      );
      if (!emittedTool) {
        throw new Error(
          `Expected model response #${currentCallIndex + 1} for ${key} ` +
            `to emit tool ${expectedToolName}, got ${JSON.stringify(
              call.responseToolCalls.map(
                (toolCall) => toolCall.function.name ?? '<missing>'
              )
            )}.`
        );
      }
      toolStepIndex = nextScriptStepIndex(script, toolStepIndex, 'tool_call');
      continue;
    }

    const call = calls[currentCallIndex];
    if (!call) {
      throw new Error(`Expected a model request before final text for ${key}.`);
    }
    const textStep = nextScriptTextStep(script, textStepIndex);
    if (!textStep) {
      throw new Error(`Expected scripted final model text for ${key}.`);
    }
    if (call.responseText !== textStep.content) {
      throw new Error(
        `Expected model response #${currentCallIndex + 1} for ${key} to serve ` +
          `final text ${JSON.stringify(textStep.content)}, got ` +
          `${JSON.stringify(call.responseText ?? '')}.`
      );
    }
    textStepIndex = nextScriptStepIndex(script, textStepIndex, 'text');
  }
}

function nextScriptToolName(
  script: ModelScript,
  startIndex: number
): string | undefined {
  for (let index = startIndex; index < script.steps.length; index += 1) {
    const step = script.steps[index];
    if (step.kind === 'tool_call') {
      return step.name;
    }
  }
  return undefined;
}

function nextScriptTextStep(
  script: ModelScript,
  startIndex: number
): Extract<ModelScript['steps'][number], { kind: 'text' }> | undefined {
  for (let index = startIndex; index < script.steps.length; index += 1) {
    const step = script.steps[index];
    if (step.kind === 'text') {
      return step;
    }
  }
  return undefined;
}

function nextScriptStepIndex(
  script: ModelScript,
  startIndex: number,
  kind: ModelScript['steps'][number]['kind']
): number {
  for (let index = startIndex; index < script.steps.length; index += 1) {
    if (script.steps[index].kind === kind) {
      return index + 1;
    }
  }
  return script.steps.length;
}
