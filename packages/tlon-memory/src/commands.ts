// src/commands.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { uninstallClient } from './clients';
import { loadConfig, requireConfig, saveConfig } from './config';
import { statusLine } from './hook';
import { NotesClient } from './notes-client';
import { Paths } from './paths';
import { askHidden, confirm } from './prompt';
import { parseFrontMatter } from './render';
import { deleteSessionState, listJobs, listSessionStates } from './state';
import { syncQueue } from './sync';
import { BIN_PATH, SKILL_SOURCE } from './setup';

const flag = (a: string[], n: string) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
const out = (s: string) => process.stdout.write(s + '\n');
const safeName = (s: string) => s.replace(/[^A-Za-z0-9._ ~-]/g, '_').slice(0, 100);

export async function command(cmd: string, args: string[]): Promise<number> {
  const paths = new Paths();
  const cfg = requireConfig(paths);
  const client = new NotesClient({ shipUrl: cfg.shipUrl, apiKey: cfg.apiKey });
  const nb = cfg.notebook!;
  switch (cmd) {
    case 'status': {
      const jobs = listJobs(paths);
      let counts = 'ship not queried';
      try { const notes = await client.listNotes(nb.host, nb.name);
        counts = `conversations: ${notes.filter((n) => n.folderId === nb.conversationsFolderId).length} · memories: ${notes.filter((n) => n.folderId === nb.memoriesFolderId).length}`; }
      catch (e) { counts = `ship unreachable: ${(e as Error).message}`; }
      out(statusLine(cfg, process.cwd(), jobs.length));
      out(`ship: ${cfg.ship} (${cfg.shipUrl}) · notebook: ${nb.host}/${nb.name} · ${counts}`);
      out(`scopes: ${cfg.scopes.join(', ') || '(none)'} · tool I/O: ${cfg.captureToolIo ? 'included' : 'off'} · clients: ${Object.keys(cfg.clients).join(', ') || 'none'}`);
      for (const j of jobs) out(`  pending: ${j.client} ${j.sessionId} attempts=${j.attempts}${j.lastError ? ' last error: ' + j.lastError : ''}`);
      if (cfg.connection.state !== 'ok') out(`connection: ${cfg.connection.state}${cfg.connection.lastError ? ' — ' + cfg.connection.lastError : ''}`);
      return 0;
    }
    case 'pause': cfg.paused = true; saveConfig(paths, cfg); out('Capture paused. Sessions are not uploaded until `tlon-memory resume`.'); return 0;
    case 'resume': cfg.paused = false; saveConfig(paths, cfg); out('Capture resumed.'); return 0;
    case 'scope': {
      const [sub, dir] = args;
      if (sub === 'add' && dir) { const d = resolve(dir); if (!cfg.scopes.includes(d)) cfg.scopes.push(d); saveConfig(paths, cfg); out(`Capture on for ${d}`); return 0; }
      if (sub === 'remove' && dir) { const d = resolve(dir); cfg.scopes = cfg.scopes.filter((s) => s !== d); saveConfig(paths, cfg); out(`Capture off for ${d}`); return 0; }
      out(cfg.scopes.join('\n') || '(no scopes: nothing is captured)'); return 0;
    }
    case 'sync': { const r = await syncQueue(paths, cfg, { budgetMs: 120_000 }); out(`synced ${r.synced}, failed ${r.failed}, remaining ${r.remaining}${r.lastError ? ' — ' + r.lastError : ''}`); return r.failed ? 1 : 0; }
    case 'export': {
      const dir = resolve(flag(args, '--out') ?? join(process.cwd(), `tlon-memory-export-${new Date().toISOString().slice(0, 10)}`));
      mkdirSync(join(dir, 'conversations'), { recursive: true }); mkdirSync(join(dir, 'memories'), { recursive: true });
      const notes = (await client.listNotes(nb.host, nb.name)).filter((n) => n.folderId === nb.conversationsFolderId || n.folderId === nb.memoriesFolderId);
      const index = notes.map((n) => { const kind = n.folderId === nb.memoriesFolderId ? 'memories' : 'conversations';
        const file = join(dir, kind, `${n.id}-${safeName(n.title)}.md`); writeFileSync(file, n.bodyMd);
        return { id: n.id, kind, title: n.title, file, revision: n.revision, updatedAt: n.updatedAt, session_key: parseFrontMatter(n.bodyMd).fields.session_key }; });
      writeFileSync(join(dir, 'index.json'), JSON.stringify({ exportedAt: new Date().toISOString(), ship: cfg.ship, notebook: `${nb.host}/${nb.name}`, notes: index }, null, 2));
      out(`Exported ${index.length} notes to ${dir}`); return 0;
    }
    case 'delete': {
      const yes = args.includes('--yes');
      const session = flag(args, '--session'); const memory = flag(args, '--memory'); const all = args.includes('--all');
      if (!session && !memory && !all) { process.stderr.write('delete needs --session KEY | --memory ID | --all\n'); return 2; }
      if (!yes && !(process.stdin.isTTY && (await confirm('This removes notes from your ship (their revision history goes with them). Continue?', false)))) { process.stderr.write('aborted (pass --yes to skip the prompt)\n'); return 1; }
      const notes = await client.listNotes(nb.host, nb.name); let n = 0;
      const del = async (id: number) => { await client.deleteNote(nb.host, nb.name, id); n++; };
      if (memory) await del(Number(memory));
      if (session) { const [c, ...rest] = session.split(':'); const sid = rest.join(':');
        for (const note of notes) if (note.folderId === nb.conversationsFolderId && parseFrontMatter(note.bodyMd).fields.session_key === session) await del(note.id);
        deleteSessionState(paths, c as any, sid); }
      if (all) { for (const note of notes) if (note.folderId === nb.conversationsFolderId || note.folderId === nb.memoriesFolderId) await del(note.id);
        for (const s of listSessionStates(paths)) deleteSessionState(paths, s.client, s.sessionId); }
      out(`Deleted ${n} note${n === 1 ? '' : 's'}. Not affected: copies already sent to a model provider, other devices' queues, Tlon hosting backups.`); return 0;
    }
    case 'disconnect': {
      for (const c of Object.keys(cfg.clients) as ('claude' | 'codex')[]) { await uninstallClient(c, { binPath: BIN_PATH, skillSource: SKILL_SOURCE }); out(`${c}: hooks, MCP server and skill removed`); }
      if (args.includes('--revoke-key')) { const code = await askHidden('+code (to rotate the Notes API key):'); await NotesClient.regenerateWithCode(cfg.shipUrl, code); out('Notes API key rotated on the ship.'); }
      rmSync(paths.root, { recursive: true, force: true });
      out('Local config, state and queue removed. Notes on your ship were kept; use `export`/`delete` before disconnecting if you want them gone.'); return 0;
    }
    default: return 2;
  }
}
