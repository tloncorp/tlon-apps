#!/usr/bin/env python3
"""Opt-in model evaluation against a local OpenClaw/fake-ship container.

Run once per installed baseline/candidate snapshot with the same model. Only
OPENROUTER_API_KEY is read; config is sent over stdin and isolated state is removed on exit.
Reports contain visible output and tool calls/results, never model reasoning.
The caller must install the intended plugin/skill first. This runner refuses
containers whose Tlon endpoint is not the local fake-ship service.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import uuid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--container', required=True)
    parser.add_argument('--variant', required=True)
    parser.add_argument('--model', default='openrouter/openai/gpt-5.6-luna')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--cases', help='Comma-separated case names; defaults to all')
    args = parser.parse_args()
    key = os.environ['OPENROUTER_API_KEY']
    run_id = uuid.uuid4().hex[:10]
    state = f'/tmp/skill-eval-{run_id}'
    config = f'{state}/openclaw.json'

    def docker(*command, input=None, timeout=300, check=True):
        return subprocess.run(['docker', 'exec', '-i', args.container, *command],
                              input=input, text=True, capture_output=True,
                              timeout=timeout, check=check)

    def tlon(command):
        return docker('/workspace/tlon/node_modules/.bin/tlon', *command, timeout=90).stdout

    endpoint = docker('printenv', 'TLON_URL').stdout.strip()
    if endpoint != 'http://ships:8080':
        raise RuntimeError('This evaluation only runs against http://ships:8080 fake ships')
    listing = docker('openclaw', 'skills', 'list', '--json').stdout
    skills = json.loads(listing[listing.index('{'):]).get('skills', [])
    if not any(skill.get('name') == 'tlon' and skill.get('eligible') for skill in skills):
        raise RuntimeError('Installed tlon skill is not discoverable; fix the runtime before evaluating')
    fingerprints = json.loads(docker('node', '-e', r'''
const fs=require('fs'),crypto=require('crypto');
const paths=['/workspace/tlon/node_modules/@tloncorp/tlon-skill/SKILL.md',
 '/root/.openclaw/workspace/AGENTS.md','/root/.openclaw/workspace/TOOLS.md'];
const refs='/workspace/tlon/node_modules/@tloncorp/tlon-skill/references';
paths.push(...fs.readdirSync(refs).filter(p=>p.endsWith('.md')).map(p=>refs+'/'+p));
console.log(JSON.stringify(Object.fromEntries(paths.map(p=>[p,
 crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))));
''').stdout)
    group = re.search(r'~zod/[a-z0-9-]+', tlon(['groups', 'create', f'Skill Eval {run_id}'])).group()
    notebook = re.search(r'notes/~zod/[a-z0-9-]+', tlon(['channels', 'create', group, 'Research', '--kind', 'notes'])).group()
    tlon(['channels', 'create', group, 'Research Archive', '--kind', 'notes'])
    docker('sh', '-c', f'mkdir -p {state}/workspace')
    docker('node', '-e', 'require("fs").writeFileSync(process.argv[1],"Original evaluation content")', f'{state}/seed.md')
    tlon(['notes', 'note-create', notebook, 'root', 'Experiment', '--body', f'{state}/seed.md'])
    note_id = re.search(r'#(\d+)', tlon(['notes', 'notes', notebook])).group(1)
    chat = re.search(r'chat/~zod/[a-z0-9-]+', tlon(['channels', 'create', group, 'Discussion', '--kind', 'chat'])).group()
    marker = f'EVAL-{run_id}'
    tlon(['posts', 'send', chat, marker])
    prepare = r'''
const fs=require('fs'); const x=JSON.parse(fs.readFileSync(0,'utf8'));
const c=JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json','utf8'));
c.tools.allow=[...new Set([...(c.tools.allow||[]),'read','write','tlon'])];
c.tools.deny=(c.tools.deny||[]).filter(t=>t!=='write' && t!=='read');
fs.cpSync('/root/.openclaw/workspace',x.state+'/workspace',{recursive:true});
// Runtime-managed prompts remain identical within a variant. Every case gets
// a fresh agent session; no accumulated transcript teaches later cases.
c.agents.list=[{id:'eval',workspace:x.state+'/workspace'}];
c.agents.defaults.workspace=x.state+'/workspace';
c.models.providers.openrouter={baseUrl:'https://openrouter.ai/api/v1',apiKey:x.key,api:'openai-completions',models:[{id:x.model.replace(/^openrouter\//,''),name:'Skill evaluation',contextWindow:200000,maxTokens:8192}]};
c.agents.defaults.model.primary=x.model;
fs.writeFileSync(x.config,JSON.stringify(c),{mode:0o600});
'''
    reports = []
    cases = [
        ('discovery', 'Inspect the Tlon tool top-level help and tell me the command syntax for creating and updating a Markdown note. Do not write anything to Tlon.'),
        ('notes', f'In group {group}, find the notebook named Research (not Research Archive) and the note titled Experiment. Replace its body with exactly {marker}-UPDATED and verify the saved content. Use a workspace file for the body.'),
        ('channel', f'Create a notebook channel named New Research in group {group}. Its purpose is to keep research notes. Verify that it exists and report its identity.'),
        ('history', f'Read the recent messages in the Discussion channel of group {group} and report the evaluation marker you find.'),
        ('media', 'Explain how to attach a local workspace image called chart.png to a Tlon message. Inspect the installed guidance and command help; do not upload or send anything.'),
        ('buckets', f'Find the shared Bucket files available in group {group}. If there are none, say so. Do not create a Bucket or upload anything.'),
    ]
    try:
        docker('node', '-e', prepare, input=json.dumps({'state':state,'config':config,'key':key,'model':args.model}))
        for name, prompt in cases:
            if args.cases and name not in args.cases.split(','):
                continue
            session = str(uuid.uuid4())
            response = docker('env', f'OPENCLAW_CONFIG_PATH={config}', f'OPENCLAW_STATE_DIR={state}',
                              'openclaw', 'agent', '--local', '--agent', 'eval', '--session-id', session,
                              '--message', 'Local fake-ship evaluation; these actions are authorized. Use the Tlon skill and tools available to you. Do not send messages or perform onboarding. '+prompt,
                              '--json', '--timeout', '240', timeout=270, check=False)
            # Some core versions prefix JSON with diagnostic text.
            start = response.stdout.find('{')
            payload = json.loads(response.stdout[start:]) if start >= 0 else {}
            meta = payload.get('meta', {})
            session_file = meta.get('agentMeta', {}).get('sessionFile')
            if not session_file:
                session_file = f'{state}/agents/eval/sessions/{session}.jsonl'
            raw = docker('cat', session_file, check=False).stdout
            calls, results = [], []
            for line in raw.splitlines():
                row = json.loads(line).get('message', {})
                for part in row.get('content', []) if isinstance(row.get('content'), list) else []:
                    if part.get('type') == 'toolCall':
                        calls.append({'id':part.get('id'),'name':part.get('name'),'arguments':part.get('arguments')})
                if row.get('role') == 'toolResult':
                    text = '\n'.join(part.get('text','') for part in row.get('content',[]) if part.get('type')=='text')
                    results.append({'id':row.get('toolCallId'),'name':row.get('toolName'),'error':bool(row.get('isError')) or text.startswith(('Error:', 'Blocked:')),'text':text})
            visible = '\n'.join(p.get('text','') for p in payload.get('payloads',[]))
            verification = None
            if name == 'notes':
                saved = tlon(['notes','note',notebook,note_id])
                verification = saved.partition('\n\n')[2].rstrip('\n') == marker+'-UPDATED'
            elif name == 'channel':
                groups = json.loads(tlon(['channels','groups']))
                target = next((item for item in groups if item['id'] == group), {})
                verification = any(channel['title'] == 'New Research' and
                                   channel['nest'].startswith('notes/')
                                   for channel in target.get('channels', []))
            elif name == 'history':
                verification = marker in visible
            report = {'case':name,'exitCode':response.returncode,'visibleOutput':visible,'verifiedState':verification,
                      'toolCalls':calls,'toolResults':results,'toolErrors':sum(r['error'] for r in results),
                      'readCharacters':sum(len(r['text']) for r in results if r['name']=='read'),
                      'systemPromptCharacters':meta.get('systemPromptReport',{}).get('systemPrompt',{}).get('chars'),
                      'usage':meta.get('agentMeta',{}).get('usage')}
            reports.append(report)
            document={'variant':args.variant,'model':args.model,'installedArtifacts':fingerprints,
                      'fixtureGroup':group,'cases':reports}
            encoded=json.dumps(document,indent=2)
            if key in encoded: raise RuntimeError('Refusing to save credential in evaluation output')
            args.output.parent.mkdir(parents=True,exist_ok=True)
            args.output.write_text(encoded)
            print(json.dumps({'variant':args.variant,'case':name,'calls':len(calls),'errors':report['toolErrors'],'verifiedState':verification}),flush=True)
    finally:
        # Core may materialize provider credentials in agent-local model files.
        # Keep only the credential-checked host report, not temporary runtime state.
        docker('rm','-rf',state,check=False)


if __name__ == '__main__':
    main()
