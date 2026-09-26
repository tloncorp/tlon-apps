import { STYLE } from './report.js';

// The lab control panel: one static page that talks to serve.ts over a small
// JSON API. Kept dependency-free so `pnpm lab serve` needs nothing extra.

const APP_STYLE = `
main { max-width: 1320px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
nav.tabs { display: flex; gap: 4px; }
nav.tabs a { padding: 6px 12px; border-radius: 7px; color: var(--muted); text-decoration: none; font-size: 14px; }
nav.tabs a.active { background: var(--panel); border: 1px solid var(--line); color: var(--text); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.layout > div { min-width: 0; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
[hidden] { display: none !important; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.panel h2 { margin: 0 0 10px; }
label { display: block; font-size: 13px; color: var(--muted); margin: 10px 0 4px; }
input[type=text], input[type=number], select, textarea { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--text); font: inherit; }
textarea.code { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; min-height: 460px; resize: vertical; tab-size: 2; }
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
.filetabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.filetabs button { font-size: 13px; padding: 4px 10px; }
.filetabs button.on { border-color: var(--accent); color: var(--accent); }
.dirty { color: var(--bad); font-size: 13px; }
.diff { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; border: 1px solid var(--line); border-radius: 7px; overflow: auto; max-height: 600px; }
.diff div { white-space: pre-wrap; padding: 0 8px; overflow-wrap: anywhere; }
.diff .add { background: color-mix(in srgb, var(--good) 16%, transparent); }
.diff .del { background: color-mix(in srgb, var(--bad) 16%, transparent); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--bad) 50%, transparent); }
.diff .gap { color: var(--muted); font-style: italic; }
.tipgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
@media (max-width: 960px) { .tipgrid { grid-template-columns: 1fr; } }
.tipcard { border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px; margin-bottom: 10px; background: var(--bg); }
.tipcard .label { font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 8px; }
.tipcard .text { white-space: pre-wrap; font-size: 14px; margin-top: 4px; }
.tipcard .personal { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); font-size: 14px; white-space: pre-wrap; }
.tipcard .personal .muted { font-size: 12px; }
.tipcard.changed { border-color: var(--accent); }
.error { color: var(--bad); font-size: 13px; white-space: pre-wrap; }
table.overview td.desc { min-width: 280px; }
table.overview td.num, table.overview td.num a { white-space: nowrap; }
table.overview tr.current td { background: color-mix(in srgb, var(--accent) 7%, transparent); }
table.overview tr.vrow { cursor: pointer; }
table.overview tr.vrow:hover td { background: color-mix(in srgb, var(--accent) 4%, transparent); }
ul.bullets { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
ul.bullets li { margin: 2px 0; }
.fchange { font-size: 12px; white-space: nowrap; }
.muted { color: var(--muted); }
`;

const SCRIPT = `
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (value) => value == null ? '—' : Math.round(value * 100) + '%';
const num = (value, digits = 2) => value == null ? '—' : Number(value).toFixed(digits);
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
let state = null;
let picked = [];
let openJobs = new Set();
let personasInitialized = false;
let variants = [];
const editor = { variant: null, file: 'SKILL.md', original: '', parent: null, parentText: null, productionText: null, openclaw: null, readOnly: false, mode: 'edit' };
const tips = { variant: null, original: '', baseline: '', cases: [], personal: {}, timer: null };
let overview = [];
const describing = new Set();

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

/* ---------- tabs ---------- */

function currentTab() {
  const tab = location.hash.replace('#', '');
  return ['runs', 'variants', 'tips'].includes(tab) ? tab : 'runs';
}

function showTab() {
  const tab = currentTab();
  document.querySelectorAll('[data-tab]').forEach((el) => { el.hidden = el.dataset.tab !== tab; });
  document.querySelectorAll('nav.tabs a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + tab));
  if (tab === 'variants' && !editor.variant) loadVariants();
  if (tab === 'variants') loadOverview().catch((e) => toast(e.message));
  if (tab === 'tips' && !tips.variant) loadVariants();
}

window.addEventListener('hashchange', showTab);
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

/* ---------- runs tab ---------- */

function renderSets() {
  const sets = state.sets;
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

function personaOptions() {
  return state.personas.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.id) + (p.blank ? ' (blank slate)' : '') + '</option>').join('');
}

function renderForm() {
  const options = state.variants.map((v) => '<option>' + esc(v) + '</option>').join('');
  for (const id of ['#variant', '#try-variant']) {
    const el = $(id);
    const current = el.value;
    el.innerHTML = options;
    if (current && state.variants.includes(current)) el.value = current;
  }
  if (editor.variant) $('#try-variant').value = editor.variant;
  if (!personasInitialized) {
    $('#personas').innerHTML = state.personas.map((p) => '<label title="' + esc(p.wants) + '"><input type="checkbox" name="persona" value="' + esc(p.id) + '" checked> ' + esc(p.id) + '</label>').join('');
    $('#try-persona').innerHTML = personaOptions();
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
  $('#summary').textContent = state.sets.length + ' run sets · ' + state.judging.length + ' judging folders';
  await refreshLogs();
  const running = state.jobs.some((job) => job.status === 'running');
  clearTimeout(window.__poll);
  window.__poll = setTimeout(refresh, running ? 2500 : 15000);
}

async function startRun(body, message) {
  const job = await api('/api/runs', body);
  openJobs.add(job.id);
  toast(message);
  refresh();
}

/* ---------- variants tab ---------- */

function renderOverview() {
  if (!overview.length) return '<p class="empty">No variants yet. Create one below.</p>';
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
    return '<tr class="vrow' + (v.name === editor.variant ? ' current' : '') + '" data-row="' + esc(v.name) + '" title="Open ' + esc(v.name) + ' in the editor">' +
      '<td><b>' + esc(v.name) + '</b><span class="sub">from ' + esc(v.parent) + '</span><span class="sub">' + esc(when(v.modifiedAt)) + '</span></td>' +
      '<td class="desc">' + describe + '</td>' +
      '<td>' + files + '</td>' +
      '<td class="num">' + runs + '</td>' +
      '<td style="white-space:nowrap"><button class="link" data-edit="' + esc(v.name) + '">Edit</button><br>' +
      '<button class="link" data-try="' + esc(v.name) + '">Try it</button><br>' +
      (d && v.files.length ? '<button class="link" data-describe="' + esc(v.name) + '" data-force="1">Redescribe</button>' : '') + '</td>' +
      '</tr>';
  }).join('');
  return '<div class="scroll"><table class="overview"><tr><th>Variant</th><th>What it changes vs its parent</th><th>Files</th><th>Runs</th><th></th></tr>' + rows + '</table></div>' +
    '<p class="hint">Descriptions are written by Luna from the diff against the parent, cached, and redone only when either side changes.</p>';
}

async function loadOverview() {
  overview = await api('/api/variants/overview');
  $('#v-list').innerHTML = renderOverview();
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

function editorDirty() {
  return !editor.readOnly && editor.variant && $('#v-editor').value !== editor.original;
}

async function loadVariants() {
  variants = await api('/api/variants');
  const options = variants.map((v) => '<option value="' + esc(v.name) + '">' + esc(v.name) + (v.readOnly ? ' (read-only)' : '') + '</option>').join('');
  $('#v-select').innerHTML = options;
  $('#v-from').innerHTML = variants.map((v) => '<option>' + esc(v.name) + '</option>').join('');
  $('#t-variant').innerHTML = options;
  if (!editor.variant) {
    const first = variants.find((v) => !v.readOnly) || variants[0];
    await openVariant(first.name, 'SKILL.md');
  } else {
    $('#v-select').value = editor.variant;
  }
  if (!tips.variant) {
    const first = variants.find((v) => !v.readOnly && v.files.includes('tips.yaml')) || variants.find((v) => !v.readOnly) || variants[0];
    await openTips(first.name);
  } else {
    $('#t-variant').value = tips.variant;
  }
}

function renderFileTabs() {
  const variant = variants.find((v) => v.name === editor.variant);
  const shown = variant.readOnly ? ['SKILL.md', 'coordinator.yaml', 'tips.yaml'] : variant.files;
  const present = shown.includes(editor.file) ? shown : [...shown, editor.file];
  const others = (window.__editable || []).filter((file) => !present.includes(file));
  $('#v-files').innerHTML = present.map((file) => '<button class="' + (file === editor.file ? 'on' : '') + '" data-file="' + esc(file) + '">' + esc(file) + '</button>').join('') +
    (others.length ? '<select id="v-add"><option value="">+ override another file…</option>' + others.map((f) => '<option>' + esc(f) + '</option>').join('') + '</select>' : '');
  const addSelect = $('#v-add');
  if (addSelect) addSelect.style.width = 'auto';
}

async function openVariant(name, file) {
  if (editorDirty() && !confirm('Discard unsaved changes to ' + editor.file + '?')) {
    $('#v-select').value = editor.variant;
    return;
  }
  const data = await api('/api/variants/file?variant=' + encodeURIComponent(name) + '&file=' + encodeURIComponent(file));
  Object.assign(editor, { variant: name, file, original: data.text, parent: data.parent, parentText: data.parentText, productionText: data.productionText, openclaw: data.openclaw, readOnly: data.readOnly });
  const variant = variants.find((v) => v.name === name);
  $('#v-select').value = name;
  $('#v-parent').textContent = variant.readOnly ? 'What the lab uses when a variant doesn’t replace a file.' : 'Based on ' + (variant.parent || 'baseline') + '.';
  $('#v-editor').value = data.text;
  $('#v-editor').readOnly = data.readOnly;
  $('#v-save').hidden = data.readOnly;
  $('#v-exists').textContent = data.exists ? '' : 'Not overridden yet: this is the ' + (data.parent || 'baseline') + ' version. Saving creates the override.';
  $('#try-variant').value = name;
  renderFileTabs();
  setEditorMode(editor.mode);
  updateEditorStatus();
}

function diffSources() {
  return {
    parent: editor.readOnly ? null : { label: editor.parent || 'baseline', text: editor.parentText ?? '' },
    production: editor.readOnly ? null : { label: 'production', text: editor.productionText ?? '' },
    openclaw: editor.openclaw ? { label: 'OpenClaw ' + editor.openclaw.version + ' default', text: editor.openclaw.text } : null,
  };
}

function setEditorMode(mode) {
  const sources = diffSources();
  if (mode !== 'edit' && !sources[mode]) mode = 'edit';
  editor.mode = mode;
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === mode);
    if (b.dataset.mode !== 'edit') {
      b.disabled = !sources[b.dataset.mode];
      b.title = sources[b.dataset.mode] ? '' : b.dataset.mode === 'openclaw' ? 'OpenClaw has no stock template for this file' : 'Not applicable to baseline';
    }
  });
  $('#v-editor').hidden = mode !== 'edit';
  $('#v-diff').hidden = mode === 'edit';
  $('#v-diff-label').textContent = mode === 'edit' ? '' : 'Red: only in ' + sources[mode].label + ' · Green: only in ' + editor.variant;
  if (mode !== 'edit') $('#v-diff').innerHTML = renderDiff(sources[mode].text, $('#v-editor').value);
}

function updateEditorStatus() {
  $('#v-dirty').textContent = editorDirty() ? '● unsaved' : '';
}

async function saveEditor() {
  if (editor.readOnly) return;
  await api('/api/variants/file', { variant: editor.variant, file: editor.file, text: $('#v-editor').value }, 'PUT');
  editor.original = $('#v-editor').value;
  $('#v-exists').textContent = '';
  variants = await api('/api/variants');
  renderFileTabs();
  updateEditorStatus();
  if (editor.file === 'tips.yaml' && tips.variant === editor.variant) openTips(tips.variant);
  loadOverview().catch((e) => toast(e.message));
  toast('Saved ' + editor.file);
}

/* ---------- tips tab ---------- */

function tipsDirty() {
  const variant = variants.find((v) => v.name === tips.variant);
  return variant && !variant.readOnly && $('#t-editor').value !== tips.original;
}

function tipSample() {
  return { topic: $('#t-topic').value.trim(), lastOwnerText: $('#t-last').value.trim(), taskName: $('#t-task').value.trim() };
}

async function openTips(name) {
  if (tipsDirty() && !confirm('Discard unsaved tip copy?')) {
    $('#t-variant').value = tips.variant;
    return;
  }
  const data = await api('/api/variants/file?variant=' + encodeURIComponent(name) + '&file=tips.yaml');
  const baseline = await api('/api/variants/file?variant=baseline&file=tips.yaml');
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
    tips.cases = current.cases;
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
  variants = await api('/api/variants');
  previewTips();
  if (editor.variant === tips.variant && editor.file === 'tips.yaml') openVariant(editor.variant, 'tips.yaml');
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
    } else if (target.dataset.edit || (target.closest('tr[data-row]') && !target.closest('a, button'))) {
      const name = target.dataset.edit || target.closest('tr[data-row]').dataset.row;
      const row = overview.find((v) => v.name === name);
      await openVariant(name, row?.files[0]?.file || 'SKILL.md');
      $('#v-list').innerHTML = renderOverview();
      $('#v-editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (target.dataset.try) {
      $('#try-variant').value = target.dataset.try;
      $('#try-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Pick a persona and press Run once.');
    } else if (target.dataset.describe) {
      await describe(target.dataset.describe, target.dataset.force === '1');
    } else if (target.dataset.file) {
      await openVariant(editor.variant, target.dataset.file);
    } else if (target.dataset.mode) {
      setEditorMode(target.dataset.mode);
    } else if (target.id === 'v-save') {
      await saveEditor();
    } else if (target.id === 'v-new') {
      $('#v-new-form').hidden = !$('#v-new-form').hidden;
      $('#v-from').value = editor.variant || 'baseline';
      $('#v-name').focus();
    } else if (target.id === 'v-create') {
      const name = $('#v-name').value.trim();
      const created = await api('/api/variants', { name, from: $('#v-from').value });
      $('#v-new-form').hidden = true;
      $('#v-name').value = '';
      editor.variant = null;
      await loadVariants();
      await openVariant(created.name, 'SKILL.md');
      loadOverview().catch((e) => toast(e.message));
      refresh();
      toast('Created ' + created.name);
    } else if (target.id === 't-save') {
      await saveTips();
    } else if (target.id === 't-reset') {
      $('#t-editor').value = tips.baseline;
      previewTips();
    } else if (target.dataset.personalize) {
      const id = target.dataset.personalize;
      tips.personal[id] = { pending: true };
      previewTips();
      const result = await api('/api/tips/personalize', { yaml: $('#t-editor').value, sample: tipSample(), id });
      tips.personal[id] = result;
      previewTips();
    } else if (target.id === 'try-run') {
      await startRun({
        variant: $('#try-variant').value,
        personas: [$('#try-persona').value],
        repeat: 1,
        concurrency: 1,
        tips: Number($('#try-tips').value) || 0,
        search: $('#try-search').checked,
        judge: 'claude',
        label: 'try-' + $('#try-variant').value,
      }, 'Running one conversation…');
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.closest?.('#run-form')) updateEstimate();
  if (target.id === 'v-select') await openVariant(target.value, 'SKILL.md');
  if (target.id === 'v-add' && target.value) await openVariant(editor.variant, target.value);
  if (target.id === 't-variant') await openTips(target.value);
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'v-editor') updateEditorStatus();
  if (target.id === 't-editor' || target.closest?.('#t-sample')) {
    clearTimeout(tips.timer);
    tips.timer = setTimeout(previewTips, 300);
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    const tab = currentTab();
    if (tab === 'variants' && !editor.readOnly) { event.preventDefault(); saveEditor().catch((e) => toast(e.message)); }
    if (tab === 'tips' && !$('#t-save').hidden) { event.preventDefault(); saveTips().catch((e) => toast(e.message)); }
  }
});

$('#run-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const personas = selectedPersonas();
  if (!personas.length) return toast('Pick at least one persona.');
  try {
    await startRun({
      variant: $('#variant').value,
      label: $('#label').value.trim(),
      repeat: Number($('#repeat').value),
      concurrency: Number($('#concurrency').value),
      tips: Number($('#tips').value),
      search: $('#search').checked,
      judge: document.querySelector('input[name=judge]:checked').value,
      personas,
    }, 'Run started.');
  } catch (error) {
    toast(error.message);
  }
});

window.__editable = EDITABLE_FILES;
showTab();
refresh().then(() => { if (currentTab() !== 'runs') loadVariants(); });
`;

export function renderApp(editableFiles: string[]) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Onboarding lab</title><style>${STYLE}${APP_STYLE}</style></head><body><main>
<header><h1>Onboarding lab</h1>
  <nav class="tabs"><a href="#runs">Runs</a><a href="#variants">Variants</a><a href="#tips">Tips</a></nav>
  <span class="muted" id="summary"></span></header>
<div class="layout">
  <div>
    <div data-tab="runs">
      <section class="panel"><h2>Run sets</h2><div id="sets"><p class="empty">Loading…</p></div></section>
      <section class="panel"><h2>Comparisons</h2><div id="judging"></div></section>
    </div>
    <div data-tab="variants" hidden>
      <section class="panel"><h2>All variants</h2><div id="v-list"><p class="empty">Loading…</p></div></section>
      <section class="panel" id="v-editor-panel">
        <div class="toolbar"><select id="v-select" style="width:auto"></select><span id="v-parent"></span><span class="spacer"></span><button id="v-new">New variant…</button></div>
        <div id="v-new-form" hidden class="row" style="align-items:end">
          <div><label for="v-name">Name</label><input id="v-name" type="text" placeholder="e.g. warmer-welcome"></div>
          <div><label for="v-from">Start from</label><select id="v-from"></select></div>
          <div style="flex:0"><button class="primary" id="v-create">Create</button></div>
        </div>
        <div class="filetabs" id="v-files"></div>
        <div class="toolbar"><span><button class="seg on" data-mode="edit">Edit</button><button class="seg" data-mode="parent">vs parent</button><button class="seg" data-mode="production">vs production</button><button class="seg" data-mode="openclaw">vs OpenClaw default</button></span><span class="hint" id="v-diff-label"></span><span class="hint" id="v-exists"></span><span class="spacer"></span><span class="dirty" id="v-dirty"></span><button class="primary" id="v-save">Save</button></div>
        <textarea id="v-editor" class="code" spellcheck="false"></textarea>
        <div id="v-diff" class="diff" hidden></div>
        <p class="hint">⌘S saves. A variant only replaces the files it holds; everything else comes from baseline. Runs read variant files when they start.</p>
      </section>
    </div>
    <div data-tab="tips" hidden>
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
    <section class="panel" data-tab="runs"><h2>Start a run</h2>
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
    <section class="panel" data-tab="variants" hidden id="try-panel"><h2>Try it</h2>
      <p class="hint" style="margin-top:0">One conversation with one persona, about a cent. The report opens from the job when it finishes.</p>
      <label for="try-variant">Variant</label><select id="try-variant"></select>
      <label for="try-persona">Persona</label><select id="try-persona"></select>
      <div class="row">
        <div><label for="try-tips">Tips to simulate</label><input id="try-tips" type="number" min="0" max="5" value="0"></div>
      </div>
      <label class="inline"><input type="checkbox" id="try-search"> Web search</label>
      <button class="primary" id="try-run" style="margin-top:8px">Run once</button>
    </section>
    <section class="panel"><h2>Jobs</h2><div id="jobs"></div></section>
  </div>
</div>
<div class="toast" id="toast"></div>
</main><script>const EDITABLE_FILES = ${JSON.stringify(editableFiles)};${SCRIPT}</script></body></html>`;
}
