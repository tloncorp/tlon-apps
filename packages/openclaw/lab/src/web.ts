import { STYLE } from './report.js';

// The lab control panel: one static page that talks to serve.ts over a small
// JSON API. Kept dependency-free so `pnpm lab serve` needs nothing extra.

const APP_STYLE = `
main { max-width: 1240px; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.layout > div { min-width: 0; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.panel h2 { margin: 0 0 10px; }
label { display: block; font-size: 13px; color: var(--muted); margin: 10px 0 4px; }
input[type=text], input[type=number], select { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--text); font: inherit; }
.row { display: flex; gap: 10px; } .row > * { flex: 1; }
button { font: inherit; font-size: 14px; padding: 7px 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button:disabled { opacity: .45; cursor: default; }
button.link { border: none; background: none; color: var(--accent); padding: 0; font-size: 13px; }
.checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 2px 10px; max-height: 220px; overflow: auto; border: 1px solid var(--line); border-radius: 7px; padding: 8px; }
.checks label { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--text); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.radio label { display: flex; gap: 6px; align-items: center; color: var(--text); margin: 4px 0; }
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
.empty { color: var(--muted); font-size: 14px; }
.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 8px 14px; border-radius: 8px; font-size: 14px; opacity: 0; transition: opacity .2s; pointer-events: none; }
.toast.show { opacity: 1; }
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

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

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
  const older_ = older.length ? '<h3>Judged by a model</h3>' + older.map((file) => '<div><a href="/files/' + encodeURIComponent(file) + '" target="_blank">' + esc(file) + '</a></div>').join('') : '';
  return table + older_;
}

function renderJobs() {
  const jobs = state.jobs;
  if (!jobs.length) return '<p class="empty">Nothing started from here yet.</p>';
  return jobs.map((job) => '<div class="job" data-job="' + job.id + '">' +
    '<div class="title"><span>' + esc(job.title) + '</span><span class="pill ' + job.status + '">' + job.status + '</span></div>' +
    '<div class="last">' + esc(job.lastLine || job.args.join(' ')) + '</div>' +
    '<button class="link" data-toggle="' + job.id + '">' + (openJobs.has(job.id) ? 'Hide log' : 'Show log') + '</button>' +
    (job.status === 'running' ? ' · <button class="link" data-stop="' + job.id + '">Stop</button>' : '') +
    (openJobs.has(job.id) ? '<pre class="log" id="log-' + job.id + '">Loading…</pre>' : '') +
    '</div>').join('');
}

function renderForm() {
  const variants = state.variants.map((v) => '<option>' + esc(v) + '</option>').join('');
  const current = $('#variant')?.value;
  $('#variant').innerHTML = variants;
  if (current && state.variants.includes(current)) $('#variant').value = current;
  if (!personasInitialized) {
    $('#personas').innerHTML = state.personas.map((p) => '<label title="' + esc(p.wants) + '"><input type="checkbox" name="persona" value="' + esc(p.id) + '" checked> ' + esc(p.id) + '</label>').join('');
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
    $('#sets').innerHTML = '<p class="bad">Could not load: ' + esc(error.message) + '</p>';
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
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener('change', (event) => {
  if (event.target.closest?.('#run-form')) updateEstimate();
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

refresh();
`;

export function renderApp() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Onboarding lab</title><style>${STYLE}${APP_STYLE}</style></head><body><main>
<header><h1>Onboarding lab</h1><span class="muted" id="summary"></span></header>
<div class="layout">
  <div>
    <section class="panel"><h2>Run sets</h2><div id="sets"><p class="empty">Loading…</p></div></section>
    <section class="panel"><h2>Comparisons</h2><div id="judging"></div></section>
  </div>
  <div>
    <section class="panel"><h2>Start a run</h2>
      <form id="run-form">
        <label for="variant">Variant</label><select id="variant"></select>
        <label for="label">Label (optional)</label><input id="label" type="text" placeholder="defaults to the variant name">
        <div class="row">
          <div><label for="repeat">Runs per persona</label><input id="repeat" type="number" min="1" max="5" value="1"></div>
          <div><label for="concurrency">In parallel</label><input id="concurrency" type="number" min="1" max="8" value="4"></div>
        </div>
        <label>Personas <button type="button" class="link" data-personas="all">all</button> · <button type="button" class="link" data-personas="blank">blank-slate</button> · <button type="button" class="link" data-personas="none">none</button></label>
        <div class="checks" id="personas"></div>
        <label style="display:flex;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="search" checked> Web search</label>
        <div class="radio">
          <label><input type="radio" name="judge" value="claude" checked> Judge in Claude later</label>
          <label><input type="radio" name="judge" value="model"> Judge with a model now</label>
        </div>
        <p class="hint" id="estimate"></p>
        <button class="primary" type="submit">Start run</button>
      </form>
    </section>
    <section class="panel"><h2>Jobs</h2><div id="jobs"></div></section>
  </div>
</div>
<div class="toast" id="toast"></div>
</main><script>${SCRIPT}</script></body></html>`;
}
