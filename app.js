'use strict';
/* ===== DualCode : P2P (PeerJS / WebRTC) — le Host est le hub, N invités ===== */
const PREFIX = 'dualcode-';
const MODES = { secure: 'Mode sécurisé (Host auto-approuvé)', mutual: 'Validation mutuelle', free: 'Mode Libre P2P' };
const LANGS = { js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', html: 'html', css: 'css', json: 'json', md: 'markdown', py: 'python', java: 'java', c: 'c', cpp: 'cpp', php: 'php', xml: 'xml', yml: 'yaml', yaml: 'yaml', sh: 'shell', sql: 'sql' };
const COLORS = ['#f5a623', '#4ec9b0', '#c586c0', '#569cd6', '#f14c4c', '#b5cea8'];
const RELAY = new Set(['edit', 'sync', 'fcreate', 'fdelete', 'cursor', 'chat']);
const $ = s => document.querySelector(s);
const show = (s, on) => $(s).classList.toggle('hidden', !on);
const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt !== undefined) x.textContent = txt; return x; };
const langOf = n => LANGS[n.split('.').pop().toLowerCase()] || 'plaintext';
const cIdx = id => [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length;

let peer, conn, isHost = false, code = '', mode = 'secure', myName = '', myId = '';
let editor, active = null, remote = false, remoteDec = [], pendDec = [];
let startedAt = 0, startFiles = null, sel = '', tabs = [], chain = Promise.resolve(), cid = 0, members = [], queue = [], drag = null;
const guests = {}, models = {}, dirs = new Set(), col = {}, bufs = {}, remoteCurs = {};
const pe = {}, pc = {}, pd = {}; // en attente de validation : éditions / créations / suppressions
let stopping = false, ended = false;
const V = { on: false, stream: null, deaf: false }, calls = {}, auds = {}, vols = {};

/* ---------- Réseau (hub & spokes, messages découpés) ---------- */
const CH = 4000;
function raw(c, m) {
  if (!c || !c.open) return;
  const s = JSON.stringify(m);
  if (s.length <= CH) return c.send(m);
  const id = ++cid, n = Math.ceil(s.length / CH);
  for (let i = 0; i < n; i++) c.send({ t: 'chunk', id, i, n, d: s.slice(i * CH, (i + 1) * CH) });
}
function send(m) { if (isHost) Object.values(guests).forEach(g => raw(g.c, { ...m, from: 'host' })); else raw(conn, m); }
const sendTo = (id, m) => { const g = guests[id]; if (g) raw(g.c, { ...m, from: 'host' }); };
const to = (id, m) => isHost ? sendTo(id, m) : send(m);
const bcast = (m, except) => Object.entries(guests).forEach(([id, g]) => id !== except && raw(g.c, m));
const peers = () => isHost ? Object.keys(guests).length > 0 : !!(conn && conn.open);
function recv(d, src, key) {
  if (d.t !== 'chunk') return handle(d, src);
  const k = key + d.id, b = bufs[k] || (bufs[k] = { p: [], c: 0 });
  b.p[d.i] = d.d;
  if (++b.c === d.n) { delete bufs[k]; handle(JSON.parse(b.p.join('')), src); }
}
const handle = (d, src) => { chain = chain.then(() => onMsg(d, src)).catch(console.error); };

const asRemote = fn => { remote = true; try { fn(); } finally { remote = false; } };
const getFiles = () => Object.fromEntries(Object.entries(models).map(([n, m]) => [n, m.getValue()]));
const fullReplace = (m, text) => asRemote(() => m.applyEdits([{ range: m.getFullModelRange(), text }]));
const under = (o, p) => Object.keys(o).some(k => p === k || p.startsWith(k + '/'));
const isLive = () => mode === 'free' || (mode === 'secure' && isHost);
const setStatus = t => $('#conn-status').textContent = t;
const dn = m => m.name + (m.host ? ' (HOST)' : '');
const nameOf = id => { const m = members.find(x => x.id === id); return m ? dn(m) : '?'; };
const myPid = () => isHost ? PREFIX + code : peer.id;
function toast(t) {
  const e = $('#toast'); e.textContent = t; e.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.add('hidden'), 3500);
}

/* ---------- Monaco ---------- */
const monacoReady = new Promise(res => {
  const root = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min';
  window.MonacoEnvironment = {
    getWorkerUrl: () => URL.createObjectURL(new Blob(
      [`self.MonacoEnvironment={baseUrl:'${root}/'};importScripts('${root}/vs/base/worker/workerMain.js');`], { type: 'text/javascript' }))
  };
  require.config({ paths: { vs: root + '/vs' } });
  require(['vs/editor/editor.main'], res);
});

async function openEditor(files, dl, act) {
  await monacoReady;
  show('#lobby', false); show('#app', true);
  $('#session-code').textContent = code;
  $('#role-badge').textContent = (isHost ? '● HOST — ' : '● ') + myName;
  show('#btn-settings', isHost); show('#btn-stop', isHost); updateMode(); updVoiceUI();
  if (!editor) {
    editor = monaco.editor.create($('#editor'), { theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 14, model: null });
    editor.onDidChangeCursorPosition(e => send({ t: 'cursor', f: active, p: { lineNumber: e.position.lineNumber, column: e.position.column } }));
  }
  dl.forEach(d => dirs.add(d));
  for (const n in files) addFile(n, files[n], false);
  openFile(act && models[act] ? act : Object.keys(models).sort()[0]);
}

/* ---------- Lobby ---------- */
const genId = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 4 }, () => c[Math.random() * c.length | 0]).join(''); };
function pseudo() {
  myName = $('#pseudo').value.trim().slice(0, 16);
  if (!myName) { $('#lobby-status').textContent = 'Choisis d\'abord un pseudo.'; $('#pseudo').focus(); return false; }
  return true;
}
$('#btn-create').onclick = () => { if (pseudo()) { isHost = true; startHost(); } };

function startHost() {
  code = genId(); peer = new Peer(PREFIX + code); setupCalls();
  peer.on('open', async () => {
    startedAt = Date.now(); myId = 'host';
    members = [{ id: 'host', name: myName, host: true, pid: PREFIX + code }];
    await openEditor(startFiles || { 'index.html': '<h1>Hello DualCode</h1>\n', 'script.js': 'console.log("Hello DualCode");\n' }, [], null);
    renderMembers(); setStatus('⏳ En attente d\'invités…');
  });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); startHost(); } else alert('Erreur P2P : ' + e.type); });
  peer.on('connection', c => {
    if (stopping) { c.on('open', () => { c.send({ t: 'closed' }); setTimeout(() => c.close(), 300); }); return; }
    queue.push(c); showJoin();
    c.on('data', d => { const g = guests[c.peer]; if (g && g.c === c) recv(d, c.peer, c.peer); });
    c.on('close', () => {
      queue = queue.filter(x => x !== c);
      const g = guests[c.peer];
      if (g && g.c === c) {
        delete guests[c.peer]; members = members.filter(m => m.id !== c.peer); delete remoteCurs[c.peer];
        if (!stopping) toast('👋 ' + g.name + ' a quitté la session'); pushMembers(); drawCursor();
      }
      showJoin();
    });
  });
}
function showJoin() {
  const c = queue[0];
  if (c) $('#join-name').textContent = (c.metadata && c.metadata.name) || 'Un utilisateur';
  show('#modal-join', !!c);
}
function pushMembers(except) { bcast({ t: 'members', list: members, from: 'host' }, except); renderMembers(); syncCalls(); }

$('#btn-accept').onclick = () => {
  const c = queue.shift(); showJoin(); if (!c) return;
  let name = ((c.metadata && c.metadata.name) || 'Invité').slice(0, 16); const b = name; let i = 2;
  while (members.some(m => m.name.toLowerCase() === name.toLowerCase())) name = b + ' ' + i++;
  guests[c.peer] = { c, name }; members.push({ id: c.peer, name, pid: c.peer });
  const go = () => {
    raw(c, { t: 'init', from: 'host', files: getFiles(), dirs: [...dirs], mode, active, elapsed: Date.now() - startedAt, members, id: c.peer });
    pushMembers(c.peer); toast('👋 ' + name + ' a rejoint la session'); setStatus('🟢 Session active');
  };
  c.open ? go() : c.on('open', go);
};
$('#btn-refuse').onclick = () => {
  const c = queue.shift(); showJoin(); if (!c) return;
  if (c.open) { c.send({ t: 'refused' }); setTimeout(() => c.close(), 300); } else c.close();
};

$('#join-code').oninput = e => e.target.value = e.target.value.toUpperCase();
$('#join-code').onkeydown = e => { if (e.key === 'Enter') $('#btn-join').click(); };
$('#btn-join').onclick = () => {
  if (!pseudo()) return;
  const c = $('#join-code').value.trim().toUpperCase();
  if (c.length !== 4) return $('#lobby-status').textContent = 'Entrez un code à 4 caractères.';
  code = c; isHost = false; $('#btn-join').disabled = true;
  $('#lobby-status').textContent = 'Connexion… en attente de l\'approbation de l\'hôte.';
  peer = new Peer(); setupCalls();
  peer.on('open', () => {
    conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json', metadata: { name: myName } });
    conn.on('data', d => recv(d, null, 'h'));
    conn.on('close', () => { if (!ended) endGuest('Session terminée', 'La connexion avec l\'hôte a été perdue.'); });
  });
  peer.on('error', e => { alert(e.type === 'peer-unavailable' ? 'Session introuvable.' : 'Erreur P2P : ' + e.type); location.reload(); });
};
$('#btn-copy').onclick = () => navigator.clipboard.writeText(code).then(() => {
  $('#btn-copy').textContent = 'Copié ✔'; setTimeout(() => $('#btn-copy').textContent = 'Copier le code', 1500);
});

/* ---------- Messages ---------- */
async function onMsg(d, src) {
  const by = isHost ? src : (d.from || 'host');
  switch (d.t) {
    case 'refused': alert('Connexion refusée par l\'hôte'); location.reload(); break;
    case 'closed': if (!isHost) endGuest('Session arrêtée', 'L\'hôte a arrêté la session.'); break;
    case 'kicked': if (!isHost) endGuest('Expulsé', 'Tu as été expulsé de la session par l\'hôte.'); break;
    case 'init':
      mode = d.mode; myId = d.id; members = d.members; startedAt = Date.now() - d.elapsed;
      await openEditor(d.files, d.dirs, d.active);
      renderMembers(); setStatus('🟢 Connecté à l\'hôte'); break;
    case 'members': members = d.list; renderMembers(); syncCalls(); break;
    case 'voice': { const m = members.find(x => x.id === by); if (isHost && m) { m.voice = d.on; pushMembers(); } break; }
    case 'settings': mode = d.mode; updateMode(); break;
    case 'edit': {
      const m = models[d.f]; if (!m) break;
      if (d.p && !pe[d.f] && !under(pc, d.f)) pe[d.f] = { b: m.getValue(), by };
      asRemote(() => m.applyEdits(d.c.map(x => ({ range: x.r, text: x.t }))));
      if (d.p) renderAll();
      break;
    }
    case 'sync': {
      const m = models[d.f]; if (m) fullReplace(m, d.content);
      if (d.r && d.u === myId) toast('✖ Modifications de ' + d.f + ' refusées : fichier restauré');
      break;
    }
    case 'fcreate':
      delete pd[d.n];
      d.dir ? addDir(d.n, false) : addFile(d.n, d.content, false);
      if (d.p) pc[d.n] = { dir: !!d.dir, by };
      renderAll(); break;
    case 'fdelete':
      if (d.p) { pd[d.n] = { dir: !!d.dir, by }; renderAll(); }
      else d.dir ? removeDir(d.n, false) : removeFile(d.n, false);
      break;
    case 'res': toast(d.m); break;
    case 'cursor': remoteCurs[by] = { f: d.f, p: d.p }; drawCursor(); break;
    case 'chat': addMsg(nameOf(by), d.m, false); break;
  }
  // le Host relaie aux autres invités (les suppressions en attente ne sont relayées qu'une fois acceptées)
  if (isHost && RELAY.has(d.t) && !(d.t === 'fdelete' && d.p)) bcast({ ...d, p: 0, from: by }, by);
}

/* ---------- Fichiers & dossiers ---------- */
function addFile(n, content, bc = true, p = 0) {
  if (models[n]) return;
  const m = models[n] = monaco.editor.createModel(content, langOf(n), monaco.Uri.parse('file:///' + n));
  m.onDidChangeContent(e => { if (!remote) localChange(n, e); });
  if (bc) send({ t: 'fcreate', n, content, p });
  renderAll();
}
function addDir(n, bc = true, p = 0) { dirs.add(n); if (bc) send({ t: 'fcreate', n, dir: 1, p }); renderAll(); }
function removeFile(n, bc = true, p = 0) {
  const m = models[n]; if (!m) return;
  delete models[n]; delete pe[n]; delete pc[n]; delete pd[n];
  tabs = tabs.filter(x => x !== n);
  if (active === n) openFile(tabs[tabs.length - 1] || Object.keys(models).sort()[0]);
  m.dispose();
  if (bc) send({ t: 'fdelete', n, p });
  renderAll();
}
function removeDir(n, bc = true, p = 0) {
  const u = x => x === n || x.startsWith(n + '/');
  Object.keys(models).filter(u).forEach(k => removeFile(k, false));
  [...dirs].filter(u).forEach(k => dirs.delete(k));
  [pc, pd].forEach(o => Object.keys(o).filter(u).forEach(k => delete o[k]));
  if (bc) send({ t: 'fdelete', n, dir: 1, p });
  renderAll();
}
function openFile(n) {
  if (n && !tabs.includes(n)) tabs.push(n);
  active = n || null; editor.setModel(n ? models[n] : null); renderAll();
}
const pend = () => peers() && !isLive() ? 1 : 0;
function fileOp(op, n, content = '', dir = false) {
  const p = pend();
  if (op === 'create') { if (dir) addDir(n, true, p); else { addFile(n, content, true, p); openFile(n); } }
  else dir ? removeDir(n, true, p) : removeFile(n, true, p);
  if (p) toast('Visible en direct chez les autres, en attente de validation…');
}
function restore(k, dir, by) {
  const u = x => x === k || x.startsWith(k + '/');
  if (dir) dirs.forEach(d => u(d) && to(by, { t: 'fcreate', n: d, dir: 1 }));
  Object.keys(models).filter(u).forEach(p => to(by, { t: 'fcreate', n: p, content: models[p].getValue() }));
}
const exists = n => models[n] || dirs.has(n) || Object.keys(models).some(p => p.startsWith(n + '/'));
const nameOk = n => /^[\w\-.\/]+$/.test(n) && !/(^|\/)\.\.?(\/|$)/.test(n) && !n.startsWith('/') && !n.endsWith('/');
function ask(dir, parent = sel) {
  let n = (prompt(dir ? 'Nom du dossier (ex : src/utils)' : 'Nom du fichier (ex : main.js)') || '').trim();
  if (!n) return;
  if (parent) n = parent + '/' + n;
  if (!nameOk(n)) return alert('Nom invalide.');
  if (exists(n)) return alert('Existe déjà.');
  fileOp('create', n, '', dir);
}
const delItem = (path, dir) => { if (confirm('Supprimer ' + path + (dir ? ' et tout son contenu' : '') + ' ?')) fileOp('delete', path, '', dir); };
$('#btn-newfile').onclick = () => ask(false);
$('#btn-newdir').onclick = () => ask(true);

// Déplacement = création au nouvel emplacement + suppression de l'ancien (donc soumis aux mêmes validations)
function moveItem(a, destDir, dir) {
  const b = (destDir ? destDir + '/' : '') + a.split('/').pop();
  if (a === b || (dir && (destDir === a || destDir.startsWith(a + '/')))) return;
  if (exists(b)) return alert('Un élément du même nom existe déjà à destination.');
  const p = pend(), was = active, u = x => x.startsWith(a + '/');
  if (dir) {
    addDir(b, true, p); [...dirs].filter(u).forEach(d => addDir(b + d.slice(a.length), true, p));
    Object.keys(models).filter(u).forEach(k => addFile(b + k.slice(a.length), models[k].getValue(), true, p));
    removeDir(a, true, p);
  } else { addFile(b, models[a].getValue(), true, p); removeFile(a, true, p); }
  const na = was && (dir ? (u(was) ? b + was.slice(a.length) : null) : (was === a ? b : null));
  if (na) openFile(na);
  if (p) toast('Déplacement visible en direct, en attente de validation…');
}

const makeZip = () => {
  const z = new JSZip();
  dirs.forEach(d => z.folder(d));
  for (const [n, c] of Object.entries(getFiles())) z.file(n, c);
  return z.generateAsync({ type: 'blob' });
};
$('#btn-export').onclick = () => makeZip().then(b => saveAs(b, 'dualcode-' + code + '.zip'));

/* ---------- Menu clic droit ---------- */
function ctxMenu(e, path, dir) {
  e.preventDefault(); e.stopPropagation();
  const parent = path === null ? '' : dir ? path : path.split('/').slice(0, -1).join('/');
  const items = [['🗎  Nouveau fichier ici', () => ask(false, parent)], ['🗀  Nouveau dossier ici', () => ask(true, parent)]];
  if (path !== null) items.push(['🗑  Supprimer', () => delItem(path, dir)]);
  const m = $('#ctx'); m.innerHTML = '';
  items.forEach(([t, f]) => { const b = el('div', 'ci', t); b.onclick = () => { show('#ctx', false); f(); }; m.append(b); });
  m.style.left = Math.min(e.clientX, innerWidth - 200) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 110) + 'px';
  show('#ctx', true);
}
document.addEventListener('click', () => show('#ctx', false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') show('#ctx', false); });
$('#tree').oncontextmenu = e => { if (e.target.id === 'tree') ctxMenu(e, null, true); };
$('#tree').onclick = e => { if (e.target.id === 'tree') { sel = ''; renderTree(); } };
$('#tree').ondragover = e => e.preventDefault();
$('#tree').ondrop = e => { e.preventDefault(); if (drag) { moveItem(drag.path, '', drag.dir); drag = null; } };

/* ---------- Rendu ---------- */
function renderAll() { if (!editor) return; renderTree(); renderTabs(); renderProps(); drawCursor(); }

function renderTree() {
  const root = { d: {} };
  const add = (p, dir) => { let n = root; p.split('/').forEach((s, i, a) => { n = n.d[s] ??= { d: {}, path: a.slice(0, i + 1).join('/'), dir: true }; }); n.dir = dir; };
  dirs.forEach(p => add(p, true)); Object.keys(models).forEach(p => add(p, false));
  const box = $('#tree'); box.innerHTML = '';
  const walk = (node, dep) => Object.values(node.d).sort((a, b) => (b.dir - a.dir) || a.path.localeCompare(b.path)).forEach(c => {
    const open = c.dir && !col[c.path];
    const r = el('div', 'tr' + (c.path === active ? ' active' : '') + (c.dir && c.path === sel ? ' sel' : '') + (under(pd, c.path) ? ' del' : under(pc, c.path) ? ' new' : ''));
    r.style.paddingLeft = 8 + dep * 14 + 'px'; r.draggable = true;
    r.append(el('span', '', c.dir ? (open ? '▾ 📂' : '▸ 📁') : '📄'), el('span', '', c.path.split('/').pop()));
    const x = el('button', 'icon x', '✖');
    x.onclick = e => { e.stopPropagation(); delItem(c.path, c.dir); };
    r.append(x);
    r.onclick = () => {
      if (c.dir) { col[c.path] = open; sel = c.path; renderTree(); }
      else { sel = c.path.split('/').slice(0, -1).join('/'); openFile(c.path); }
    };
    r.oncontextmenu = e => ctxMenu(e, c.path, c.dir);
    r.ondragstart = e => { drag = { path: c.path, dir: c.dir }; e.dataTransfer.setData('text/plain', c.path); };
    r.ondragover = e => { e.preventDefault(); r.classList.add('drop'); };
    r.ondragleave = () => r.classList.remove('drop');
    r.ondrop = e => {
      e.preventDefault(); e.stopPropagation(); r.classList.remove('drop');
      if (drag) { moveItem(drag.path, c.dir ? c.path : c.path.split('/').slice(0, -1).join('/'), drag.dir); drag = null; }
    };
    box.append(r);
    if (open) walk(c, dep + 1);
  });
  walk(root, 0);
}

function renderTabs() {
  const t = $('#tabs'); t.innerHTML = '';
  tabs.forEach(n => {
    const b = el('div', 'tab' + (n === active ? ' active' : '') + (under(pd, n) ? ' del' : under(pc, n) ? ' new' : ''));
    b.append(el('span', '', n.split('/').pop() + (pe[n] ? ' ●' : '')));
    const x = el('button', 'icon', '✖');
    x.onclick = e => { e.stopPropagation(); tabs = tabs.filter(k => k !== n); if (active === n) openFile(tabs[tabs.length - 1]); else renderTabs(); };
    b.append(x); b.onclick = () => openFile(n); t.append(b);
  });
}

function diffOf(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  let p = 0, s = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  return { at: p + 1, del: A.slice(p, A.length - s), add: B.slice(p, B.length - s) };
}

function renderProps() {
  const box = $('#props'); box.innerHTML = '';
  const res = (by, m) => to(by, { t: 'res', m });
  const card = (title, body, ok, ko) => {
    const c = el('div', 'prop'), r = el('div', 'row'), a = el('button', 'btn ok', '✔ Accepter'), b = el('button', 'btn danger', '✖ Refuser');
    a.onclick = ok; b.onclick = ko; r.append(a, b);
    c.append(el('div', 'prop-h', title)); if (body) c.append(body); c.append(r); box.append(c);
  };
  Object.entries(pc).forEach(([k, v]) => card(`${nameOf(v.by)} crée ${v.dir ? 'le dossier' : 'le fichier'} : ${k}`, null,
    () => { delete pc[k]; res(v.by, '✔ Création de ' + k + ' acceptée'); renderAll(); },
    () => { v.dir ? removeDir(k) : removeFile(k); res(v.by, '✖ Création de ' + k + ' refusée'); }));
  Object.entries(pd).forEach(([k, v]) => card(`${nameOf(v.by)} supprime ${v.dir ? 'le dossier' : 'le fichier'} : ${k}`, null,
    () => { delete pd[k]; v.dir ? removeDir(k, false) : removeFile(k, false); if (isHost) send({ t: 'fdelete', n: k, dir: v.dir ? 1 : 0 }); res(v.by, '✔ Suppression de ' + k + ' acceptée'); },
    () => { delete pd[k]; restore(k, v.dir, v.by); res(v.by, '✖ Suppression de ' + k + ' refusée : restauré'); renderAll(); }));
  Object.keys(pe).forEach(n => {
    const m = models[n], v = pe[n];
    if (!m || m.getValue() === v.b) { delete pe[n]; return; }
    const d = diffOf(v.b, m.getValue()), pre = el('pre');
    d.del.slice(0, 8).forEach(l => pre.append(el('div', 'del', '- ' + l)));
    d.add.slice(0, 8).forEach(l => pre.append(el('div', 'add', '+ ' + l)));
    card(`${n} — ligne ${d.at} (${nameOf(v.by)}, en direct)`, pre,
      () => { delete pe[n]; res(v.by, '✔ Modifications de ' + n + ' acceptées'); renderAll(); },
      () => { delete pe[n]; fullReplace(m, v.b); send({ t: 'sync', f: n, content: v.b, r: 1, u: v.by }); renderAll(); });
  });
  const count = Object.keys(pc).length + Object.keys(pd).length + Object.keys(pe).length;
  $('#prop-count').textContent = count;
  if (!count) box.append(el('p', 'muted', 'Aucune modification en attente.'));
  const b = active && pe[active];
  editor.updateOptions({ readOnly: !active || !!b, readOnlyMessage: { value: 'Modification en attente : acceptez ou refusez-la d\'abord.' } });
  let dec = [];
  if (b) {
    const m = models[active], d = diffOf(b.b, m.getValue()), L = m.getLineCount();
    const s = Math.min(d.at, L), e = Math.min(Math.max(s, d.at + d.add.length - 1), L);
    dec = [{ range: new monaco.Range(s, 1, e, 1), options: { isWholeLine: true, className: 'pending-line' } }];
  }
  pendDec = editor.deltaDecorations(pendDec, dec);
}

function localChange(n, e) {
  if (!peers()) return;
  send({ t: 'edit', f: n, p: isLive() ? 0 : 1, c: e.changes.map(x => ({ r: x.range, t: x.text })) });
}
function drawCursor() {
  if (!editor) return;
  const decs = [];
  Object.entries(remoteCurs).forEach(([id, c]) => {
    if (c.f && c.f === active && c.p) decs.push({
      range: new monaco.Range(c.p.lineNumber, c.p.column, c.p.lineNumber, c.p.column),
      options: { beforeContentClassName: 'rc' + cIdx(id), hoverMessage: { value: nameOf(id) } }
    });
  });
  remoteDec = editor.deltaDecorations(remoteDec, decs);
}

/* ---------- Participants ---------- */
function renderMembers() {
  const box = $('#members'); box.innerHTML = '';
  members.forEach(m => {
    const r = el('div', 'mem'), dot = el('span', 'dot'); dot.style.background = COLORS[cIdx(m.id)];
    r.append(dot, el('span', '', dn(m) + (m.id === myId ? ' (moi)' : '') + (m.voice ? ' 🎙' : '')));
    if (m.voice && V.on && m.pid !== myPid()) {
      const s = el('input'); s.type = 'range'; s.min = 0; s.max = 100; s.value = vols[m.pid] ?? 100; s.title = 'Volume de ' + m.name;
      s.oninput = () => { vols[m.pid] = +s.value; if (auds[m.pid]) auds[m.pid].volume = s.value / 100; };
      r.append(s);
    }
    if (isHost && m.id !== 'host') { const k = el('button', 'icon', '⛔'); k.title = 'Expulser ' + m.name; k.onclick = () => kick(m.id); r.append(k); }
    box.append(r);
  });
  document.querySelectorAll('.cnt').forEach(e => e.textContent = members.length);
  $('#vcount').textContent = members.filter(m => m.voice).length;
}

/* ---------- Paramètres (Host) ---------- */
function updateMode() { $('#mode-label').textContent = MODES[mode]; }
$('#btn-settings').onclick = () => { document.querySelector(`input[name=mode][value=${mode}]`).checked = true; show('#modal-settings', true); };
$('#btn-close-settings').onclick = () => show('#modal-settings', false);
document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = () => { mode = r.value; updateMode(); send({ t: 'settings', mode }); });

/* ---------- Chrono ---------- */
setInterval(() => {
  if (!startedAt) return;
  const s = (Date.now() - startedAt) / 1000 | 0;
  $('#timer').textContent = '⏱ ' + [s / 3600 | 0, s / 60 % 60 | 0, s % 60].map(x => String(x).padStart(2, '0')).join(':');
}, 1000);

/* ---------- Chat ---------- */
function addMsg(who, text, me) {
  const d = el('div', 'msg' + (me ? ' me' : '')); d.append(el('b', '', who + ' : '), el('span', '', text));
  $('#msgs').append(d); $('#msgs').scrollTop = 1e9;
}
function sendChat() {
  const i = $('#chat-input'), t = i.value.trim(); if (!t) return;
  if (!peers()) return toast('Personne d\'autre n\'est connecté.');
  send({ t: 'chat', m: t }); addMsg('Moi', t, true); i.value = '';
}
$('#chat-send').onclick = sendChat;
$('#chat-input').onkeydown = e => { if (e.key === 'Enter') sendChat(); };

/* ---------- Salon vocal (optionnel, audio P2P direct, appels en maillage) ---------- */
function setupCalls() {
  peer.on('call', c => {
    if (!V.on || !members.some(m => m.pid === c.peer)) return c.close();
    c.answer(V.stream); attach(c.peer, c);
  });
}
function attach(p, c) {
  calls[p] = c;
  c.on('stream', s => {
    const a = auds[p] || (auds[p] = new Audio());
    a.srcObject = s; a.volume = (vols[p] ?? 100) / 100; a.muted = V.deaf; a.play().catch(() => {});
  });
  c.on('close', () => { if (calls[p] === c) { delete calls[p]; dropAud(p); } });
}
function dropAud(p) { const a = auds[p]; if (a) { a.srcObject = null; delete auds[p]; } }
function syncCalls() {
  const me = myPid(), want = new Set(V.on ? members.filter(m => m.voice && m.pid !== me).map(m => m.pid) : []);
  Object.keys(calls).forEach(p => { if (!want.has(p)) { calls[p].close(); delete calls[p]; dropAud(p); } });
  want.forEach(p => { if (!calls[p] && me < p) attach(p, peer.call(p, V.stream)); }); // un seul appel par paire
}
function setVoice(on) {
  const me = members.find(m => m.id === myId); if (me) me.voice = on;
  if (isHost) pushMembers(); else { send({ t: 'voice', on }); renderMembers(); }
  syncCalls();
}
function updVoiceUI() {
  show('#v-join', !V.on); ['#v-mic', '#v-deaf', '#v-leave'].forEach(s => show(s, V.on));
  if (V.on) {
    $('#v-mic').textContent = V.stream.getAudioTracks()[0].enabled ? '🎙 Micro : ON' : '🔇 Micro : OFF';
    $('#v-deaf').textContent = V.deaf ? '🔇 Son : OFF' : '🔊 Son : ON';
  }
  renderMembers();
}
$('#v-join').onclick = async () => {
  try { V.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return toast('Micro refusé ou indisponible.'); }
  V.on = true; setVoice(true); updVoiceUI();
};
$('#v-leave').onclick = () => {
  V.on = false; V.stream.getTracks().forEach(t => t.stop()); V.stream = null;
  setVoice(false); updVoiceUI();
};
$('#v-mic').onclick = () => { const t = V.stream.getAudioTracks()[0]; t.enabled = !t.enabled; updVoiceUI(); };
$('#v-deaf').onclick = () => { V.deaf = !V.deaf; Object.values(auds).forEach(a => a.muted = V.deaf); updVoiceUI(); };

/* ---------- Import d'un dossier de départ (Host) ---------- */
$('#import-dir').onchange = async e => {
  const out = {}; let skipped = 0;
  for (const f of e.target.files) {
    const rel = (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name;
    if (/(^|\/)(node_modules|\.git|\.next|dist)\//.test(rel) || /(^|\/)\.env/.test(rel) || f.size > 1e6) { skipped++; continue; }
    const txt = await f.text();
    if (txt.includes('\0')) { skipped++; continue; }
    out[rel.replace(/[^\w\-.\/]/g, '_')] = txt;
  }
  const n = Object.keys(out).length;
  startFiles = n ? out : null;
  $('#import-status').textContent = n ? `✔ ${n} fichier(s) prêt(s)` + (skipped ? ` (${skipped} ignoré(s))` : '') : 'Aucun fichier texte exploitable.';
};

/* ---------- Expulsion, arrêt de la session, écran de fin ---------- */
function showOv(title, text, count, btn) {
  $('#ov-title').textContent = title; $('#ov-text').textContent = text;
  $('#ov-count').textContent = count ?? ''; show('#ov-count', count != null);
  show('#ov-btn', !!btn); if (btn) { $('#ov-btn').textContent = btn.label; $('#ov-btn').onclick = btn.fn; }
  show('#overlay', true);
}
function endLocal() {
  if (V.on) { V.on = false; V.stream.getTracks().forEach(t => t.stop()); V.stream = null; }
  Object.values(calls).forEach(c => c.close()); Object.keys(calls).forEach(k => delete calls[k]);
  Object.keys(auds).forEach(dropAud);
}
function endGuest(title, text) {
  if (ended) return; ended = true; endLocal();
  if ($('#app').classList.contains('hidden')) { alert(text); return location.reload(); }
  showOv(title, text, null, { label: 'Retour à l\'accueil', fn: () => location.reload() });
  try { peer.destroy(); } catch {}
}
function kick(id) {
  const g = guests[id];
  if (!g || !confirm('Expulser ' + g.name + ' de la session ?')) return;
  sendTo(id, { t: 'kicked' }); setTimeout(() => g.c.close(), 300);
}
$('#btn-stop').onclick = () => {
  if (stopping || !confirm('Arrêter la session ? Tout le monde sera expulsé immédiatement et plus personne ne pourra rejoindre.')) return;
  stopping = true;
  queue.splice(0).forEach(c => { if (c.open) { c.send({ t: 'closed' }); setTimeout(() => c.close(), 300); } else c.close(); });
  showJoin(); show('#modal-settings', false); show('#ctx', false);
  finishSession();
};
async function finishSession() {
  send({ t: 'closed' });
  Object.values(guests).forEach(g => setTimeout(() => g.c.close(), 600));
  endLocal();
  showOv('Session arrêtée', 'Tout le monde a été déconnecté. Création du ZIP du projet…', null);
  try {
    saveAs(await makeZip(), 'dualcode-' + code + '.zip');
    showOv('Session arrêtée', '✔ Le projet a été téléchargé en ZIP. Tu peux maintenant quitter.', null, { label: 'Quitter', fn: () => location.reload() });
  } catch { showOv('Session arrêtée', '⚠ Échec du ZIP automatique.', null, { label: 'Réessayer', fn: finishSession }); }
  setTimeout(() => { try { peer.destroy(); } catch {} }, 1500);
}
