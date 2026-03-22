^-  @t
'''
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notes</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f0f0f;
    --surface: #1a1a1a;
    --surface2: #222;
    --border: #2e2e2e;
    --text: #e8e8e8;
    --text-muted: #666;
    --accent: #7c6af7;
    --accent-hover: #9080ff;
    --danger: #e05c5c;
    --success: #4caf82;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --mono: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
  }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── header ── */
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  header h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.3px; }
  #ship-label { font-size: 12px; color: var(--text-muted); margin-left: auto; }
  #status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--text-muted); flex-shrink: 0;
    transition: background 0.3s;
  }
  #status-dot.connected { background: var(--success); }
  #status-dot.error { background: var(--danger); }

  /* ── layout ── */
  .layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── sidebar ── */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    overflow: hidden;
  }
  .sidebar-section {
    padding: 8px 8px 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sidebar-list { flex: 1; overflow-y: auto; padding-bottom: 8px; }
  .nb-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    cursor: pointer;
    border-radius: 4px;
    margin: 1px 4px;
    font-size: 13px;
    transition: background 0.1s;
    user-select: none;
  }
  .nb-item:hover { background: var(--surface2); }
  .nb-item.active { background: var(--accent); color: #fff; }
  .nb-item .nb-icon { font-size: 14px; flex-shrink: 0; }
  .nb-item .nb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── folder tree ── */
  .folder-tree { overflow-y: auto; border-top: 1px solid var(--border); flex-shrink: 0; max-height: 40%; }
  .folder-item {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 10px 4px;
    cursor: pointer; font-size: 12px;
    border-radius: 4px; margin: 1px 4px;
    transition: background 0.1s;
    user-select: none;
  }
  .folder-item:hover { background: var(--surface2); }
  .folder-item.active { background: rgba(124,106,247,0.2); color: var(--accent); }
  .folder-item .indent { display: inline-block; }
  .folder-item .fold-icon { width: 14px; flex-shrink: 0; color: var(--text-muted); font-size: 10px; }

  /* ── icon button ── */
  .icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); padding: 2px 4px; border-radius: 3px;
    font-size: 14px; line-height: 1; transition: color 0.15s, background 0.15s;
  }
  .icon-btn:hover { color: var(--text); background: var(--surface2); }

  /* ── notes list panel ── */
  .notes-panel {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .notes-panel-header {
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .notes-list { flex: 1; overflow-y: auto; }
  .note-row {
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .note-row:hover { background: var(--surface2); }
  .note-row.active { background: rgba(124,106,247,0.15); border-left: 2px solid var(--accent); }
  .note-row .note-title { font-size: 13px; font-weight: 500; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note-row .note-meta { font-size: 11px; color: var(--text-muted); }
  .empty-state { padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 12px; }

  /* ── editor ── */
  .editor-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
  .editor-toolbar {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }
  #note-title-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 16px;
    font-weight: 600;
    font-family: var(--font);
  }
  #note-title-input::placeholder { color: var(--text-muted); font-weight: 400; }
  .save-btn {
    background: var(--accent); border: none; color: #fff;
    padding: 5px 12px; border-radius: 5px; cursor: pointer;
    font-size: 12px; font-weight: 600;
    transition: background 0.15s, opacity 0.15s;
  }
  .save-btn:hover { background: var(--accent-hover); }
  .save-btn:disabled { opacity: 0.4; cursor: default; }
  .save-status { font-size: 11px; color: var(--text-muted); }

  #editor {
    flex: 1;
    resize: none;
    background: var(--bg);
    color: var(--text);
    border: none;
    outline: none;
    padding: 20px 24px;
    font-family: var(--mono);
    font-size: 13.5px;
    line-height: 1.7;
    overflow-y: auto;
  }
  #editor::placeholder { color: var(--text-muted); font-family: var(--font); }

  #preview {
    flex: 1;
    padding: 20px 24px;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.7;
  }
  #preview h1 { font-size: 1.8em; margin: 0.5em 0 0.3em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
  #preview h2 { font-size: 1.4em; margin: 0.5em 0 0.3em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
  #preview h3 { font-size: 1.15em; margin: 0.5em 0 0.3em; }
  #preview h4, #preview h5, #preview h6 { font-size: 1em; margin: 0.4em 0 0.2em; }
  #preview p { margin: 0.5em 0; }
  #preview pre { background: var(--surface); padding: 12px 16px; border-radius: 6px; overflow-x: auto; margin: 0.6em 0; }
  #preview code { font-family: var(--mono); font-size: 0.9em; }
  #preview :not(pre) > code { background: var(--surface2); padding: 2px 5px; border-radius: 3px; }
  #preview blockquote { border-left: 3px solid var(--accent); padding-left: 14px; color: var(--text-muted); margin: 0.5em 0; }
  #preview ul, #preview ol { padding-left: 1.5em; margin: 0.4em 0; }
  #preview li { margin: 0.15em 0; }
  #preview li > input[type="checkbox"] { margin-right: 0.4em; }
  #preview a { color: var(--accent); text-decoration: none; }
  #preview a:hover { text-decoration: underline; }
  #preview hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
  #preview img { max-width: 100%; border-radius: 6px; }
  #preview table { border-collapse: collapse; margin: 0.6em 0; }
  #preview th, #preview td { border: 1px solid var(--border); padding: 6px 12px; }
  #preview th { background: var(--surface); }

  /* ── modal ── */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: none; align-items: center; justify-content: center;
    z-index: 100;
  }
  .modal-backdrop.open { display: flex; }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    width: 320px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  }
  .modal h3 { font-size: 14px; margin-bottom: 14px; }
  .modal input, .modal select {
    width: 100%; background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 8px 10px; border-radius: 5px;
    font-size: 13px; font-family: var(--font); outline: none;
    margin-bottom: 12px;
  }
  .modal input:focus, .modal select:focus { border-color: var(--accent); }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .btn { padding: 6px 14px; border-radius: 5px; font-size: 13px; cursor: pointer; border: none; font-family: var(--font); }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--text-muted); }

  /* ── connect panel ── */
  #connect-panel {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
    flex-direction: column; gap: 12px;
  }
  #connect-panel h2 { font-size: 18px; margin-bottom: 4px; }
  #connect-panel p { font-size: 13px; color: var(--text-muted); }
  #connect-panel input {
    width: 300px; background: var(--surface); border: 1px solid var(--border);
    color: var(--text); padding: 9px 12px; border-radius: 6px;
    font-size: 13px; font-family: var(--font); outline: none;
  }
  #connect-panel input:focus { border-color: var(--accent); }
  #connect-error { color: var(--danger); font-size: 12px; min-height: 16px; }

  /* scrollbars */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
</style>
</head>
<body>

<!-- Connect panel (shown until URL + auth set) -->
<div id="connect-panel">
  <h2>📓 Notes</h2>
  <p>Enter your ship URL to connect</p>
  <input id="ship-url-input" type="text" placeholder="http://localhost:8080" autocomplete="off" />
  <input id="auth-input" type="password" placeholder="+code (or leave blank if already logged in)" autocomplete="off" />
  <div id="connect-error"></div>
  <button class="btn btn-primary" onclick="connect()">Connect</button>
</div>

<header>
  <div id="status-dot"></div>
  <h1>📓 Notes</h1>
  <span id="ship-label"></span>
</header>

<div class="layout">
  <!-- Sidebar: notebooks -->
  <div class="sidebar">
    <div class="sidebar-section">
      Notebooks
      <button class="icon-btn" title="New notebook" onclick="openModal(&quot;new-notebook&quot;)">＋</button>
    </div>
    <div class="sidebar-list" id="notebooks-list"></div>
    <!-- Folder tree for selected notebook -->
    <div class="folder-tree" id="folder-tree"></div>
  </div>

  <!-- Notes list -->
  <div class="notes-panel">
    <div class="notes-panel-header">
      <span id="folder-label">Notes</span>
      <button class="icon-btn" title="New note" onclick="newNote()">＋</button>
    </div>
    <div class="notes-list" id="notes-list"></div>
  </div>

  <!-- Editor -->
  <div class="editor-panel">
    <div class="editor-toolbar">
      <input id="note-title-input" type="text" placeholder="Untitled" onchange="markDirty()" oninput="markDirty()" />
      <span class="save-status" id="save-status"></span>
      <button class="save-btn" id="save-btn" onclick="saveNote()" disabled>Save</button>
      <button class="save-btn" id="preview-btn" onclick="togglePreview()" style="background:var(--surface2)">Preview</button>
    </div>
    <textarea id="editor" placeholder="Write in markdown…" onchange="markDirty()" oninput="markDirty()"></textarea>
    <div id="preview" style="display:none"></div>
  </div>
</div>

<!-- Modals -->
<div class="modal-backdrop" id="modal-backdrop" onclick="closeModal(event)">
  <div class="modal" id="modal-box">
    <!-- filled dynamically -->
  </div>
</div>

<script>
// ── State ──────────────────────────────────────────────────────────────────
let BASE_URL = "";
let SHIP = "";
let channelId = "";
let eventSource = null;
let msgId = 1;

let notebooks = {};   // id -> notebook
let folders = {};     // id -> folder
let notes = {};       // id -> note

let activeNotebookId = null;
let activeFolderId = null;
let activeNoteId = null;
let dirty = false;
let savedRevision = 0;

// ── Connect ────────────────────────────────────────────────────────────────
async function connect() {
  const url = document.getElementById("ship-url-input").value.trim().replace(/\/$/, "");
  const code = document.getElementById("auth-input").value.trim();
  const errEl = document.getElementById("connect-error");
  errEl.textContent = "";

  if (!url) { errEl.textContent = "Enter a URL"; return; }
  BASE_URL = url;

  // Optionally authenticate with +code
  if (code) {
    try {
      const params = new URLSearchParams({ password: code });
      const r = await fetch(`${BASE_URL}/~/login`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });
      if (!r.ok && r.status !== 204) throw new Error(`Login failed: ${r.status}`);
    } catch(e) {
      errEl.textContent = e.message; return;
    }
  }

  // Get ship name
  try {
    const r = await fetch(`${BASE_URL}/~/scry/notes/notebooks.json`, { credentials: "include" });
    if (r.status === 403) { errEl.textContent = "Auth failed — check your +code"; return; }
    if (!r.ok && r.status !== 404) { errEl.textContent = `Cannot reach ship: ${r.status}`; return; }
  } catch(e) { errEl.textContent = `Cannot reach ship: ${e.message}`; return; }

  // Get own ship name
  try {
    const r = await fetch(`${BASE_URL}/~/name`, { credentials: "include" });
    if (r.ok) SHIP = (await r.text()).trim();
  } catch(e) {}

  document.getElementById("connect-panel").style.display = "none";
  document.getElementById("ship-label").textContent = SHIP || BASE_URL;
  document.getElementById("status-dot").className = "connected";

  openChannel();
  await loadNotebooks();
}

// ── Eyre Channel ──────────────────────────────────────────────────────────
function openChannel() {
  channelId = `notes-ui-${Date.now()}`;
  subscribeEvents();
}

function subscribeEvents() {
  // Subscribe to /events and open SSE channel
  poke([{
    id: msgId++, action: "subscribe",
    ship: SHIP.replace("~",""),
    app: "notes", path: "/events"
  }]);
  startSSE();
}

function startSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`${BASE_URL}/~/channel/${channelId}`, { withCredentials: true });
  eventSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleEvent(msg);
    } catch {}
  };
  eventSource.onerror = () => {
    document.getElementById("status-dot").className = "error";
  };
  eventSource.onopen = () => {
    document.getElementById("status-dot").className = "connected";
  };
}

async function poke(actions) {
  await fetch(`${BASE_URL}/~/channel/${channelId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actions)
  });
}

async function pokeAction(action) {
  const id = msgId++;
  await poke([{
    id, action: "poke",
    ship: SHIP.replace("~",""),
    app: "notes",
    mark: "notes-action",
    json: action
  }]);
}

async function scry(path) {
  const r = await fetch(`${BASE_URL}/~/scry/notes${path}.json`, { credentials: "include" });
  if (!r.ok) return null;
  return r.json();
}

// ── Event Handling ────────────────────────────────────────────────────────
function handleEvent(msg) {
  if (!msg.json) return;
  const evt = msg.json;
  const type = evt.type;

  // Reload relevant data on events
  if (type === "notebook-created" || type === "notebook-renamed") loadNotebooks();
  else if (type?.startsWith("folder-")) loadFolders(activeNotebookId);
  else if (type?.startsWith("note-")) {
    loadNotes(activeNotebookId, activeFolderId);
    // If the note we are editing was updated remotely
    if (type === "note-updated" && evt.noteId === activeNoteId && !dirty) {
      loadNote(activeNoteId);
    }
  }
}

// ── Load Data ─────────────────────────────────────────────────────────────
async function loadNotebooks() {
  const data = await scry("/notebooks");
  if (!data) return;
  notebooks = {};
  (data || []).forEach(nb => notebooks[nb.id] = nb);
  renderNotebooks();
}

async function loadFolders(notebookId) {
  const data = await scry(`/folders/${notebookId}`);
  folders = {};
  (data || []).forEach(f => folders[f.id] = f);
  renderFolderTree();
}

async function loadNotes(notebookId, folderId) {
  let data;
  if (folderId) {
    data = await scry(`/notes/${notebookId}/${folderId}`);
  } else {
    data = await scry(`/notes/${notebookId}`);
  }
  notes = {};
  (data || []).forEach(n => notes[n.id] = n);
  renderNotesList();
}

async function loadNote(noteId) {
  const data = await scry(`/note/${noteId}`);
  if (!data) return;
  notes[data.id] = data;
  if (activeNoteId === data.id) {
    document.getElementById("note-title-input").value = data.title;
    document.getElementById("editor").value = data.bodyMd;
    savedRevision = data.revision;
    clearDirty();
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function renderNotebooks() {
  const el = document.getElementById("notebooks-list");
  el.innerHTML = "";
  Object.values(notebooks).sort((a,b) => a.title.localeCompare(b.title)).forEach(nb => {
    const div = document.createElement("div");
    div.className = "nb-item" + (nb.id === activeNotebookId ? " active" : "");
    div.innerHTML = `<span class="nb-icon">📓</span><span class="nb-name">${esc(nb.title)}</span>`;
    div.onclick = () => selectNotebook(nb.id);
    el.appendChild(div);
  });
}

function renderFolderTree() {
  const el = document.getElementById("folder-tree");
  el.innerHTML = "";
  if (!activeNotebookId) return;

  // Build tree - find root "/" folder id so children of "/" appear at top level
  const rootFolder = Object.values(folders).find(f => f.name === "/");
  const rootId = rootFolder ? rootFolder.id : null;
  const allFolders = Object.values(folders).filter(f => f.name !== "/");
  const roots = allFolders.filter(f => !f.parentFolderId || f.parentFolderId === rootId);

  function renderFolder(f, depth) {
    const div = document.createElement("div");
    div.className = "folder-item" + (f.id === activeFolderId ? " active" : "");
    const children = allFolders.filter(c => c.parentFolderId === f.id);
    div.innerHTML = `
      <span class="indent" style="width:${depth*12}px"></span>
      <span class="fold-icon">${children.length ? "▾" : "·"}</span>
      📁 ${esc(f.name)}
    `;
    div.onclick = (e) => { e.stopPropagation(); selectFolder(f.id); };
    el.appendChild(div);
    children.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => renderFolder(c, depth+1));
  }

  // "All notes" entry
  const all = document.createElement("div");
  all.className = "folder-item" + (!activeFolderId ? " active" : "");
  all.innerHTML = `<span class="fold-icon">·</span> All Notes`;
  all.onclick = () => selectFolder(null);
  el.appendChild(all);

  roots.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => renderFolder(f, 1));

  // New folder button
  const newDiv = document.createElement("div");
  newDiv.className = "folder-item";
  newDiv.style.color = "var(--text-muted)";
  newDiv.innerHTML = `<span class="fold-icon">＋</span> New folder`;
  newDiv.onclick = () => openModal("new-folder");
  el.appendChild(newDiv);

  const importDiv = document.createElement("div");
  importDiv.className = "folder-item";
  importDiv.style.color = "var(--text-muted)";
  importDiv.innerHTML = `<span class="fold-icon">📥</span> Import files`;
  importDiv.onclick = () => triggerImport(false);
  el.appendChild(importDiv);

  const importTreeDiv = document.createElement("div");
  importTreeDiv.className = "folder-item";
  importTreeDiv.style.color = "var(--text-muted)";
  importTreeDiv.innerHTML = `<span class="fold-icon">📂</span> Import folder`;
  importTreeDiv.onclick = () => triggerImport(true);
  el.appendChild(importTreeDiv);
}

// ── Import ────────────────────────────────────────────────────────────────
function triggerImport(isFolder) {
  if (!activeNotebookId) { alert("Select a notebook first"); return; }
  const input = document.createElement("input");
  input.type = "file";
  if (isFolder) {
    input.webkitdirectory = true;
  } else {
    input.multiple = true;
    input.accept = ".md,.txt,.markdown,.text";
  }
  input.onchange = async (e) => {
    const allFiles = Array.from(e.target.files);
    const mdFiles = allFiles.filter(f => /\.(md|txt|markdown|text)$/i.test(f.name));
    if (!mdFiles.length) { alert("No .md or .txt files found"); return; }
    document.getElementById("save-status").textContent = "Importing " + mdFiles.length + " files…";

    let folderId = activeFolderId;
    if (!folderId) {
      const rootFolder = Object.values(folders).find(f => f.name === "/");
      if (rootFolder) folderId = rootFolder.id;
      else { alert("No folders found"); return; }
    }

    if (isFolder) {
      // Build tree from webkitRelativePath
      const tree = [];
      for (const file of mdFiles) {
        const parts = file.webkitRelativePath.split("/");
        // parts[0] is root folder name, rest are subfolders + filename
        let node = tree;
        // skip parts[0] (selected folder name) and last (filename)
        for (let i = 1; i < parts.length - 1; i++) {
          let existing = node.find(n => n.children && n.name === parts[i]);
          if (!existing) {
            existing = { name: parts[i], children: [] };
            node.push(existing);
          }
          node = existing.children;
        }
        const text = await file.text();
        const title = file.name.replace(/\.(md|txt|markdown|text)$/i, "");
        node.push({ title, bodyMd: text });
      }
      await pokeAction({
        "batch-import-tree": {
          notebookId: activeNotebookId,
          parentFolderId: folderId,
          tree: tree
        }
      });
    } else {
      const noteItems = [];
      for (const file of mdFiles) {
        const text = await file.text();
        const title = file.name.replace(/\.(md|txt|markdown|text)$/i, "");
        noteItems.push({ title, bodyMd: text });
      }
      await pokeAction({
        "batch-import": {
          notebookId: activeNotebookId,
          folderId: folderId,
          notes: noteItems
        }
      });
    }

    setTimeout(async () => {
      await loadFolders(activeNotebookId);
      await loadNotes(activeNotebookId, activeFolderId);
      document.getElementById("save-status").textContent = "Imported " + mdFiles.length + " notes";
      setTimeout(() => { document.getElementById("save-status").textContent = ""; }, 3000);
    }, 500);
  };
  document.body.appendChild(input);
  input.click();
  input.remove();
}

// ── Markdown Preview ──────────────────────────────────────────────────────
let previewMode = false;

function togglePreview() {
  previewMode = !previewMode;
  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const btn = document.getElementById("preview-btn");
  if (previewMode) {
    preview.innerHTML = renderMarkdown(editor.value);
    editor.style.display = "none";
    preview.style.display = "block";
    btn.style.background = "var(--accent)";
    btn.textContent = "Edit";
  } else {
    editor.style.display = "block";
    preview.style.display = "none";
    btn.style.background = "var(--surface2)";
    btn.textContent = "Preview";
  }
}

function renderMarkdown(src) {
  // escape HTML
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = src.split("\n");
  let html = "";
  let inCode = false, codeLang = "", codeLines = [];
  let inList = false, listType = "";
  let inBlockquote = false;

  function flushList() {
    if (inList) { html += listType === "ul" ? "</ul>\n" : "</ol>\n"; inList = false; }
  }
  function flushBlockquote() {
    if (inBlockquote) { html += "</blockquote>\n"; inBlockquote = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // fenced code blocks
    if (/^```/.test(line)) {
      if (!inCode) {
        flushList(); flushBlockquote();
        codeLang = line.slice(3).trim();
        codeLines = [];
        inCode = true;
        continue;
      } else {
        html += "<pre><code" + (codeLang ? " class=\"language-" + esc(codeLang) + "\"" : "") + ">" + esc(codeLines.join("\n")) + "</code></pre>\n";
        inCode = false;
        continue;
      }
    }
    if (inCode) { codeLines.push(line); continue; }

    // blank line
    if (!line.trim()) { flushList(); flushBlockquote(); html += "\n"; continue; }

    // headings
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) { flushList(); flushBlockquote(); const lvl = hm[1].length; html += "<h" + lvl + ">" + inline(hm[2]) + "</h" + lvl + ">\n"; continue; }

    // hr
    if (/^([-*_]\s*){3,}$/.test(line.trim())) { flushList(); flushBlockquote(); html += "<hr>\n"; continue; }

    // blockquote
    if (/^>\s?/.test(line)) {
      flushList();
      const content = line.replace(/^>\s?/, "");
      if (!inBlockquote) { html += "<blockquote>\n"; inBlockquote = true; }
      html += "<p>" + inline(content) + "</p>\n";
      continue;
    } else { flushBlockquote(); }

    // unordered list
    const ulm = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulm) {
      if (!inList || listType !== "ul") { flushList(); html += "<ul>\n"; inList = true; listType = "ul"; }
      // checkbox
      const cbm = ulm[2].match(/^\[([ xX])\]\s*(.*)/);
      if (cbm) {
        const checked = cbm[1] !== " " ? " checked disabled" : " disabled";
        html += "<li><input type=\"checkbox\"" + checked + "> " + inline(cbm[2]) + "</li>\n";
      } else {
        html += "<li>" + inline(ulm[2]) + "</li>\n";
      }
      continue;
    }

    // ordered list
    const olm = line.match(/^(\s*)\d+[.)]\s+(.*)/);
    if (olm) {
      if (!inList || listType !== "ol") { flushList(); html += "<ol>\n"; inList = true; listType = "ol"; }
      html += "<li>" + inline(olm[2]) + "</li>\n";
      continue;
    }

    flushList();
    // table
    if (line.includes("|") && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const parseRow = r => r.split("|").map(c => c.trim()).filter(c => c !== "");
      const headers = parseRow(line);
      html += "<table><thead><tr>" + headers.map(h => "<th>" + inline(h) + "</th>").join("") + "</tr></thead><tbody>\n";
      i++; // skip separator
      while (i + 1 < lines.length && lines[i + 1].includes("|")) {
        i++;
        const cells = parseRow(lines[i]);
        html += "<tr>" + cells.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>\n";
      }
      html += "</tbody></table>\n";
      continue;
    }

    // paragraph
    html += "<p>" + inline(line) + "</p>\n";
  }
  if (inCode) html += "<pre><code>" + esc(codeLines.join("\n")) + "</code></pre>\n";
  flushList(); flushBlockquote();
  return html;
}

function inline(s) {
  const esc = t => t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // inline code first (to protect contents)
  let result = "";
  let rest = s;
  while (rest) {
    const cm = rest.match(/`([^`]+)`/);
    if (!cm) { result += rest; break; }
    result += rest.slice(0, cm.index);
    result += "<code>" + esc(cm[1]) + "</code>";
    rest = rest.slice(cm.index + cm[0].length);
  }
  s = result;
  // images before links
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<img src=\"$2\" alt=\"$1\">");
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\">$1</a>");
  // bold+italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  // bold
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/_(.+?)_/g, "<em>$1</em>");
  // strikethrough
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  return s;
}

function renderNotesList() {
  const el = document.getElementById("notes-list");
  el.innerHTML = "";
  const sorted = Object.values(notes).sort((a,b) => b.updatedAt - a.updatedAt);
  if (!sorted.length) {
    el.innerHTML = "<div class=\"empty-state\">No notes here yet</div>";
    return;
  }
  sorted.forEach(n => {
    const div = document.createElement("div");
    div.className = "note-row" + (n.id === activeNoteId ? " active" : "");
    const d = new Date(n.updatedAt * 1000);
    const dateStr = d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
    div.innerHTML = `
      <div class="note-title">${esc(n.title)}</div>
      <div class="note-meta">${dateStr} · rev ${n.revision}</div>
    `;
    div.onclick = () => selectNote(n.id);
    el.appendChild(div);
  });
}

// ── Selection ─────────────────────────────────────────────────────────────
async function selectNotebook(id) {
  if (!await confirmDirty()) return;
  activeNotebookId = id;
  activeFolderId = null;
  activeNoteId = null;
  clearEditor();
  renderNotebooks();
  document.getElementById("folder-label").textContent =
    notebooks[id]?.title || "Notes";
  await loadFolders(id);
  await loadNotes(id, null);
  subscribeEvents();
}

async function selectFolder(id) {
  if (!await confirmDirty()) return;
  activeFolderId = id;
  activeNoteId = null;
  clearEditor();
  renderFolderTree();
  document.getElementById("folder-label").textContent =
    id ? (folders[id]?.name || "Folder") : "All Notes";
  await loadNotes(activeNotebookId, id);
}

async function selectNote(id) {
  if (!await confirmDirty()) return;
  activeNoteId = id;
  renderNotesList();
  const n = notes[id];
  document.getElementById("note-title-input").value = n.title;
  document.getElementById("editor").value = n.bodyMd;
  if (previewMode) document.getElementById("preview").innerHTML = renderMarkdown(n.bodyMd);
  savedRevision = n.revision;
  clearDirty();
}

// ── Create / Save ─────────────────────────────────────────────────────────
async function newNote() {
  if (!activeNotebookId) { alert("Select a notebook first"); return; }
  if (!await confirmDirty()) return;

  // Find or use root folder
  let folderId = activeFolderId;
  if (!folderId) {
    // Use first available folder (root)
    const rootFolder = Object.values(folders).find(f => f.name === "/");
    if (rootFolder) folderId = rootFolder.id;
    else { alert("No folders found — create a folder first"); return; }
  }

  await pokeAction({
    "create-note": { notebookId: activeNotebookId, folderId, title: "Untitled", bodyMd: "" }
  });

  // Reload and select the newest note
  setTimeout(async () => {
    await loadNotes(activeNotebookId, activeFolderId);
    const newest = Object.values(notes).sort((a,b) => b.id - a.id)[0];
    if (newest) selectNote(newest.id);
  }, 300);
}

async function saveNote() {
  if (!activeNoteId) return;
  const title = document.getElementById("note-title-input").value.trim() || "Untitled";
  const body = document.getElementById("editor").value;
  const n = notes[activeNoteId];
  if (!n) return;

  document.getElementById("save-btn").disabled = true;
  document.getElementById("save-status").textContent = "Saving…";

  try {
    // Rename if title changed
    if (title !== n.title) {
      await pokeAction({ "rename-note": { notebookId: n.notebookId, noteId: activeNoteId, title } });
    }
    // Update body
    await pokeAction({ "update-note": { noteId: activeNoteId, bodyMd: body, expectedRevision: savedRevision } });
    savedRevision++;
    notes[activeNoteId] = { ...n, title, bodyMd: body, revision: savedRevision };
    clearDirty();
    document.getElementById("save-status").textContent = "Saved";
    setTimeout(() => { document.getElementById("save-status").textContent = ""; }, 2000);
    renderNotesList();
  } catch(e) {
    document.getElementById("save-status").textContent = "Error saving";
    document.getElementById("save-btn").disabled = false;
  }
}

// ── Dirty state ──────────────────────────────────────────────────────────
function markDirty() {
  dirty = true;
  document.getElementById("save-btn").disabled = false;
  document.getElementById("save-status").textContent = "";
}

function clearDirty() {
  dirty = false;
  document.getElementById("save-btn").disabled = true;
}

async function confirmDirty() {
  if (!dirty) return true;
  return confirm("You have unsaved changes. Discard them?");
}

function clearEditor() {
  document.getElementById("note-title-input").value = "";
  document.getElementById("editor").value = "";
  clearDirty();
}

// ── Modal ─────────────────────────────────────────────────────────────────
function openModal(type) {
  const box = document.getElementById("modal-box");
  const backdrop = document.getElementById("modal-backdrop");

  if (type === "new-notebook") {
    box.innerHTML = `
      <h3>New Notebook</h3>
      <input id="m-title" type="text" placeholder="Notebook title" autofocus />
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createNotebook()">Create</button>
      </div>
    `;
    box.querySelector("#m-title").addEventListener("keydown", e => { if (e.key==="Enter") createNotebook(); });
  } else if (type === "new-folder") {
    if (!activeNotebookId) { alert("Select a notebook first"); return; }
    const folderOpts = Object.values(folders)
      .filter(f => f.name !== "/")
      .map(f => `<option value="${f.id}">${esc(f.name)}</option>`)
      .join("");
    box.innerHTML = `
      <h3>New Folder</h3>
      <input id="m-name" type="text" placeholder="Folder name" autofocus />
      <select id="m-parent">
        <option value="">Root level</option>
        ${folderOpts}
      </select>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createFolder()">Create</button>
      </div>
    `;
  }

  backdrop.classList.add("open");
  setTimeout(() => box.querySelector("input")?.focus(), 50);
}

function closeModal(e) {
  if (e && e.target !== document.getElementById("modal-backdrop")) return;
  document.getElementById("modal-backdrop").classList.remove("open");
}

async function createNotebook() {
  const title = document.getElementById("m-title")?.value?.trim();
  if (!title) return;
  document.getElementById("modal-backdrop").classList.remove("open");
  await pokeAction({ "create-notebook": title });
  setTimeout(() => loadNotebooks(), 300);
}

async function createFolder() {
  const name = document.getElementById("m-name")?.value?.trim();
  const parentVal = document.getElementById("m-parent")?.value;
  if (!name) return;
  document.getElementById("modal-backdrop").classList.remove("open");

  // Find root folder if no parent selected
  let parentFolderId = parentVal ? parseInt(parentVal) : null;
  if (!parentFolderId) {
    const rootFolder = Object.values(folders).find(f => f.name === "/");
    parentFolderId = rootFolder ? rootFolder.id : null;
  }

  await pokeAction({
    "create-folder": {
      notebookId: activeNotebookId,
      parentFolderId: parentFolderId,
      name
    }
  });
  setTimeout(() => loadFolders(activeNotebookId), 300);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    if (dirty) saveNote();
  }
});

// ── Util ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Auto-fill URL from current origin if served from ship
if (location.hostname !== "" && location.hostname !== "localhost"
    || location.port) {
  document.getElementById("ship-url-input").value = location.origin;
}

// Auto-connect when served from a ship (any HTTP origin with a port)
if (location.protocol !== "file:" && location.hostname) {
  document.getElementById("ship-url-input").value = location.origin;
  connect();
}

</script>
</body>
</html>

'''
