const PROMPTS = [
  {
    act: 'Act I',
    text: 'Look into the lens.\nRelax your face.',
    sub: 'Keep it simple'
  },
  {
    act: 'Act II',
    text: 'Shift your body slightly.\nKeep your eyes soft.',
    sub: 'Let it feel natural'
  },
  {
    act: 'Act III',
    text: 'Look away for a second.\nLike you\'re thinking of something.',
    sub: 'Keep it effortless'
  },
  {
    act: 'Act IV',
    text: 'Do something a little unexpected.\nMake it memorable.',
    sub: 'One last moment'
  }
];

const S = {
  code: null,
  isDuet: false,
  isHost: false,
  idx: 0,
  photosYou: [],
  photosPartner: [],
  localStream: null,
  peer: null,
  conn: null,
  call: null,
  youReady: false,
  partnerReady: false,
  orient: 'vert',
  stamp: null
};

/* ── NAV ── */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goToSession() {
  show('s-session');
}

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

/* ── ORIENTATION PICKER ── */
function pickOrient(o) {
  S.orient = o;
  document.getElementById('oc-horiz').classList.toggle('selected', o === 'horiz');
  document.getElementById('oc-vert').classList.toggle('selected', o === 'vert');
}

function confirmOrient() {
  beginShoot();
}

/* ── SESSION FLOWS ── */
function startSolo() {
  S.code = 'SOLO';
  S.isDuet = false;
  S.isHost = false;
  show('s-orient');
}

function createSession() {
  S.code = genCode();
  S.isDuet = true;
  S.isHost = true;
  document.getElementById('wait-code').textContent = S.code;
  setBadge('waiting', 'Initialising…');
  show('s-waiting');
  initHost();
}

function joinSession() {
  const v = document.getElementById('join-input').value.trim().toUpperCase();
  if (v.length < 3) {
    alert('Enter a valid 4-character code');
    return;
  }
  S.code = v;
  S.isDuet = true;
  S.isHost = false;
  document.getElementById('wait-code').textContent = S.code;
  setBadge('waiting', 'Connecting…');
  show('s-waiting');
  initGuest();
}

function cancelWait() {
  cleanup();
  show('s-session');
}

function setBadge(state, txt) {
  document.getElementById('conn-badge').className = 'conn-badge ' + state;
  document.getElementById('conn-txt').textContent = txt;
}

/* ── PEERJS HOST ── */
function initHost() {
  S.peer = new Peer('interlinked-host-' + S.code, { debug: 0 });

  S.peer.on('open', () => setBadge('waiting', 'Waiting for partner…'));

  S.peer.on('connection', conn => {
    S.conn = conn;

    conn.on('open', () => {
      setBadge('connected', 'Partner connected ✦');
      conn.on('data', handleData);
      show('s-orient');
    });

    conn.on('close', () => setBadge('error', 'Partner disconnected'));
  });

  S.peer.on('call', call => {
    S.call = call;
    call.answer(S.localStream || undefined);
    call.on('stream', remote => showPartnerVid(remote));
  });

  S.peer.on('error', e => {
    setBadge('error', 'Error. Try refreshing');
    console.warn(e);
  });

  getCamera();
}

/* ── PEERJS GUEST ── */
function initGuest() {
  const hostId = 'interlinked-host-' + S.code;
  const guestId = 'interlinked-guest-' + S.code + '-' + Date.now();
  S.peer = new Peer(guestId, { debug: 0 });

  S.peer.on('open', async () => {
    S.conn = S.peer.connect(hostId, { reliable: true });

    S.conn.on('open', () => {
      setBadge('connected', 'Connected ✦');
      S.conn.on('data', handleData);
    });

    S.conn.on('error', () => setBadge('error', 'Cannot reach host — check code'));

    await getCamera();

    if (S.localStream) {
      S.call = S.peer.call(hostId, S.localStream);
      S.call.on('stream', remote => showPartnerVid(remote));
    }
  });

  S.peer.on('error', e => {
    setBadge('error', 'Cannot connect — check code');
    console.warn(e);
  });
}

/* ── CAMERA ── */
async function getCamera() {
  try {
    if (S.localStream) {
      S.localStream.getTracks().forEach(t => t.stop());
    }

    S.localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false
    });

    attachMyVid(S.localStream);

    if (!S.isHost && S.peer && S.peer.open && S.conn) {
      S.call = S.peer.call('interlinked-host-' + S.code, S.localStream);
      S.call.on('stream', remote => showPartnerVid(remote));
    }

    if (S.isHost && S.call) {
      S.call.answer(S.localStream);
    }
  } catch (e) {
    console.log('No camera — sim mode');
    runSimCam('left');
    document.getElementById('ph-you').style.display = 'none';
  }
}

function attachMyVid(stream) {
  const v = document.getElementById('vid-you');
  v.srcObject = stream;
  v.style.display = 'block';
  document.getElementById('ph-you').style.display = 'none';
}

function showPartnerVid(stream) {
  const v = document.getElementById('vid-partner');
  v.srcObject = stream;
  v.style.display = 'block';
  document.getElementById('ph-partner').style.display = 'none';
  document.getElementById('live-badge').textContent = 'Live ✦';
}

function runSimCam(side) {
  const pane = document.getElementById(side === 'left' ? 'cam-left' : 'cam-right');
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 480;
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(100%) contrast(1.2)';
  pane.appendChild(c);

  let f = 0;

  (function loop() {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, 320, 480);

    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 320;
      const y = Math.random() * 480;
      const b = (Math.random() * 40 + Math.sin(f * 0.03 + i * 0.01) * 4) | 0;
      ctx.fillStyle = `rgb(${b},${b},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }

    f++;
    requestAnimationFrame(loop);
  })();
}

/* ── DATA CHANNEL ── */
function send(data) {
  if (S.conn && S.conn.open) {
    try {
      S.conn.send(data);
    } catch (e) {}
  }
}

function handleData(d) {
  if (!d || !d.type) return;

  if (d.type === 'start-shoot') {
    S.orient = d.orient || 'vert';
    applyOrientToStage();
    beginShoot();
  }

  if (d.type === 'countdown') showCD(d.n);
  if (d.type === 'capture-now') captureMe();

  if (d.type === 'partner-ready') {
    S.partnerReady = true;
    document.getElementById('sync-partner').classList.add('ready');
    if (S.youReady) kick();
  }

  if (d.type === 'photo') {
    S.photosPartner.push(d.data);
    checkNext();
  }
}

/* ── SHOOT ── */
async function beginShoot() {
  S.idx = 0;
  S.photosYou = [];
  S.photosPartner = [];
  S.youReady = false;
  S.partnerReady = false;

  applyOrientToStage();
  show('s-shoot');
  setPrompt(0);

  if (!S.localStream) {
    await getCamera();
  } else {
    attachMyVid(S.localStream);
  }

  if (S.isHost && S.isDuet) {
    send({ type: 'start-shoot', orient: S.orient });
  }
}

function applyOrientToStage() {
  const stage = document.getElementById('cam-stage');
  const camRight = document.getElementById('cam-right');
  const camLeft = document.getElementById('cam-left');
  const syncBar = document.getElementById('sync-bar');

  stage.classList.remove('horiz', 'vert', 'solo');

  if (!S.isDuet) {
    stage.classList.add(S.orient === 'horiz' ? 'horiz' : 'vert', 'solo');
    camRight.style.display = 'none';
    syncBar.style.display = 'none';
    document.getElementById('lbl-you').textContent = 'Solo';
  } else {
    stage.classList.add(S.orient === 'horiz' ? 'horiz' : 'vert');
    camRight.style.display = '';
    syncBar.style.display = '';
    document.getElementById('lbl-you').textContent = 'You';
  }
}

function setPrompt(i) {
  const p = PROMPTS[i];
  document.getElementById('p-act').textContent = p.act;
  document.getElementById('p-txt').textContent = p.text;
  document.getElementById('p-sub').textContent = p.sub;
  document.getElementById('sync-ctr').textContent = (i + 1) + ' / 4';

  const btn = document.getElementById('cap-btn');
  btn.disabled = false;
  btn.textContent = 'Take Photo';

  document.getElementById('cd-dig').classList.remove('show');
  document.getElementById('sync-you').classList.remove('ready');
  document.getElementById('sync-partner').classList.remove('ready');

  S.youReady = false;
  S.partnerReady = false;

  for (let j = 0; j < 4; j++) {
    document.getElementById('ps' + j).className = 'ps' + (j < i ? ' done' : j === i ? ' cur' : '');
  }
}

function onCapture() {
  const btn = document.getElementById('cap-btn');
  btn.disabled = true;
  btn.textContent = 'Ready…';

  S.youReady = true;
  document.getElementById('sync-you').classList.add('ready');
  send({ type: 'partner-ready' });

  if (!S.isDuet || S.partnerReady) {
    kick();
  } else {
    btn.textContent = 'Waiting for partner…';
  }
}

function kick() {
  let n = 3;
  showCD(n);

  if (S.isHost || !S.isDuet) {
    send({ type: 'countdown', n });
  }

  const iv = setInterval(() => {
    n--;

    if (n > 0) {
      showCD(n);
      if (S.isHost || !S.isDuet) send({ type: 'countdown', n });
    } else {
      clearInterval(iv);
      showCD('✦');
      if (S.isHost || !S.isDuet) send({ type: 'capture-now' });
      doFlash();
      captureMe();
    }
  }, 1000);
}

function showCD(n) {
  const el = document.getElementById('cd-dig');
  el.textContent = n;
  el.classList.remove('show');

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));

  if (n === '✦') {
    setTimeout(() => el.classList.remove('show'), 700);
  }
}

function doFlash() {
  const v = document.getElementById('flash-veil');
  v.classList.add('flash');
  setTimeout(() => v.classList.remove('flash'), 90);
}

/* ── CAPTURE ── */
function captureMe() {
  const vid = document.getElementById('vid-you');
  const cnv = document.getElementById('cv-you');

  cnv.width = 480;
  cnv.height = 480;

  const ctx = cnv.getContext('2d');

  if (vid.srcObject && vid.readyState >= 2) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(vid, -480, 0, 480, 480);
    ctx.restore();
    bw(ctx, cnv);
  } else {
    simFrame(ctx, cnv, S.idx);
  }

  const url = cnv.toDataURL('image/jpeg', 0.9);
  S.photosYou.push(url);
  send({ type: 'photo', data: url });

  if (!S.isDuet) {
    S.photosPartner.push(null);
    setTimeout(advance, 380);
    return;
  }

  checkNext();
}

function checkNext() {
  if (S.photosYou.length > S.idx && (!S.isDuet || S.photosPartner.length > S.idx)) {
    setTimeout(advance, 380);
  }
}

async function advance() {
  S.idx++;
  if (S.idx < 4) {
    setPrompt(S.idx);
  } else {
    if (S.localStream) S.localStream.getTracks().forEach(t => t.stop());
    await runDrop();
  }
}

function bw(ctx, cnv) {
  const id = ctx.getImageData(0, 0, cnv.width, cnv.height);
  const d = id.data;

  for (let k = 0; k < d.length; k += 4) {
    const g = d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114;
    const v = Math.min(255, Math.max(0, (g - 128) * 1.45 + 128));
    d[k] = d[k + 1] = d[k + 2] = v;
  }

  ctx.putImageData(id, 0, 0);
}

function simFrame(ctx, cnv, idx) {
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, cnv.width, cnv.height);

  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * cnv.width;
    const y = Math.random() * cnv.height;
    const b = (Math.random() * 38) | 0;
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.fillStyle = '#252525';
  ctx.font = 'italic 300 54px Cormorant Garamond,serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(['I', 'II', 'III', 'IV'][idx] || '·', cnv.width / 2, cnv.height / 2);
}

/* ── TIME + LOCATION STAMP ── */
async function getStamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  let locationStr = '';

  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
    );

    const { latitude: lat, longitude: lon } = pos.coords;

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );

    const geoData = await geoRes.json();
    const addr = geoData.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const country = addr.country_code ? addr.country_code.toUpperCase() : '';
    locationStr = [city, country].filter(Boolean).join(', ');
  } catch (e) {
    locationStr = '';
  }

  return { timeStr, dateStr, locationStr };
}

/* ── STRIP DROP ── */
async function runDrop() {
  show('s-drop');

  const travelWrap = document.getElementById('strip-travel-wrap');
  const hang = document.getElementById('strip-hang');

  travelWrap.innerHTML = '';
  hang.innerHTML = '';
  travelWrap.classList.remove('drop');
  travelWrap.style.transition = 'none';
  travelWrap.style.transform = 'translateY(-100%)';
  hang.classList.remove('show');
  document.getElementById('dl-btn').disabled = true;
  document.getElementById('dl-btn').textContent = 'Developing…';

  const stampPromise = getStamp();

  const isVert = S.orient === 'vert';
  const slotW = isVert ? 98 : 138;
  const slotFH = isVert ? 86 : 56;
  const hangW = isVert ? 158 : 198;
  const hangFH = isVert ? 132 : 88;

  const stamp = await stampPromise;
  S.stamp = stamp;

  travelWrap.innerHTML = makeStrip(slotW, slotFH, stamp);
  hang.innerHTML = makeStrip(hangW, hangFH, stamp);

  travelWrap.getBoundingClientRect();

  requestAnimationFrame(() => {
    travelWrap.style.transition = 'transform 4s cubic-bezier(.15,.85,.3,1)';
    travelWrap.classList.add('drop');
  });

  setTimeout(() => hang.classList.add('show'), 3800);

  setTimeout(() => {
    renderCanvas();
    document.getElementById('dl-btn').disabled = false;
    document.getElementById('dl-btn').textContent = 'Download Strip';
  }, 4000);
}

function makeStrip(w, fh, stamp) {
  stamp = stamp || S.stamp || {};
  const isVert = S.orient === 'vert';
  const isDuo = S.isDuet;
  let html = `<div class="strip-paper" style="width:${w}px">`;

  for (let i = 0; i < 4; i++) {
    const y = S.photosYou[i] || '';
    const p = S.photosPartner[i] || '';
    const duo = isDuo && p;

    if (duo) {
      if (isVert) {
        html += `<div class="s-frame vert-split" style="height:${fh}px">
          <div class="s-half"><img src="${y}" style="width:100%;height:${fh / 2}px;object-fit:cover;filter:grayscale(100%) contrast(1.3) brightness(.9)" alt=""></div>
          <div class="s-hdiv-h"></div>
          <div class="s-half"><img src="${p}" style="width:100%;height:${fh / 2}px;object-fit:cover;filter:grayscale(100%) contrast(1.3) brightness(.9)" alt=""></div>
        </div>`;
      } else {
        html += `<div class="s-frame" style="height:${fh}px">
          <div class="s-half" style="height:${fh}px"><img src="${y}" style="height:${fh}px" alt=""></div>
          <div class="s-hdiv"></div>
          <div class="s-half" style="height:${fh}px"><img src="${p}" style="height:${fh}px" alt=""></div>
        </div>`;
      }
    } else {
      html += `<div class="s-frame" style="height:${fh}px">
        <img class="s-solo-img" src="${y}" style="height:${fh}px;width:100%" alt="">
      </div>`;
    }

    html += `<div style="height:2px;background:#111;width:100%"></div>`;
  }

  const timeDate = [stamp.timeStr, stamp.dateStr].filter(Boolean).join('  ·  ');
  const location = stamp.locationStr || '';
  html += `<div class="strip-foot">INTERLINKED · ${S.code || ''}</div>`;

  if (timeDate || location) {
    html += `<div class="strip-stamp">${timeDate}${location ? '<br>' + location : ''}</div>`;
  }

  html += `</div>`;
  return html;
}

/* ── CANVAS HELPER: object-fit cover ──
   Draws img into (dx,dy,dw,dh) with cover behaviour — no distortion. */
function drawCover(ctx, img, dx, dy, dw, dh) {
  const imgRatio = img.width / img.height;
  const boxRatio = dw / dh;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = img.width / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ── LOAD CUSTOM FONTS INTO CANVAS ── */
async function loadStripFonts() {
  try {
    const fonts = [
      new FontFace('Billa Mount',          'url(fonts/BillaMount.ttf)'),
      new FontFace('Kommuna',              'url(fonts/Kommuna.ttf)'),
      new FontFace('Saint Andrews Queen',  'url(fonts/Saint-AndrewsQueen.ttf)'),
    ];
    await Promise.all(
      fonts.map(f =>
        f.load()
         .then(loaded => document.fonts.add(loaded))
         .catch(() => {})
      )
    );
  } catch(e) {}
}

/* ── RENDER TO CANVAS FOR DOWNLOAD ── */
async function renderCanvas() {
  await loadStripFonts();

  const isVert = S.orient === 'vert';

  const W    = isVert ? 360 : 600;
  const PAD  = 16;
  const FW   = W - PAD * 2;
  const FH   = isVert ? Math.round(FW * 1.1) : Math.round(FW * 0.56);
  const GAP  = 4;
  const PADY = 36;
  const FOOT = 130;  // enough whitespace for 4 footer lines

  const H = PADY + 4 * (FH + GAP) - GAP + FOOT;

  const c = document.getElementById('cv-render');
  c.width  = W;
  c.height = H;

  const ctx = c.getContext('2d');

  // Cream paper background
  ctx.fillStyle = '#f5f0e8';
  ctx.fillRect(0, 0, W, H);

  // ── Helper: load image ──
  const loadImg = src => new Promise(res => {
    if (!src) { res(null); return; }
    const img   = new Image();
    img.onload  = () => res(img);
    img.onerror = () => res(null);
    img.src     = src;
  });

  // ── Helper: B&W offscreen canvas with cover crop ──
  const bwc = (img, w, h) => {
    const cc  = document.createElement('canvas');
    cc.width  = w;
    cc.height = h;
    const cx  = cc.getContext('2d');
    drawCover(cx, img, 0, 0, w, h);
    const id  = cx.getImageData(0, 0, w, h);
    const d   = id.data;
    for (let k = 0; k < d.length; k += 4) {
      const g = d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114;
      const v = Math.min(255, Math.max(0, (g - 128) * 1.45 + 128));
      d[k] = d[k + 1] = d[k + 2] = v;
    }
    cx.putImageData(id, 0, 0);
    return cc;
  };

  // ── Draw 4 frames ──
  for (let i = 0; i < 4; i++) {
    const fy = PADY + i * (FH + GAP);

    ctx.fillStyle = '#111';
    ctx.fillRect(PAD, fy, FW, FH);

    const duo = S.isDuet && S.photosPartner[i];

    if (duo) {
      if (isVert) {
        const hh = Math.floor(FH / 2);
        const [a, b] = await Promise.all([
          loadImg(S.photosYou[i]),
          loadImg(S.photosPartner[i])
        ]);
        if (a) ctx.drawImage(bwc(a, FW, hh), PAD, fy,      FW, hh);
        if (b) ctx.drawImage(bwc(b, FW, hh), PAD, fy + hh, FW, hh);
        ctx.fillStyle = '#000';
        ctx.fillRect(PAD, fy + hh - 1, FW, 2);
      } else {
        const hw = Math.floor(FW / 2);
        const [a, b] = await Promise.all([
          loadImg(S.photosYou[i]),
          loadImg(S.photosPartner[i])
        ]);
        if (a) ctx.drawImage(bwc(a, hw, FH), PAD,      fy, hw, FH);
        if (b) ctx.drawImage(bwc(b, hw, FH), PAD + hw, fy, hw, FH);
        ctx.fillStyle = '#000';
        ctx.fillRect(PAD + hw - 1, fy, 2, FH);
      }
    } else if (S.photosYou[i]) {
      const img = await loadImg(S.photosYou[i]);
      if (img) ctx.drawImage(bwc(img, FW, FH), PAD, fy, FW, FH);
    }
  }

  // ── Footer separator ──
  const footY = PADY + 4 * (FH + GAP);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(PAD, footY);
  ctx.lineTo(PAD + FW, footY);
  ctx.stroke();

  const st = S.stamp || {};
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Calculate block start — push it down into the white space
  const blockStart = footY + 35;
  const lineH      = 22;  // tight, even spacing between every line

  // "Interlinked Photobooth" — Billa Mount
  ctx.fillStyle = '#555';
  ctx.font      = '400 15px "Billa Mount", serif';
  ctx.fillText('Interlinked Photobooth', W / 2, blockStart);

  // Session code or "SOLO" — Kommuna
  ctx.fillStyle = '#999';
  ctx.font      = '400 11px Kommuna';
  ctx.fillText(S.code || 'SOLO', W / 2, blockStart + lineH);

  // Time · Date — Kommuna italic
  if (st.timeStr || st.dateStr) {
    ctx.fillStyle = '#888';
    ctx.font      = 'italic 400 13px Kommuna';
    ctx.fillText(
      [st.timeStr, st.dateStr].filter(Boolean).join('  ·  '),
      W / 2,
      blockStart + lineH * 2
    );
  }

  // Location — Saint Andrews Queen, 15px
  if (st.locationStr) {
    ctx.fillStyle = '#888';
    ctx.font      = '400 20px "Saint Andrews Queen", serif';
    ctx.fillText(st.locationStr, W / 2, blockStart + lineH * 3);
  }
}

function downloadStrip() {
  setTimeout(() => {
    const c = document.getElementById('cv-render');
    const a = document.createElement('a');
    a.download = `interlinked-${S.code || 'solo'}-${S.orient}-${Date.now()}.jpg`;
    a.href = c.toDataURL('image/jpeg', 0.95);
    a.click();
  }, 600);
}

/* ── CLEANUP ── */
function cleanup() {
  if (S.localStream) {
    S.localStream.getTracks().forEach(t => t.stop());
    S.localStream = null;
  }
  if (S.call) {
    try { S.call.close(); } catch (e) {}
    S.call = null;
  }
  if (S.conn) {
    try { S.conn.close(); } catch (e) {}
    S.conn = null;
  }
  if (S.peer) {
    try { S.peer.destroy(); } catch (e) {}
    S.peer = null;
  }
}

function reshoot() {
  cleanup();
  S.idx = 0;
  S.photosYou = [];
  S.photosPartner = [];

  ['vid-you', 'vid-partner'].forEach(id => {
    const v = document.getElementById(id);
    v.style.display = 'none';
    v.srcObject = null;
  });

  document.getElementById('ph-you').style.display = 'flex';
  document.getElementById('ph-partner').style.display = 'flex';
  document.getElementById('live-badge').textContent = '';
  document.getElementById('sync-bar').style.display = '';
  document.getElementById('lbl-you').textContent = 'You';

  const tw = document.getElementById('strip-travel-wrap');
  const hang = document.getElementById('strip-hang');
  tw.innerHTML = '';
  hang.innerHTML = '';
  tw.classList.remove('drop');
  tw.style.transition = 'none';
  tw.style.transform = 'translateY(-100%)';
  hang.classList.remove('show');

  document.getElementById('dl-btn').disabled = true;
  document.getElementById('dl-btn').textContent = 'Developing…';
  show('s-session');
}

function exitShoot() {
  cleanup();
  show('s-home');
}