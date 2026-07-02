^-  @t
'''
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Open notebook in Notes</title>
<style>
  :root {
    --bg: #0f0f0f; --surface: #1a1a1a; --border: #2e2e2e;
    --text: #e8e8e8; --muted: #888; --accent: #7c6af7;
    --accent-hover: #9080ff; --danger: #e05c5c;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #ffffff; --surface: #f5f5f7; --border: #dcdce0;
      --text: #141416; --muted: #71717a; --accent: #6b58e8;
      --accent-hover: #5243d1; --danger: #c84242;
    }
  }
  * { box-sizing: border-box; }
  body {
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: var(--bg); color: var(--text);
    margin: 0; padding: 48px 24px;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh;
  }
  main {
    max-width: 460px; width: 100%;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 28px;
  }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .flag {
    font: 13px "JetBrains Mono", "Fira Code", ui-monospace, monospace;
    color: var(--accent); margin: 0 0 22px;
    word-break: break-all;
  }
  p { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0 0 12px; }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  input {
    width: 100%;
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 10px 12px; border-radius: 6px;
    font: 14px -apple-system, BlinkMacSystemFont, sans-serif;
    outline: none; margin-bottom: 4px;
  }
  input:focus { border-color: var(--accent); }
  button {
    background: var(--accent); color: #fff; border: none;
    padding: 10px 18px; border-radius: 6px;
    font: 600 14px -apple-system, sans-serif; cursor: pointer;
    margin-top: 12px;
  }
  button:hover { background: var(--accent-hover); }
  .err { color: var(--danger); font-size: 12px; min-height: 16px; margin-top: 4px; }
  .loading { text-align: center; color: var(--muted); font-size: 13px; padding: 12px 0; }
</style>
</head>
<body>
<main>
  <h1>Open shared notebook</h1>
  <div class="flag" id="flag">…</div>
  <div id="content"></div>
</main>
<script>
(function(){
  const KEY = "notes-ship-url";
  const path = location.pathname;
  const m = path.match(/^\/notes\/share\/([^/]+)\/([^/]+)\/?$/);
  const flagEl = document.getElementById("flag");
  const content = document.getElementById("content");
  if (!m) {
    flagEl.textContent = "(invalid share link)";
    content.innerHTML = "<p>This link doesn't look right. It should be /notes/share/~ship/name.</p>";
    return;
  }
  const host = decodeURIComponent(m[1]);
  const name = decodeURIComponent(m[2]);
  const flag = host + "/" + name;
  flagEl.textContent = flag;

  function targetFor(shipUrl) {
    return shipUrl.replace(/\/$/, "") + "/notes/?notebook=" + encodeURIComponent(host) + "/" + encodeURIComponent(name);
  }

  const cached = localStorage.getItem(KEY);
  if (cached) {
    content.innerHTML = '<div class="loading">Opening on your ship…</div>'
      + '<p style="text-align:center;margin-top:8px"><a href="#" id="not-mine" style="color:var(--accent);text-decoration:none;font-size:12px">Not your ship?</a></p>';
    document.getElementById("not-mine").onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem(KEY);
      location.reload();
    };
    setTimeout(() => location.href = targetFor(cached), 250);
    return;
  }

  content.innerHTML =
    '<p>Enter the URL of your Urbit ship to open this notebook on it. We\'ll remember it for next time.</p>' +
    '<label for="ship-url">Your ship URL</label>' +
    '<input id="ship-url" type="url" placeholder="https://your-ship.example" autocomplete="url" autofocus />' +
    '<div class="err" id="err"></div>' +
    '<button id="submit">Open</button>';

  function submit() {
    let v = document.getElementById("ship-url").value.trim();
    const err = document.getElementById("err");
    if (!v) { err.textContent = "Enter your ship URL"; return; }
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    try { new URL(v); } catch { err.textContent = "That doesn't look like a URL"; return; }
    localStorage.setItem(KEY, v);
    location.href = targetFor(v);
  }
  document.getElementById("submit").onclick = submit;
  document.getElementById("ship-url").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
})();
</script>
</body>
</html>
'''
