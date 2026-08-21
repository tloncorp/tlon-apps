import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolFactory,
} from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  TLON_AGENT_TOOL_NAMES,
  registerTlonAgentTools,
} from './tlon-agent-tools.js';

describe('Tlon agent tool registration', () => {
  it('keeps both tool names in one factory entry for OpenClaw 7.1', () => {
    const registerTool = vi.fn();
    const api = { registerTool } as unknown as Pick<
      OpenClawPluginApi,
      'registerTool'
    >;
    const tlonTool = {
      name: 'tlon',
      label: 'Tlon CLI',
      description: 'Test Tlon tool',
      parameters: { type: 'object', properties: {} },
      execute: vi.fn(),
    } as unknown as AnyAgentTool;

    registerTlonAgentTools(api, tlonTool);

    expect(registerTool).toHaveBeenCalledTimes(1);
    const [factory, options] = registerTool.mock.calls[0] as [
      OpenClawPluginToolFactory,
      { names: string[] },
    ];
    expect(options.names).toEqual(TLON_AGENT_TOOL_NAMES);

    const tools = factory({} as Parameters<OpenClawPluginToolFactory>[0]);
    expect(Array.isArray(tools)).toBe(true);
    expect((tools as AnyAgentTool[]).map((tool) => tool.name)).toEqual(
      TLON_AGENT_TOOL_NAMES
    );
  });
});
