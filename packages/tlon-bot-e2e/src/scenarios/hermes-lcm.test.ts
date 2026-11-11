import { beforeAll, describe, expect, test } from 'vitest';

import {
  HERMES_LCM_ENABLED,
  assertLcmGrepRecalls,
  hermesLcmTools,
} from '../drivers/hermes.js';
import { FakeModelClient } from '../fake-model/index.js';
import { botService, runtimeContextFromEnv } from '../runtime/context.js';
import { execInComposeService } from '../runtime/docker-direct.js';
import { requireEnv } from '../runtime/util.js';
import { actorFromEnv, normalizeShip } from '../tlon/index.js';

// Drives one owner DM past the LCM compaction threshold, then checks that the
// LCM engine (hermes-lcm or lcm-x) summarised the overflow into its SQLite DAG
// and that lcm_grep recovers detail from the compacted turns. run.ts gives this
// file its own stack with a small compaction budget (the driver's
// lcm-compaction variant).
describe.skipIf(!HERMES_LCM_ENABLED)('Hermes LCM context engine', () => {
  const fakeModel = new FakeModelClient(requireEnv('FAKE_MODEL_BASE_URL'));
  const botShip = normalizeShip(requireEnv('TLON_SHIP'));
  const owner = actorFromEnv('TEST_USER');
  const runId = Date.now().toString(36);
  const turns = Number(process.env.TLON_E2E_HERMES_LCM_TURNS ?? '10');

  beforeAll(async () => {
    await fakeModel.reset();
  });

  test('long DM compacts into summary_nodes and lcm_grep recalls it', async () => {
    const markers: string[] = [];
    for (let i = 0; i < turns; i += 1) {
      const key = `lcm-turn-${runId}-${i}`;
      const marker = `lcmmarker${runId}t${i}`;
      markers.push(marker);
      await fakeModel.script(
        key,
        [
          { kind: 'text', content: longReply(marker, i) },
          // Later LCM summariser calls whose newest tag is this key consume
          // these instead of failing on an exhausted script.
          // lcm-x accepts a summary only inside an envelope that repeats the
          // nonce from its summariser prompt; hermes-lcm takes plain text.
          ...Array.from({ length: 6 }, (_, n) => {
            const summary = `Summary ${n} of earlier turns: the assistant described ${marker} at length.`;
            return {
              kind: 'text' as const,
              content: summary,
              echo: {
                pattern: '<lcm-summary nonce="([0-9a-f]+)">',
                template: [
                  '<lcm-summary nonce="$1">',
                  `${summary} It counted boats in the harbour and recorded each hull colour.`,
                  `Expand for details about: ${marker} harbour survey`,
                  '</lcm-summary>',
                ].join('\n'),
              },
            };
          }),
        ],
        { allowedAuxiliaryCalls: ['hermes_title_generation'] }
      );
      const result = await owner.promptDm(
        botShip,
        `[tlon-test:${key}] Turn ${i}: describe ${marker} in detail.`,
        { timeoutMs: 120_000 }
      );
      expect(result.success, result.error).toBe(true);
      expect(result.text).toContain(marker);
    }

    const grepKey = `lcm-grep-${runId}`;
    const finalText = `lcm_grep completed ${runId}`;
    await fakeModel.script(
      grepKey,
      [
        {
          kind: 'tool_call',
          name: 'lcm_grep',
          args: { query: markers[0] },
        },
        { kind: 'text', content: finalText },
      ],
      { allowedAuxiliaryCalls: ['hermes_title_generation'], allowExtraCalls: 4 }
    );
    const grepResult = await owner.promptDm(
      botShip,
      `[tlon-test:${grepKey}] Search your memory for ${markers[0]}.`,
      { timeoutMs: 120_000 }
    );
    expect(grepResult.success, grepResult.error).toBe(true);
    expect(grepResult.text).toContain(finalText);

    const received = await fakeModel.received();
    const primary = received.filter(
      (call) => (call.toolNames ?? []).length > 0
    );
    expect(primary.length).toBeGreaterThan(0);
    for (const call of primary) {
      expect(call.toolNames).toEqual(
        expect.arrayContaining(['tlon', ...hermesLcmTools()])
      );
    }
    const grepCalls = received.filter((call) => call.key === grepKey);
    const toolMessage = (grepCalls.at(-1)?.messages ?? []).find(
      (message) => message.role === 'tool'
    );
    const toolText = toolMessage?.content?.text ?? '';
    console.log(
      `[hermes-lcm] lcm_grep result preview: ${toolText.slice(0, 300)}`
    );
    expect(toolText).not.toMatch(/unknown tool|not available|Traceback/i);
    expect(
      toolMessage?.content?.truncated,
      'lcm_grep result was truncated by the fake-model preview cap'
    ).toBeFalsy();
    assertLcmGrepRecalls(toolText, markers[0]);

    const db = await queryLcmDb();
    console.log(`[hermes-lcm] db: ${JSON.stringify(db, null, 2)}`);
    expect(db.messages).toBeGreaterThanOrEqual(turns * 2);
    expect(db.summaryNodes.length).toBeGreaterThan(0);
  });
});

function longReply(marker: string, turn: number): string {
  const sentence =
    `Turn ${turn} detail about ${marker}: the quick brown fox surveys the ` +
    `harbour, counts ${turn * 7 + 3} boats, and records each hull colour. `;
  // Kept under the adapter's single-post limit so each reply lands as one
  // post and the next turn's DM baseline cannot catch a trailing chunk.
  return `${marker} ` + sentence.repeat(20) + ` ${marker}`;
}

interface LcmDbSnapshot {
  path: string;
  messages: number;
  summaryNodes: Array<{
    node_id: number;
    depth: number;
    token_count: number;
    source_token_count: number;
    summary_head: string;
  }>;
}

async function queryLcmDb(): Promise<LcmDbSnapshot> {
  const script = String.raw`
import json, os, sqlite3
path = os.environ.get("LCM_DATABASE_PATH") or os.path.join(os.environ["HERMES_HOME"], "lcm.db")
con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
messages = con.execute("select count(*) from messages").fetchone()[0]
nodes = [
    {"node_id": r[0], "depth": r[1], "token_count": r[2], "source_token_count": r[3], "summary_head": r[4][:160]}
    for r in con.execute("select node_id, depth, token_count, source_token_count, summary from summary_nodes order by node_id")
]
print(json.dumps({"path": path, "messages": messages, "summaryNodes": nodes}))
`;
  const ctx = runtimeContextFromEnv();
  const result = await execInComposeService(ctx, botService(ctx), [
    '/opt/hermes-venv/bin/python',
    '-c',
    script,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(
      `LCM DB query failed with exit ${result.exitCode}: ` +
        `${(result.stderr || result.stdout).trim()}`
    );
  }
  return JSON.parse(result.stdout.trim()) as LcmDbSnapshot;
}
