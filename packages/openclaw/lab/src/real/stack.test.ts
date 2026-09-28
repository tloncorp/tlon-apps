import { describe, expect, it } from 'vitest';

import { sandboxPromptVariables } from './stack.js';

describe('sandboxPromptVariables', () => {
  it('reads every variable the sandbox script fills into prompts', () => {
    const script = [
      `docker exec -i "$bot" sh -c "envsubst '\\\${TLON_SHIP} \\\${TLON_OWNER_URL} \\\${MODEL}' > \\"\\$DST\\""`,
      `docker exec -i "$bot" sh -c "envsubst '\\\${TLON_SHIP} \\\${TLON_OWNER_CONFIG_PATH}' > \\"\\$DST\\""`,
    ].join('\n');

    expect(sandboxPromptVariables(script)).toEqual([
      'TLON_SHIP',
      'TLON_OWNER_URL',
      'MODEL',
      'TLON_OWNER_CONFIG_PATH',
    ]);
  });
});
