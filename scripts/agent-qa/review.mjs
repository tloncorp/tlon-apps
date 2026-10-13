import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  out,
  root,
  json,
  save,
  model,
  object,
  text,
  strings,
} from './common.mjs';
const result = json(path.join(out, 'result.json'));
if (result.status === 'recorded') {
  try {
    // Make ordinary image/text files from Codex's existing device trace.
    const actions = [];
    for (const line of readFileSync(path.join(out, 'operator.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)) {
      const event = JSON.parse(line),
        item = event.item;
      if (event.type !== 'item.completed' || item?.type !== 'mcp_tool_call')
        continue;
      const images = [];
      for (const content of item.result?.content || [])
        if (content.type === 'image') {
          const name = `action-${actions.length + 1}-${images.length}.png`;
          writeFileSync(
            path.join(out, name),
            Buffer.from(content.data, 'base64')
          );
          images.push(name);
        }
      actions.push({
        tool: item.tool,
        arguments: item.arguments,
        images,
        result: item.result?.content?.filter((c) => c.type === 'text'),
      });
    }
    save(path.join(out, 'actions.json'), actions);
    const nullableTime = { type: ['number', 'null'] };
    const report = await model(
      'review',
      `${readFileSync(path.join(root, '.agents/skills/tlon-workflow/references/pr-reviewer.md'), 'utf8')}
You are the independent recording reviewer, not the device operator. This directory contains session.mp4, actions.json, screenshots, and operator.txt (if the operator finished). Read operator notes as leads, not conclusions. No live device is available.
Use your normal shell tools, ffprobe and ffmpeg to inspect the video: extract contact sheets to locate events, then consecutive native frames around each brief state. Use view_image to actually inspect the resulting images. Sparse frames cannot prove a fast state was absent. Investigate suspicious behavior beyond the starting plan.
Describe explored paths, unreached paths, and findings in plain language. Deduplicate findings. For each finding select at most one start/end interval including the trigger, actual problem and settled outcome, preferably under 30 seconds (max 120). Inspect the entire selected interval; never cut before the problem appears. Set both times null if you cannot substantiate a complete clip. Findings without proof should be labeled uncertain. Do not modify the recording or operator evidence, invent causes, fix code, or claim the PR introduced the behavior. Write frame images under this directory. Finish in six minutes.
PR: ${JSON.stringify(result.pr)}\nRecording duration: ${result.duration}s`,
      {
        schema: object({
          summary: text,
          explored: strings,
          unexplored: strings,
          findings: {
            type: 'array',
            maxItems: 6,
            items: object({
              title: text,
              when: text,
              observed: text,
              expected: text,
              start: nullableTime,
              end: nullableTime,
            }),
          },
        }),
      }
    );
    result.report = report;
    result.status = report.explored.length ? 'completed' : 'incomplete';
    result.summary = report.summary;
  } catch (error) {
    result.status = 'incomplete';
    result.summary = error.message;
  }
  save(path.join(out, 'result.json'), result);
}
