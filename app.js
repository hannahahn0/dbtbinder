/* My DBT Binder — tiny hash-routed app.
   All content (MODULES, SKILLS, OCR, PACKS) arrives encrypted in d/data.bin and is unlocked with your password. */
const $ = (s) => document.querySelector(s);
const app = $("#app");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let skillById, modById, haystack, KEY;

const saved = new Set(JSON.parse(localStorage.getItem("dbt-saved") || "[]"));
const persist = () => localStorage.setItem("dbt-saved", JSON.stringify([...saved]));

const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/* ── Encryption (AES-256-GCM, key from PBKDF2-SHA256) ── */
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
async function decrypt(key, buf) {
  const u = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, key, u.slice(12));
}
async function deriveKey(pw, lock) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64d(lock.salt), iterations: lock.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
}
const fetchBuf = (u) => new Promise((res, rej) => {
  const x = new XMLHttpRequest();
  x.open("GET", u);
  x.responseType = "arraybuffer";
  x.onload = () => ((x.status === 200 || x.status === 0) && x.response ? res(x.response) : rej(new Error(u)));
  x.onerror = () => rej(new Error(u));
  x.send();
});
const getLock = async () => JSON.parse(new TextDecoder().decode(await fetchBuf("lock.json?" + Date.now())));

async function openWithKey(key) {
  const text = new TextDecoder().decode(await decrypt(key, await fetchBuf("d/data.bin"))); // throws if key is wrong
  await new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    sc.onload = res; sc.onerror = rej;
    document.head.appendChild(sc);
  });
  KEY = key;
  start();
}

const packCache = {};
function loadPack(id) {
  if (!packCache[id]) packCache[id] = (async () => {
    const plainBytes = new Uint8Array(await decrypt(KEY, await fetchBuf(PACKS[id])));
    const hl = new DataView(plainBytes.buffer).getUint32(0);
    const header = JSON.parse(new TextDecoder().decode(plainBytes.slice(4, 4 + hl)));
    const urls = {};
    let off = 4 + hl;
    for (const [name, len] of header) {
      urls[name] = URL.createObjectURL(new Blob([plainBytes.slice(off, off + len)], { type: "image/jpeg" }));
      off += len;
    }
    return urls;
  })();
  return packCache[id];
}

function lockView(msg = "") {
  document.body.classList.add("locked");
  app.innerHTML = `<div class="lock">
    <div class="lockicon">🔒</div>
    <h1>My DBT Binder</h1>
    <p class="sub">Enter your password to open.</p>
    <form id="unlock">
      <input class="search" id="pw" type="password" placeholder="Password" autocomplete="current-password" autofocus>
      <label class="remember"><input type="checkbox" id="remember" checked> Keep me unlocked on this device</label>
      <button class="sos unlockbtn" type="submit"><span><b>Unlock</b></span></button>
      <p class="err" id="err">${esc(msg)}</p>
    </form></div>`;
  $("#unlock").onsubmit = async (e) => {
    e.preventDefault();
    const remember = $("#remember").checked;
    $("#err").textContent = "Unlocking…";
    let lock, key;
    try {
      lock = await getLock();
      key = await deriveKey($("#pw").value, lock);
      await decrypt(key, await fetchBuf("d/data.bin"));
    } catch (err) {
      $("#err").textContent = "That password didn't work. Try again.";
      return;
    }
    if (remember) localStorage.setItem("dbt-key", JSON.stringify({ salt: lock.salt, k: b64e(await crypto.subtle.exportKey("raw", key)) }));
    await openWithKey(key);
  };
}

async function boot() {
  const stored = JSON.parse(localStorage.getItem("dbt-key") || "null");
  if (stored) {
    try {
      const lock = await getLock();
      if (lock.salt !== stored.salt) throw new Error("password changed");
      const key = await crypto.subtle.importKey("raw", b64d(stored.k), "AES-GCM", true, ["decrypt"]);
      return await openWithKey(key);
    } catch (e) { localStorage.removeItem("dbt-key"); }
  }
  lockView();
}

function lockNow() {
  localStorage.removeItem("dbt-key");
  location.hash = "#/";
  location.reload();
}

function start() {
  document.body.classList.remove("locked");
  skillById = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
  modById = Object.fromEntries(MODULES.map((m) => [m.id, m]));
  haystack = Object.fromEntries(
    SKILLS.map((s) => [s.id, (s.title + " " + (s.summary || "") + " " + (s.keywords || "") + " " + plain(s.body || "") + " " + (s.pages || []).map((p) => OCR[p] || "").join(" ")).toLowerCase()])
  );
  window.addEventListener("hashchange", render);
  render();
}

function row(s) {
  return `<button class="row" onclick="location.hash='#/s/${s.id}'">
    <span><span class="t">${esc(s.title)}</span>${s.summary ? `<br><span class="d">${esc(s.summary)}</span>` : ""}</span>
    <span class="chev">›</span></button>`;
}

function home() {
  const tiles = MODULES.map((m) => {
    const n = SKILLS.filter((s) => s.module === m.id).length;
    return `<button class="tile" onclick="location.hash='#/m/${m.id}'">
      <span class="emoji">${m.emoji}</span><span><div class="t">${esc(m.title)}</div><div class="n">${n} item${n === 1 ? "" : "s"}</div></span></button>`;
  }).join("");
  return `
    <h1>My DBT Binder</h1>
    <p class="sub">Everything from IOP, in your pocket.</p>
    <input class="search" type="search" placeholder="Search skills, e.g. TIPP, validate, shame…" onfocus="location.hash='#/search'">
    <button class="sos" onclick="location.hash='#/sos'"><span class="emoji">🌊</span>
      <span><b>I'm overwhelmed right now</b>Crisis survival skills — fastest first</span></button>
    <div class="grid">${tiles}</div>`;
}

function moduleView(id) {
  const m = modById[id];
  if (!m) return notFound();
  const items = SKILLS.filter((s) => s.module === id);
  return `<button class="back" onclick="history.back()">‹ Back</button>
    <h1>${m.emoji} ${esc(m.title)}</h1><p class="sub">${esc(m.blurb || "")}</p>
    <div class="list">${items.map(row).join("")}</div>`;
}

function skillView(id) {
  const s = skillById[id];
  if (!s) return notFound();
  const m = modById[s.module];
  const pages = (s.pages || []).map((p) => `<img data-p="${p}" alt="Original binder page">`).join("");
  return `<div class="topbar"><button class="back" onclick="history.back()">‹ Back</button>
      <button class="star" id="star" aria-label="Save">${saved.has(id) ? "★" : "☆"}</button></div>
    ${m ? `<span class="tag">${m.emoji} ${esc(m.title)}</span>` : ""}
    <h1>${esc(s.title)}</h1>
    ${s.summary ? `<p class="sub">${esc(s.summary)}</p>` : ""}
    <div class="card">${s.body || ""}</div>
    ${pages ? `<details class="orig"><summary>📄 Original binder page${s.pages.length > 1 ? "s" : ""} (${s.pages.length})</summary><div class="pages">${pages}</div></details>` : ""}`;
}

function sosView() {
  const items = SOS.map((id) => skillById[id]).filter(Boolean);
  return `<button class="back" onclick="history.back()">‹ Back</button>
    <h1>🌊 Right now</h1>
    <div class="note">You don't have to fix everything. Just get through the next few minutes without making it worse.
      Start at the top. If one doesn't work, try the next.</div>
    <div class="list">${items.map(row).join("")}</div>
    <div class="note" style="margin-top:16px">If you're thinking about suicide or might act on an urge to hurt yourself, reach out now:
      <b><a href="tel:988">call 988</a></b> or <b><a href="sms:988">text 988</a></b> (Suicide &amp; Crisis Lifeline), or call 911.</div>`;
}

function searchView(q = "") {
  return `<h1>Search</h1>
    <input class="search" id="q" type="search" placeholder="Search everything…" value="${esc(q)}" autocomplete="off">
    <div id="results"></div>`;
}
function runSearch(q) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const out = $("#results");
  if (!terms.length) { out.innerHTML = `<p class="empty">Type a skill name, acronym, emotion, or anything you remember from a page.</p>`; return; }
  const hits = SKILLS.map((s) => {
    const h = haystack[s.id];
    if (!terms.every((t) => h.includes(t))) return null;
    let score = 0;
    for (const t of terms) { if (s.title.toLowerCase().includes(t)) score += 10; if ((s.keywords || "").toLowerCase().includes(t)) score += 5; score += 1; }
    return { s, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  out.innerHTML = hits.length ? `<div class="list">${hits.map((h) => row(h.s)).join("")}</div>` : `<p class="empty">Nothing found for “${esc(q)}”.</p>`;
}

function savedView() {
  const items = [...saved].map((id) => skillById[id]).filter(Boolean);
  return `<h1>Saved</h1>${items.length ? `<div class="list">${items.map(row).join("")}</div>` : `<p class="empty">Tap ☆ on any skill to keep it here for quick access.</p>`}
    <p style="text-align:center;margin-top:40px"><button class="back" onclick="lockNow()">🔒 Lock app on this device</button></p>`;
}

const notFound = () => `<button class="back" onclick="location.hash='#/'">‹ Home</button><p class="empty">Page not found.</p>`;

function render() {
  const h = location.hash.slice(1) || "/";
  const [, kind, arg] = h.split("/");
  let html, tab = "home";
  if (!kind) html = home();
  else if (kind === "m") html = moduleView(arg);
  else if (kind === "s") html = skillView(arg);
  else if (kind === "sos") html = sosView();
  else if (kind.startsWith("search")) { html = searchView(decodeURIComponent(arg || "")); tab = "search"; }
  else if (kind === "saved") { html = savedView(); tab = "saved"; }
  else html = notFound();
  app.innerHTML = html;
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  if (kind && kind.startsWith("search")) {
    const q = $("#q");
    q.focus();
    runSearch(q.value);
    q.addEventListener("input", () => { runSearch(q.value); history.replaceState(null, "", "#/search/" + encodeURIComponent(q.value)); });
  } else window.scrollTo(0, 0);
  const star = $("#star");
  if (star) star.onclick = () => { saved.has(arg) ? saved.delete(arg) : saved.add(arg); persist(); star.textContent = saved.has(arg) ? "★" : "☆"; };
  const orig = document.querySelector("details.orig");
  if (orig) orig.addEventListener("toggle", () => {
    if (!orig.open) return;
    loadPack(arg).then((urls) => orig.querySelectorAll("img[data-p]").forEach((i) => { i.src = urls[i.dataset.p]; }))
      .catch(() => { orig.querySelector(".pages").innerHTML = `<p class="empty">Couldn't load the page photos. Check your connection and try again.</p>`; });
  });
}

boot();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
