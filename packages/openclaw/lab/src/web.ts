import { STYLE } from './report.js';

// The lab control panel: one static page that talks to serve.ts over a small
// JSON API. Kept dependency-free so `pnpm lab serve` needs nothing extra.

const APP_STYLE = `
main { max-width: 1400px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
nav.tabs { display: flex; gap: 4px; }
nav.tabs a { padding: 6px 12px; border-radius: 7px; color: var(--muted); text-decoration: none; font-size: 14px; }
nav.tabs a.active { background: var(--panel); border: 1px solid var(--line); color: var(--text); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.layout.wide-side { grid-template-columns: minmax(0, 1fr) 440px; }
.layout > div { min-width: 0; }
@media (max-width: 1000px) { .layout, .layout.wide-side { grid-template-columns: 1fr; } }
[hidden] { display: none !important; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.panel h2 { margin: 0 0 10px; }
label { display: block; font-size: 13px; color: var(--muted); margin: 10px 0 4px; }
input[type=text], input[type=number], select, textarea { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--text); font: inherit; }
textarea.code { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; min-height: 560px; resize: vertical; tab-size: 2; }
.row { display: flex; gap: 10px; } .row > * { flex: 1; }
button { font: inherit; font-size: 14px; padding: 7px 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button:disabled { opacity: .45; cursor: default; }
button.link { border: none; background: none; color: var(--accent); padding: 0; font-size: 13px; }
button.seg { border-radius: 0; margin-left: -1px; } button.seg:first-child { border-radius: 7px 0 0 7px; margin-left: 0; } button.seg:last-child { border-radius: 0 7px 7px 0; }
button.seg.on { background: var(--text); color: var(--bg); border-color: var(--text); }
.checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 2px 10px; max-height: 220px; overflow: auto; border: 1px solid var(--line); border-radius: 7px; padding: 8px; }
.checks label { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--text); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.radio label, .inline { display: flex; gap: 6px; align-items: center; color: var(--text); margin: 4px 0; }
.hint { font-size: 12px; color: var(--muted); margin-top: 6px; }
.hint:empty { display: none; }
.muted { color: var(--muted); }
.pill { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.pill.running { color: var(--accent); border-color: var(--accent); }
.pill.done { color: var(--good); border-color: var(--good); }
.pill.failed, .pill.stopped { color: var(--bad); border-color: var(--bad); }
.job { border-top: 1px solid var(--line); padding: 8px 0; }
.job:first-child { border-top: none; }
.job .title { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.job .title > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.job .last { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
pre.log { max-height: 260px; overflow: auto; overflow-wrap: anywhere; font-size: 11.5px; background: var(--bg); border: 1px solid var(--line); border-radius: 7px; padding: 8px; white-space: pre-wrap; margin: 6px 0 0; }
td .sub { display: block; font-size: 12px; color: var(--muted); }
td.pick { width: 28px; text-align: center; }
.order { cursor: pointer; display: inline-block; min-width: 18px; font-size: 11px; font-weight: 600; color: #fff; background: var(--accent); border-radius: 999px; padding: 0 5px; }
.bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; margin-top: 4px; }
.bar > span { display: block; height: 100%; background: var(--accent); }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; font-size: 13px; color: var(--muted); }
.toolbar .spacer { flex: 1; }
.empty { color: var(--muted); font-size: 14px; }
.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 8px 14px; border-radius: 8px; font-size: 14px; opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 10; }
.toast.show { opacity: 1; }
.dirty { color: var(--bad); font-size: 13px; }
.diff { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; border: 1px solid var(--line); border-radius: 7px; overflow: auto; max-height: 680px; }
.diff div { white-space: pre-wrap; padding: 0 8px; overflow-wrap: anywhere; }
.diff .add { background: color-mix(in srgb, var(--good) 16%, transparent); }
.diff .del { background: color-mix(in srgb, var(--bad) 16%, transparent); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--bad) 50%, transparent); }
.diff .gap { color: var(--muted); font-style: italic; }
.error { color: var(--bad); font-size: 13px; white-space: pre-wrap; }
table.overview td.desc { min-width: 280px; }
table.overview td.num, table.overview td.num a { white-space: nowrap; }
table.overview tr.vrow { cursor: pointer; }
table.overview tr.vrow:hover td { background: color-mix(in srgb, var(--accent) 5%, transparent); }
ul.bullets { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
ul.bullets li { margin: 2px 0; }
.fchange { font-size: 12px; white-space: nowrap; }
a.back { font-size: 14px; text-decoration: none; }
.editor-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.editor-head h2 { margin: 0; }
.editor-head .spacer { flex: 1; }
.editor-grid { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; margin-top: 14px; }
@media (max-width: 760px) { .editor-grid { grid-template-columns: 1fr; } }
.files h4 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 14px 0 4px; }
.files h4:first-child { margin-top: 0; }
.files button { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 6px; text-align: left; border: 1px solid transparent; background: none; padding: 5px 7px; font-size: 13px; border-radius: 6px; }
.files button:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.files button.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.files .state { font-size: 11px; color: var(--muted); white-space: nowrap; }
.files .state.changed { color: var(--accent); font-weight: 600; }
.files .oc { font-size: 10px; border: 1px solid var(--line); border-radius: 4px; padding: 0 3px; margin-left: 5px; color: var(--muted); }
.files .legend { font-size: 11.5px; color: var(--muted); margin-top: 12px; line-height: 1.45; }
.sim-chat { max-height: 72vh; overflow: auto; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
.sim-chat .msg { max-width: 94%; }
.sim-chat .issue { font-size: 12px; }
.sim-status { font-size: 13px; color: var(--muted); margin-top: 10px; display: flex; justify-content: space-between; gap: 8px; }
.sim-status:empty { display: none; }
.who { font-size: 12px; color: var(--muted); margin-top: 4px; }
.earlier { font-size: 12.5px; margin-top: 10px; }
.earlier div { display: flex; justify-content: space-between; gap: 8px; }
.tipgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
@media (max-width: 960px) { .tipgrid { grid-template-columns: 1fr; } }
.tipcard { border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px; margin-bottom: 10px; background: var(--bg); }
.tipcard .label { font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 8px; }
.tipcard .text { white-space: pre-wrap; font-size: 14px; margin-top: 4px; }
.tipcard .personal { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); font-size: 14px; white-space: pre-wrap; }
.tipcard .personal .muted { font-size: 12px; }
.tipcard.changed { border-color: var(--accent); }
`;

const SCRIPT = `
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (value) => value == null ? '—' : Math.round(value * 100) + '%';
const num = (value, digits = 2) => value == null ? '—' : Number(value).toFixed(digits);
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const recall = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
let state = null;
let picked = [];
let openJobs = new Set();
let personasInitialized = false;
let overview = [];
const describing = new Set();
const editor = { variant: null, file: null, original: '', parent: null, parentText: null, productionText: null, openclaw: null, readOnly: false, mode: 'edit', files: [] };
const tips = { variant: null, original: '', baseline: '', personal: {}, timer: null };
const sim = { label: null, job: null, timer: null };
const SIM_EMPTY = '<p class="empty">Pick a persona and press Run test to watch one conversation with this variant. About a cent, a minute or two.</p>';

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

async function api(path, body, method) {
  const init = body ? { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined;
  const response = await fetch(path, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

/* ---------- routing ---------- */

function route() {
  const [tab, name] = location.hash.replace('#', '').split('/').map(decodeURIComponent);
  if (tab === 'variants' && name) return { tab, screen: 'editor', variant: name };
  if (tab === 'variants') return { tab, screen: 'list' };
  if (tab === 'tips') return { tab, screen: 'tips' };
  return { tab: 'runs', screen: 'runs' };
}

async function show() {
  const r = route();
  if ((r.screen !== 'editor' || r.variant !== editor.variant) && editorDirty()) {
    if (!confirm('Leave without saving ' + editor.file + '?')) {
      history.replaceState(null, '', '#variants/' + encodeURIComponent(editor.variant));
      return;
    }
    $('#e-editor').value = editor.original;
  }
  document.querySelectorAll('[data-screen]').forEach((el) => { el.hidden = !el.dataset.screen.split(' ').includes(r.screen); });
  document.querySelectorAll('nav.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
  $('#layout').classList.toggle('wide-side', r.screen === 'editor');
  window.scrollTo(0, 0);
  try {
    if (r.screen === 'list') await loadOverview();
    if (r.screen === 'editor') await openEditor(r.variant);
    if (r.screen === 'tips') await loadTipsVariants();
  } catch (error) {
    toast(error.message);
  }
}

window.addEventListener('hashchange', show);
window.addEventListener('beforeunload', (event) => {
  if (editorDirty() || tipsDirty()) event.preventDefault();
});

/* ---------- line diff ---------- */

function lineDiff(before, after) {
  const a = before.split('\\n');
  const b = after.split('\\n');
  const n = a.length, m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(['same', a[i]]); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) out.push(['del', a[i++]]);
    else out.push(['add', b[j++]]);
  }
  while (i < n) out.push(['del', a[i++]]);
  while (j < m) out.push(['add', b[j++]]);
  return out;
}

function renderDiff(before, after) {
  const lines = lineDiff(before, after);
  if (!lines.some(([kind]) => kind !== 'same')) return '<div class="gap">No differences.</div>';
  const keep = new Set();
  lines.forEach(([kind], index) => { if (kind !== 'same') for (let k = index - 3; k <= index + 3; k++) keep.add(k); });
  let html = '';
  let skipped = 0;
  lines.forEach(([kind, text], index) => {
    if (!keep.has(index)) { skipped++; return; }
    if (skipped) { html += '<div class="gap">… ' + skipped + ' unchanged lines</div>'; skipped = 0; }
    html += '<div class="' + kind + '">' + (kind === 'add' ? '+ ' : kind === 'del' ? '− ' : '  ') + esc(text) + '</div>';
  });
  if (skipped) html += '<div class="gap">… ' + skipped + ' unchanged lines</div>';
  return html;
}

/* ---------- runs screen ---------- */

const runSets = () => state.sets.filter((set) => !set.label.startsWith('sim-'));

function renderSets() {
  const sets = runSets();
  if (!sets.length) return '<p class="empty">No run sets yet. Start one on the right.</p>';
  const rows = sets.map((set) => {
    const order = picked.indexOf(set.name);
    const m = set.metrics;
    const judged = set.judged ? set.judged + ' judged' : 'not judged';
    return '<tr>' +
      '<td class="pick">' + (order >= 0
        ? '<span class="order" role="button" title="Remove from comparison" data-unpick="' + esc(set.name) + '">' + (order + 1) + '</span>'
        : '<input type="checkbox" aria-label="Pick for comparison" data-pick="' + esc(set.name) + '">') + '</td>' +
      '<td><b>' + esc(set.label) + '</b><span class="sub" title="' + esc(set.name) + '">' + esc(when(set.createdAt)) + '</span></td>' +
      '<td>' + esc(set.variant || 'baseline') + '<span class="sub">' + esc(set.models.bot.split('/').pop()) + (set.search ? '' : ' · no search') + '</span></td>' +
      '<td class="num">' + set.runs + '/' + set.expected + '<span class="sub">' + judged + (set.errors ? ' · ' + set.errors + ' errors' : '') + '</span></td>' +
      '<td class="num">' + pct(m.outcomeMatched) + '</td>' +
      '<td class="num">' + num(m.conversation) + '</td>' +
      '<td class="num">' + num(m.result) + '</td>' +
      '<td class="num">' + pct(m.keep) + '</td>' +
      '<td class="num">$' + num(m.costUsd) + '</td>' +
      '<td>' + (set.hasReport ? '<a href="/files/' + encodeURIComponent(set.name) + '/report.html" target="_blank">Report</a>' : '') + '</td>' +
      '</tr>';
  }).join('');
  return '<div class="toolbar"><span>Tick sets to compare; the first one ticked is the control.</span>' +
    '<button id="packets" class="primary"' + (picked.length >= 2 && picked.length <= 4 ? '' : ' disabled') + '>Write judging packets (' + picked.length + ')</button>' +
    (picked.length ? '<button class="link" id="clear-picks">Clear</button>' : '') + '</div>' +
    '<div class="scroll"><table><tr><th></th><th>Set</th><th>Variant</th><th>Runs</th><th>Matched</th><th>Conv</th><th>Result</th><th>Came for it</th><th>Cost</th><th></th></tr>' + rows + '</table></div>';
}

function judgingPrompt(name) {
  return 'Judge the lab packets in packages/openclaw/lab/runs/' + name + ' following its INSTRUCTIONS.md: write a verdict JSON next to each packet, then run pnpm lab import on the folder.';
}

function renderJudging() {
  const items = state.judging;
  const older = state.modelComparisons;
  if (!items.length && !older.length) return '<p class="empty">No judging folders yet.</p>';
  const rows = items.map((item) => {
    const share = item.packets ? item.verdicts / item.packets : 0;
    const reports = item.reports.map((file) => '<a href="/files/' + encodeURIComponent(item.name) + '/' + encodeURIComponent(file) + '" target="_blank">' + esc(file.replace(/^compare-?/, '').replace(/\\.html$/, '') || 'compare') + '</a>').join('<br>');
    return '<tr><td><b>' + esc(item.sets.join(' vs ') || item.name) + '</b><span class="sub">' + esc(item.name) + '</span></td>' +
      '<td class="num">' + item.verdicts + '/' + item.packets + '<div class="bar"><span style="width:' + Math.round(share * 100) + '%"></span></div></td>' +
      '<td>' + (reports || '<span class="sub">not imported</span>') + '</td>' +
      '<td style="white-space:nowrap"><button class="link" data-copy="' + esc(item.name) + '">Copy judging prompt</button><br>' +
      '<button class="link" data-import="' + esc(item.name) + '"' + (item.verdicts ? '' : ' disabled') + '>Import verdicts</button></td></tr>';
  }).join('');
  const table = items.length ? '<div class="scroll"><table><tr><th>Comparison</th><th>Verdicts</th><th>Reports</th><th></th></tr>' + rows + '</table></div>' : '';
  const olderList = older.length ? '<h3>Judged by a model</h3>' + older.map((file) => '<div><a href="/files/' + encodeURIComponent(file) + '" target="_blank">' + esc(file) + '</a></div>').join('') : '';
  return table + olderList;
}

function renderJobs() {
  const jobs = state.jobs;
  if (!jobs.length) return '<p class="empty">Nothing started from here yet.</p>';
  return jobs.map((job) => '<div class="job" data-job="' + job.id + '">' +
    '<div class="title"><span>' + esc(job.title) + '</span><span class="pill ' + job.status + '">' + job.status + '</span></div>' +
    '<div class="last">' + esc(job.lastLine || job.args.join(' ')) + '</div>' +
    (job.reportPath && job.status === 'done' ? '<a href="' + job.reportPath + '" target="_blank">Open report</a> · ' : '') +
    '<button class="link" data-toggle="' + job.id + '">' + (openJobs.has(job.id) ? 'Hide log' : 'Show log') + '</button>' +
    (job.status === 'running' ? ' · <button class="link" data-stop="' + job.id + '">Stop</button>' : '') +
    (openJobs.has(job.id) ? '<pre class="log" id="log-' + job.id + '">Loading…</pre>' : '') +
    '</div>').join('');
}

function renderForm() {
  const current = $('#variant').value;
  $('#variant').innerHTML = state.variants.map((v) => '<option>' + esc(v) + '</option>').join('');
  if (current && state.variants.includes(current)) $('#variant').value = current;
  if (!personasInitialized) {
    $('#personas').innerHTML = state.personas.map((p) => '<label title="' + esc(p.wants) + '"><input type="checkbox" name="persona" value="' + esc(p.id) + '" checked> ' + esc(p.id) + '</label>').join('');
    $('#sim-persona').innerHTML = state.personas.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.id) + (p.blank ? ' · blank slate' : '') + '</option>').join('');
    const last = recall('lab.simPersona');
    if (last && state.personas.some((p) => p.id === last)) $('#sim-persona').value = last;
    updatePersonaInfo();
    personasInitialized = true;
  }
  updateEstimate();
}

function selectedPersonas() {
  return [...document.querySelectorAll('input[name=persona]:checked')].map((el) => el.value);
}

function updateEstimate() {
  const count = selectedPersonas().length * (Number($('#repeat').value) || 1);
  const perRun = document.querySelector('input[name=judge]:checked')?.value === 'model' ? 0.14 : 0.006;
  $('#estimate').textContent = count + (count === 1 ? ' run' : ' runs') + ' · roughly $' + (count * perRun).toFixed(2) + (perRun < 0.1 ? ' (Luna only; judge in Claude afterwards)' : ' with the model judge');
}

async function refreshLogs() {
  for (const id of openJobs) {
    const el = $('#log-' + id);
    if (!el) continue;
    const job = await api('/api/jobs/' + id);
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    el.textContent = job.log.join('\\n') || '(no output yet)';
    if (atBottom) el.scrollTop = el.scrollHeight;
  }
}

async function refresh() {
  try {
    state = await api('/api/state');
  } catch (error) {
    $('#sets').innerHTML = '<p class="error">Could not load: ' + esc(error.message) + '</p>';
    return;
  }
  picked = picked.filter((name) => state.sets.some((set) => set.name === name));
  $('#sets').innerHTML = renderSets();
  $('#judging').innerHTML = renderJudging();
  $('#jobs').innerHTML = renderJobs();
  renderForm();
  renderEarlierTests();
  $('#summary').textContent = runSets().length + ' run sets · ' + state.judging.length + ' judging folders';
  await refreshLogs();
  const running = state.jobs.some((job) => job.status === 'running');
  clearTimeout(window.__poll);
  window.__poll = setTimeout(refresh, running ? 2500 : 15000);
}

/* ---------- variants list ---------- */

function renderOverview() {
  const rows = overview.map((v) => {
    const d = v.description;
    const describe = describing.has(v.name)
      ? '<span class="muted">Describing…</span>'
      : d
        ? '<b>' + esc(d.title) + '</b>' + (d.bullets.length ? '<ul class="bullets">' + d.bullets.map((b) => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '')
        : '<button class="link" data-describe="' + esc(v.name) + '">Describe</button>';
    const files = v.files.length
      ? v.files.map((f) => '<div class="fchange"><span>' + esc(f.file) + '</span> <span class="good">+' + f.added + '</span> <span class="bad">−' + f.removed + '</span></div>').join('')
      : '<span class="muted">none</span>';
    const latest = v.runSets[0];
    const runs = latest
      ? v.runSets.length + (v.runSets.length === 1 ? ' set' : ' sets') + '<span class="sub"><a href="/files/' + encodeURIComponent(latest.name) + '/report.html" target="_blank">latest ' + esc(when(latest.createdAt)) + '</a></span>' +
        (v.editedSinceLastRun ? '<span class="sub bad">edited since</span>' : '')
      : '<span class="muted">never run</span>';
    return '<tr class="vrow" data-row="' + esc(v.name) + '" title="Open ' + esc(v.name) + '">' +
      '<td><b>' + esc(v.name) + '</b><span class="sub">from ' + esc(v.parent) + '</span><span class="sub">' + esc(when(v.modifiedAt)) + '</span></td>' +
      '<td class="desc">' + describe + '</td>' +
      '<td>' + files + '</td>' +
      '<td class="num">' + runs + '</td>' +
      '<td>' + (d && v.files.length ? '<button class="link" data-describe="' + esc(v.name) + '" data-force="1">Redescribe</button>' : '') + '</td>' +
      '</tr>';
  }).join('');
  const baseline = '<tr class="vrow" data-row="baseline" title="Open baseline"><td><b>baseline</b><span class="sub">production · read-only</span></td>' +
    '<td class="desc"><span class="muted">What ships today: the plugin’s skills and tlonbot’s prompts. Open it to compare prompts with OpenClaw’s defaults or to test production.</span></td><td></td><td></td><td></td></tr>';
  return '<div class="scroll"><table class="overview"><tr><th>Variant</th><th>What it changes vs its parent</th><th>Files</th><th>Runs</th><th></th></tr>' + rows + baseline + '</table></div>' +
    '<p class="hint">Click a row to open it. Descriptions are written by Luna from the diff against the parent, cached, and redone only when either side changes.</p>';
}

async function loadOverview() {
  overview = await api('/api/variants/overview');
  $('#v-list').innerHTML = renderOverview();
  $('#v-from').innerHTML = ['baseline', ...overview.map((v) => v.name).sort()].map((n) => '<option>' + esc(n) + '</option>').join('');
  for (const v of overview) {
    if (!v.description && !describing.has(v.name)) await describe(v.name, false);
  }
}

async function describe(name, force) {
  describing.add(name);
  $('#v-list').innerHTML = renderOverview();
  try {
    const description = await api('/api/variants/describe', { name, force });
    const row = overview.find((v) => v.name === name);
    if (row) row.description = description;
  } catch (error) {
    toast(error.message);
  } finally {
    describing.delete(name);
    $('#v-list').innerHTML = renderOverview();
  }
}

/* ---------- variant editor ---------- */

function editorDirty() {
  return Boolean(editor.variant && !editor.readOnly && $('#e-editor').value !== editor.original);
}

async function openEditor(name) {
  const switching = editor.variant !== name;
  if (switching) {
    Object.assign(editor, { variant: name, file: null, original: '', mode: 'edit' });
    $('#e-editor').value = '';
    clearTimeout(sim.timer);
    Object.assign(sim, { label: null, job: null });
    $('#sim-chat').innerHTML = SIM_EMPTY;
    $('#sim-status').innerHTML = '';
    $('#sim-run').disabled = false;
  }
  if (!overview.length) overview = await api('/api/variants/overview');
  const row = overview.find((v) => v.name === name);
  if (name !== 'baseline' && !row) throw new Error('No variant named ' + name);
  $('#e-title').textContent = name;
  $('#e-parent').textContent = name === 'baseline' ? 'production · read-only' : 'from ' + row.parent;
  $('#e-desc').textContent = row?.description?.title && row.files.length ? row.description.title : '';
  $('#e-fork').textContent = 'New variant from ' + name + '…';
  $('#sim-variant').textContent = name;
  editor.files = await api('/api/variants/files?variant=' + encodeURIComponent(name));
  const first = editor.file || editor.files.find((f) => f.changed)?.file || 'SKILL.md';
  await openFile(first, true);
  renderEarlierTests();
}

function renderFiles() {
  const baseline = editor.variant === 'baseline';
  const group = (name, title) => '<h4>' + title + '</h4>' + editor.files.filter((f) => f.group === name).map((f) => {
    const status = baseline ? '' : f.changed ? 'changed' : f.overridden ? 'same as parent' : 'inherited';
    return '<button class="' + (f.file === editor.file ? 'on' : '') + '" data-open-file="' + esc(f.file) + '">' +
      '<span>' + esc(f.file) + (f.openclaw ? '<span class="oc" title="OpenClaw ships a default for this file">OC</span>' : '') + '</span>' +
      '<span class="state' + (f.changed ? ' changed' : '') + '">' + status + '</span></button>';
  }).join('');
  $('#e-files').innerHTML = group('onboarding', 'Onboarding') + group('workspace', 'Workspace prompts') +
    '<div class="legend"><b>OC</b>: OpenClaw ships a stock version, so “vs OpenClaw default” works. The onboarding files are Tlon’s own and have no OpenClaw counterpart.</div>';
}

async function openFile(file, force) {
  if (!force && editorDirty() && !confirm('Discard unsaved changes to ' + editor.file + '?')) return;
  const data = await api('/api/variants/file?variant=' + encodeURIComponent(editor.variant) + '&file=' + encodeURIComponent(file));
  Object.assign(editor, { file, original: data.text, parent: data.parent, parentText: data.parentText, productionText: data.productionText, openclaw: data.openclaw, readOnly: data.readOnly });
  $('#e-editor').value = data.text;
  $('#e-editor').readOnly = data.readOnly;
  $('#e-save').hidden = data.readOnly;
  $('#e-exists').textContent = data.exists ? '' : 'Inherited from ' + (data.parent || 'baseline') + '. Saving gives this variant its own copy.';
  renderFiles();
  setMode(editor.mode);
  updateDirty();
}

function diffSources() {
  return {
    parent: editor.readOnly ? null : { label: editor.parent || 'baseline', text: editor.parentText ?? '' },
    production: editor.readOnly ? null : { label: 'production', text: editor.productionText ?? '' },
    openclaw: editor.openclaw ? { label: 'OpenClaw ' + editor.openclaw.version + ' default', text: editor.openclaw.text } : null,
  };
}

function setMode(mode) {
  const sources = diffSources();
  if (mode !== 'edit' && !sources[mode]) mode = 'edit';
  editor.mode = mode;
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === mode);
    if (b.dataset.mode !== 'edit') b.disabled = !sources[b.dataset.mode];
  });
  $('#e-editor').hidden = mode !== 'edit';
  $('#e-diff').hidden = mode === 'edit';
  $('#e-diff-label').textContent = mode === 'edit' ? '' : 'Red: only in ' + sources[mode].label + ' · Green: only in ' + editor.variant;
  const why = [];
  if (!sources.openclaw) why.push('No OpenClaw default: OpenClaw ships stock versions of the workspace prompts marked OC, but ' + editor.file + ' is Tlon’s own.');
  if (editor.readOnly) why.push('Baseline is production, so there’s no parent to compare with.');
  $('#e-why').textContent = why.join(' ');
  if (mode !== 'edit') $('#e-diff').innerHTML = renderDiff(sources[mode].text, $('#e-editor').value);
}

function updateDirty() {
  $('#e-dirty').textContent = editorDirty() ? '● unsaved' : '';
}

async function saveEditor() {
  if (editor.readOnly) return;
  await api('/api/variants/file', { variant: editor.variant, file: editor.file, text: $('#e-editor').value }, 'PUT');
  editor.original = $('#e-editor').value;
  $('#e-exists').textContent = '';
  updateDirty();
  editor.files = await api('/api/variants/files?variant=' + encodeURIComponent(editor.variant));
  renderFiles();
  overview = await api('/api/variants/overview');
  if (editor.file === 'tips.yaml' && tips.variant === editor.variant && !tipsDirty()) openTips(tips.variant);
  toast('Saved ' + editor.file);
}

/* ---------- test conversation ---------- */

function updatePersonaInfo() {
  const persona = state?.personas.find((p) => p.id === $('#sim-persona').value);
  $('#sim-who').textContent = persona ? persona.wants : '';
}

function renderEarlierTests() {
  if (!state || !editor.variant) return;
  const tests = state.sets.filter((set) => set.label.startsWith('sim-') && (set.variant || 'baseline') === editor.variant && set.label !== sim.label).slice(0, 6);
  $('#sim-earlier').innerHTML = tests.length
    ? '<label>Earlier tests</label>' + tests.map((set) => '<div><button class="link" data-sim="' + esc(set.label) + '">' + esc(set.persona || set.label) + '</button><span class="muted">' + esc(when(set.createdAt)) + (set.errors ? ' · error' : '') + '</span></div>').join('')
    : '';
}

async function runSim() {
  if (editorDirty()) await saveEditor();
  const persona = $('#sim-persona').value;
  remember('lab.simPersona', persona);
  const result = await api('/api/sim', { variant: editor.variant, persona, search: $('#sim-search').checked, tips: Number($('#sim-tips').value) || 0 });
  Object.assign(sim, { label: result.label, job: result.job.id });
  $('#sim-chat').innerHTML = '<p class="empty">Starting ' + esc(persona) + '…</p>';
  $('#sim-run').disabled = true;
  pollSim();
  refresh();
}

async function pollSim() {
  clearTimeout(sim.timer);
  const label = sim.label;
  if (!label) return;
  try {
    const view = await api('/api/sim?label=' + encodeURIComponent(label) + '&job=' + (sim.job ?? 0));
    if (label !== sim.label) return;
    const box = $('#sim-chat');
    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 24;
    if (view.html) box.innerHTML = view.html;
    if (view.error) box.insertAdjacentHTML('beforeend', '<pre class="log">' + esc(view.error) + '</pre>');
    if (atBottom) box.scrollTop = box.scrollHeight;
    const running = view.status === 'running';
    const summary = running
      ? 'Running…'
      : view.status === 'done'
        ? 'Finished' + (view.durationMs ? ' in ' + Math.round(view.durationMs / 1000) + 's' : '') + (view.costUsd != null ? ' · $' + view.costUsd.toFixed(3) : '')
        : view.status;
    $('#sim-status').innerHTML = '<span>' + esc(summary) + '</span>' + (view.reportPath && !running ? '<a href="' + view.reportPath + '" target="_blank">Full report</a>' : '');
    $('#sim-run').disabled = running;
    if (running) sim.timer = setTimeout(pollSim, 1500);
  } catch (error) {
    $('#sim-status').textContent = error.message;
    $('#sim-run').disabled = false;
  }
}

/* ---------- tips screen ---------- */

function tipsDirty() {
  return Boolean(tips.variant && tips.variant !== 'baseline' && $('#t-editor').value !== tips.original);
}

function tipSample() {
  return { topic: $('#t-topic').value.trim(), lastOwnerText: $('#t-last').value.trim(), taskName: $('#t-task').value.trim() };
}

async function loadTipsVariants() {
  const list = await api('/api/variants');
  $('#t-variant').innerHTML = list.map((v) => '<option value="' + esc(v.name) + '">' + esc(v.name) + (v.readOnly ? ' (production, read-only)' : '') + '</option>').join('');
  if (!tips.variant) {
    const first = list.find((v) => !v.readOnly && v.files.includes('tips.yaml')) || list.find((v) => !v.readOnly) || list[0];
    await openTips(first.name);
  } else {
    $('#t-variant').value = tips.variant;
  }
}

async function openTips(name) {
  if (tips.variant !== name && tipsDirty() && !confirm('Discard unsaved tip copy?')) {
    $('#t-variant').value = tips.variant;
    return;
  }
  const [data, baseline] = await Promise.all([
    api('/api/variants/file?variant=' + encodeURIComponent(name) + '&file=tips.yaml'),
    api('/api/variants/file?variant=baseline&file=tips.yaml'),
  ]);
  Object.assign(tips, { variant: name, original: data.text, baseline: baseline.text, personal: {} });
  $('#t-variant').value = name;
  $('#t-editor').value = data.text;
  $('#t-editor').readOnly = data.readOnly;
  $('#t-save').hidden = data.readOnly;
  $('#t-note').textContent = data.readOnly
    ? 'Production copy. Pick or create a variant to edit it.'
    : data.exists ? '' : 'This variant uses production copy. Saving creates its tips.yaml.';
  previewTips();
}

async function previewTips() {
  clearTimeout(tips.timer);
  $('#t-dirty').textContent = tipsDirty() ? '● unsaved' : '';
  try {
    const [current, baseline] = await Promise.all([
      api('/api/tips/preview', { yaml: $('#t-editor').value, sample: tipSample() }),
      api('/api/tips/preview', { yaml: tips.baseline, sample: tipSample() }),
    ]);
    $('#t-error').textContent = '';
    const before = Object.fromEntries(baseline.cases.map((c) => [c.id, c.text]));
    $('#t-cases').innerHTML = current.cases.map((c) => {
      const changed = before[c.id] !== c.text;
      const personal = tips.personal[c.id];
      return '<div class="tipcard' + (changed ? ' changed' : '') + '">' +
        '<div class="label"><span>' + esc(c.label) + (changed ? ' · changed from production' : '') + '</span>' +
        '<button class="link" data-personalize="' + esc(c.id) + '">' + (personal ? 'Personalize again' : 'Personalize') + '</button></div>' +
        '<div class="text">' + esc(c.text) + '</div>' +
        (personal ? '<div class="personal"><span class="muted">' + esc(personal.pending ? 'Personalizing…' : personal.note || 'Personalized by Luna' + (personal.costUsd ? ' · $' + personal.costUsd.toFixed(4) : '')) + '</span>' + (personal.text ? '<br>' + esc(personal.text) : '') + '</div>' : '') +
        '</div>';
    }).join('');
  } catch (error) {
    $('#t-error').textContent = error.message;
  }
}

async function saveTips() {
  await api('/api/variants/file', { variant: tips.variant, file: 'tips.yaml', text: $('#t-editor').value }, 'PUT');
  tips.original = $('#t-editor').value;
  $('#t-note').textContent = '';
  previewTips();
  if (editor.variant === tips.variant && editor.file === 'tips.yaml' && !editorDirty()) editor.variant = null;
  toast('Saved tips.yaml to ' + tips.variant);
}

/* ---------- events ---------- */

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  try {
    if (target.dataset.pick) {
      picked = [...picked, target.dataset.pick];
      $('#sets').innerHTML = renderSets();
    } else if (target.dataset.unpick) {
      picked = picked.filter((n) => n !== target.dataset.unpick);
      $('#sets').innerHTML = renderSets();
    } else if (target.id === 'clear-picks') {
      picked = [];
      $('#sets').innerHTML = renderSets();
    } else if (target.id === 'packets') {
      const job = await api('/api/packets', { sets: picked });
      openJobs.add(job.id);
      picked = [];
      toast('Writing packets…');
      refresh();
    } else if (target.dataset.copy) {
      await navigator.clipboard.writeText(judgingPrompt(target.dataset.copy));
      toast('Copied. Paste it into Claude Code.');
    } else if (target.dataset.import) {
      const job = await api('/api/import', { dir: target.dataset.import });
      openJobs.add(job.id);
      toast('Importing verdicts…');
      refresh();
    } else if (target.dataset.toggle) {
      const id = Number(target.dataset.toggle);
      openJobs.has(id) ? openJobs.delete(id) : openJobs.add(id);
      $('#jobs').innerHTML = renderJobs();
      refreshLogs();
    } else if (target.dataset.stop) {
      await api('/api/jobs/' + target.dataset.stop + '/stop', {});
      refresh();
    } else if (target.dataset.personas) {
      const mode = target.dataset.personas;
      const blank = new Set(state.personas.filter((p) => p.blank).map((p) => p.id));
      document.querySelectorAll('input[name=persona]').forEach((el) => {
        el.checked = mode === 'all' || (mode === 'blank' && blank.has(el.value));
      });
      updateEstimate();
    } else if (target.dataset.describe) {
      await describe(target.dataset.describe, target.dataset.force === '1');
    } else if (target.closest('tr[data-row]') && !target.closest('a, button')) {
      location.hash = '#variants/' + encodeURIComponent(target.closest('tr[data-row]').dataset.row);
    } else if (target.closest('[data-open-file]')) {
      await openFile(target.closest('[data-open-file]').dataset.openFile);
    } else if (target.dataset.mode) {
      setMode(target.dataset.mode);
    } else if (target.id === 'e-save') {
      await saveEditor();
    } else if (target.id === 'v-new' || target.id === 'e-fork') {
      const from = target.id === 'e-fork' ? editor.variant : 'baseline';
      if (route().screen !== 'list') {
        location.hash = '#variants';
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      $('#v-new-form').hidden = false;
      $('#v-from').value = from;
      $('#v-name').focus();
    } else if (target.id === 'v-create') {
      const created = await api('/api/variants', { name: $('#v-name').value.trim(), from: $('#v-from').value });
      $('#v-new-form').hidden = true;
      $('#v-name').value = '';
      overview = [];
      refresh();
      location.hash = '#variants/' + encodeURIComponent(created.name);
      toast('Created ' + created.name);
    } else if (target.id === 'sim-run') {
      await runSim();
    } else if (target.dataset.sim) {
      Object.assign(sim, { label: target.dataset.sim, job: null });
      $('#sim-chat').innerHTML = '<p class="empty">Loading…</p>';
      await pollSim();
      renderEarlierTests();
    } else if (target.id === 't-save') {
      await saveTips();
    } else if (target.id === 't-reset') {
      $('#t-editor').value = tips.baseline;
      previewTips();
    } else if (target.dataset.personalize) {
      const id = target.dataset.personalize;
      tips.personal[id] = { pending: true };
      previewTips();
      tips.personal[id] = await api('/api/tips/personalize', { yaml: $('#t-editor').value, sample: tipSample(), id });
      previewTips();
    }
  } catch (error) {
    toast(error.message);
    if (target.id === 'sim-run') $('#sim-run').disabled = false;
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.closest?.('#run-form')) updateEstimate();
  if (target.id === 'sim-persona') updatePersonaInfo();
  if (target.id === 't-variant') await openTips(target.value);
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'e-editor') updateDirty();
  if (target.id === 't-editor' || target.closest?.('#t-sample')) {
    clearTimeout(tips.timer);
    tips.timer = setTimeout(previewTips, 300);
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    const screen = route().screen;
    if (screen === 'editor' && !editor.readOnly) { event.preventDefault(); saveEditor().catch((e) => toast(e.message)); }
    if (screen === 'tips' && !$('#t-save').hidden) { event.preventDefault(); saveTips().catch((e) => toast(e.message)); }
  }
});

$('#run-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const personas = selectedPersonas();
  if (!personas.length) return toast('Pick at least one persona.');
  try {
    const job = await api('/api/runs', {
      variant: $('#variant').value,
      label: $('#label').value.trim(),
      repeat: Number($('#repeat').value),
      concurrency: Number($('#concurrency').value),
      tips: Number($('#tips').value),
      search: $('#search').checked,
      judge: document.querySelector('input[name=judge]:checked').value,
      personas,
    });
    openJobs.add(job.id);
    toast('Run started.');
    refresh();
  } catch (error) {
    toast(error.message);
  }
});

refresh().then(show);
`;

export function renderApp() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Onboarding lab</title><style>${STYLE}${APP_STYLE}</style></head><body><main>
<header><h1>Onboarding lab</h1>
  <nav class="tabs"><a href="#runs" data-tab="runs">Runs</a><a href="#variants" data-tab="variants">Variants</a><a href="#tips" data-tab="tips">Tips</a></nav>
  <span class="muted" id="summary"></span></header>
<div class="layout" id="layout">
  <div>
    <div data-screen="runs">
      <section class="panel"><h2>Run sets</h2><div id="sets"><p class="empty">Loading…</p></div></section>
      <section class="panel"><h2>Comparisons</h2><div id="judging"></div></section>
    </div>
    <div data-screen="list" hidden>
      <section class="panel">
        <div class="toolbar"><h2 style="margin:0;color:var(--text)">Variants</h2><span class="spacer"></span><button id="v-new">New variant…</button></div>
        <div id="v-new-form" hidden class="row" style="align-items:end;margin-bottom:12px">
          <div><label for="v-name">Name</label><input id="v-name" type="text" placeholder="e.g. warmer-welcome"></div>
          <div><label for="v-from">Start from</label><select id="v-from"></select></div>
          <div style="flex:0"><button class="primary" id="v-create">Create</button></div>
        </div>
        <div id="v-list"><p class="empty">Loading…</p></div>
      </section>
    </div>
    <div data-screen="editor" hidden>
      <section class="panel">
        <a class="back" href="#variants">← All variants</a>
        <div class="editor-head"><h2 id="e-title"></h2><span class="muted" id="e-parent"></span><span class="spacer"></span><button id="e-fork"></button></div>
        <div class="hint" id="e-desc"></div>
        <div class="editor-grid">
          <aside class="files" id="e-files"></aside>
          <div>
            <div class="toolbar"><span><button class="seg on" data-mode="edit">Edit</button><button class="seg" data-mode="parent">vs parent</button><button class="seg" data-mode="production">vs production</button><button class="seg" data-mode="openclaw">vs OpenClaw default</button></span><span class="spacer"></span><span class="dirty" id="e-dirty"></span><button class="primary" id="e-save">Save</button></div>
            <div class="hint" id="e-why" style="margin:0 0 6px"></div>
            <div class="hint" id="e-exists" style="margin:0 0 6px"></div>
            <div class="hint" id="e-diff-label" style="margin:0 0 6px"></div>
            <textarea id="e-editor" class="code" spellcheck="false"></textarea>
            <div id="e-diff" class="diff" hidden></div>
            <p class="hint">⌘S saves. A variant only replaces the files it holds; everything else comes from its parent. Running a test saves first.</p>
          </div>
        </div>
      </section>
    </div>
    <div data-screen="tips" hidden>
      <section class="panel">
        <div class="toolbar"><select id="t-variant" style="width:auto"></select><span class="hint" id="t-note"></span><span class="spacer"></span><span class="dirty" id="t-dirty"></span><button id="t-reset">Reset to production</button><button class="primary" id="t-save">Save</button></div>
        <div class="row" id="t-sample">
          <div><label for="t-topic">Setup topic the campaign learned</label><input id="t-topic" type="text" value="NBA, basketball, game highlights"></div>
          <div><label for="t-last">Owner’s latest message</label><input id="t-last" type="text" value="ok thanks"></div>
          <div><label for="t-task">Task name (blank = onboarding task)</label><input id="t-task" type="text" placeholder="internal job name"></div>
        </div>
        <p class="error" id="t-error"></p>
        <div class="tipgrid">
          <div><label>tips.yaml · use {topic}, {purpose}, {task}, {Task}</label><textarea id="t-editor" class="code" spellcheck="false"></textarea></div>
          <div><label>Every tip, as production would render it</label><div id="t-cases"></div></div>
        </div>
      </section>
    </div>
  </div>
  <div>
    <section class="panel" data-screen="runs"><h2>Start a run</h2>
      <form id="run-form">
        <label for="variant">Variant</label><select id="variant"></select>
        <label for="label">Label (optional)</label><input id="label" type="text" placeholder="defaults to the variant name">
        <div class="row">
          <div><label for="repeat">Runs per persona</label><input id="repeat" type="number" min="1" max="5" value="1"></div>
          <div><label for="concurrency">In parallel</label><input id="concurrency" type="number" min="1" max="8" value="4"></div>
        </div>
        <label for="tips">First-week tips (0–5)</label><input id="tips" type="number" min="0" max="5" step="1" value="0">
        <label>Personas <button type="button" class="link" data-personas="all">all</button> · <button type="button" class="link" data-personas="blank">blank-slate</button> · <button type="button" class="link" data-personas="none">none</button></label>
        <div class="checks" id="personas"></div>
        <label class="inline"><input type="checkbox" id="search" checked> Web search</label>
        <div class="radio">
          <label><input type="radio" name="judge" value="claude" checked> Judge in Claude later</label>
          <label><input type="radio" name="judge" value="model"> Judge with a model now</label>
        </div>
        <p class="hint" id="estimate"></p>
        <button class="primary" type="submit">Start run</button>
      </form>
    </section>
    <section class="panel" data-screen="editor" hidden><h2>Test <span id="sim-variant"></span></h2>
      <label for="sim-persona">Persona</label><select id="sim-persona"></select>
      <div class="who" id="sim-who"></div>
      <div class="row" style="align-items:end">
        <div><label for="sim-tips">Tips to simulate</label><input id="sim-tips" type="number" min="0" max="5" value="0"></div>
        <label class="inline" style="margin-bottom:9px"><input type="checkbox" id="sim-search"> Web search</label>
        <button class="primary" id="sim-run" style="flex:0 0 auto">Run test</button>
      </div>
      <div class="earlier" id="sim-earlier"></div>
      <div class="sim-status" id="sim-status"></div>
      <div class="sim-chat" id="sim-chat"></div>
    </section>
    <section class="panel" data-screen="runs list tips"><h2>Jobs</h2><div id="jobs"></div></section>
  </div>
</div>
<div class="toast" id="toast"></div>
</main><script>${SCRIPT}</script></body></html>`;
}
