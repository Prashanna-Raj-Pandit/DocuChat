// CURSOR
const $cur  = document.getElementById('cur');
const $ring = document.getElementById('cur-ring');
let cx = 0, cy = 0, rx2 = 0, ry2 = 0;

document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });

(function moveCursor() {
  $cur.style.left  = cx + 'px';
  $cur.style.top   = cy + 'px';
  rx2 += (cx - rx2) * .12;
  ry2 += (cy - ry2) * .12;
  $ring.style.left = rx2 + 'px';
  $ring.style.top  = ry2 + 'px';
  requestAnimationFrame(moveCursor);
})();

// BG NEURAL NETWORK
const bgC = document.getElementById('bg-canvas');
const bgX = bgC.getContext('2d');
let W, H, nodes = [], speed = 1;

const PALETTE = [
  [0,255,224],
  [168,85,247],
  [255,107,53],
  [255,215,0]
];

class NNode {
  constructor() {
    this.x          = Math.random() * W;
    this.y          = Math.random() * H;
    this.vx         = (Math.random() - .5) * .5;
    this.vy         = (Math.random() - .5) * .5;
    this.r          = Math.random() * 2.5 + 0.8;
    this.col        = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.pulse      = Math.random() * Math.PI * 2;
    this.brightness = Math.random() * .6 + .2;
  }

  update(spd) {
    this.x     += this.vx * spd;
    this.y     += this.vy * spd;
    this.pulse += .025 * spd;
    if (this.x < -10)    this.x = W + 10;
    if (this.x > W + 10) this.x = -10;
    if (this.y < -10)    this.y = H + 10;
    if (this.y > H + 10) this.y = -10;
  }

  draw() {
    const p = Math.sin(this.pulse) * .4 + .6;
    const [r, g, b] = this.col;
    bgX.beginPath();
    bgX.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    bgX.fillStyle = `rgba(${r},${g},${b},${this.brightness * p})`;
    bgX.fill();
  }
}

function initBg() {
  W = bgC.width  = window.innerWidth;
  H = bgC.height = window.innerHeight;
  nodes = [];
  const count = Math.floor((W * H) / 7500);
  for (let i = 0; i < Math.min(count, 180); i++) nodes.push(new NNode());
}

function drawEdges() {
  const D = 130;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < D) {
        const t = 1 - d / D;
        const [r1, g1, b1] = nodes[i].col;
        const [r2, g2, b2] = nodes[j].col;
        bgX.beginPath();
        bgX.moveTo(nodes[i].x, nodes[i].y);
        bgX.lineTo(nodes[j].x, nodes[j].y);
        bgX.strokeStyle = `rgba(${(r1+r2)>>1},${(g1+g2)>>1},${(b1+b2)>>1},${t * .18 * (isProcessing ? 2.5 : 1)})`;
        bgX.lineWidth   = t * .7;
        bgX.stroke();
      }
    }
  }
}

let isProcessing = false;

function bgLoop() {
  requestAnimationFrame(bgLoop);
  bgX.clearRect(0, 0, W, H);
  const s = isProcessing ? speed * 4 : speed;
  drawEdges();
  nodes.forEach(n => { n.update(s); n.draw(); });
}

window.addEventListener('resize', initBg);
initBg();
bgLoop();

// PARTICLE SYSTEM
const pC = document.getElementById('particle-canvas');
const pX = pC.getContext('2d');
let particles = [];

class Particle {
  constructor(x, y, color) {
    this.x     = x;
    this.y     = y;
    this.vx    = (Math.random() - .5) * 3;
    this.vy    = (Math.random() - .5) * 3 - 1;
    this.life  = 1;
    this.decay = Math.random() * .03 + .01;
    this.r     = Math.random() * 2 + 1;
    this.col   = color || [0, 255, 224];
  }

  update() {
    this.x    += this.vx;
    this.y    += this.vy;
    this.vy   += .04;
    this.life -= this.decay;
  }

  draw() {
    const [r, g, b] = this.col;
    pX.beginPath();
    pX.arc(this.x, this.y, this.r * this.life, 0, Math.PI * 2);
    pX.fillStyle = `rgba(${r},${g},${b},${this.life * .7})`;
    pX.fill();
  }
}

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

function pLoop() {
  requestAnimationFrame(pLoop);
  pC.width  = window.innerWidth;
  pC.height = window.innerHeight;
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => { p.update(); p.draw(); });
}
pLoop();

// Mouse trail
document.addEventListener('mousemove', e => {
  if (Math.random() > .85) spawnParticles(e.clientX, e.clientY, 1, [0, 255, 224]);
});

// DATA STREAMS
const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ∂∇⊗⊕∞';

function fillStream(id) {
  const el = document.getElementById(id);
  if (!el) return;
  let s = '';
  for (let i = 0; i < 80; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)] + '\n';
  el.textContent = s;
}

['sc1','sc2','sc3','sc4','sc5','sc6'].forEach(id => {
  fillStream(id);
  setInterval(() => fillStream(id), 800 + Math.random() * 1200);
});

// ANIMATED READOUTS
const freqEl = document.getElementById('freq-val');
const confEl = document.getElementById('conf-val');
const vecEl  = document.getElementById('vec-val');

setInterval(() => {
  freqEl.textContent = (420 + Math.floor(Math.random() * 80)) + 'Hz';
  vecEl.textContent  = (Math.floor(Math.random() * 9000) + 1000);
}, 600);

// LIVE METRICS
function animMetrics(lat, rec, chk) {
  const latPct = Math.min(lat / 200 * 100, 100);
  document.getElementById('mb-lat').style.width   = latPct + '%';
  document.getElementById('mv-lat').textContent   = lat + 'ms';
  document.getElementById('mb-rec').style.width   = rec + '%';
  document.getElementById('mv-rec').textContent   = rec + '%';
  document.getElementById('mb-chk').style.width   = (chk / 15 * 100) + '%';
  document.getElementById('mv-chk').textContent   = chk;
  document.getElementById('ev-count').textContent = chk + ' CHUNKS';
}

// Idle latency flicker
setInterval(() => {
  if (!isProcessing) {
    document.getElementById('mv-lat').textContent = (18 + Math.floor(Math.random() * 12)) + 'ms';
  }
}, 1500);

// MODE SWITCHING
let mode = 'voice';

function setMode(m) {
  mode = m;
  document.getElementById('btn-v').classList.toggle('on', m === 'voice');
  document.getElementById('btn-t').classList.toggle('on', m === 'text');

  const panel = document.getElementById('panel');
  const stage = document.getElementById('stage');
  const bar   = document.getElementById('mode-bar');

  if (m === 'text') {
    panel.classList.add('open');
    stage.classList.add('shifted');
    bar.classList.add('shifted');
    stopVoice();
    document.getElementById('voice-hint').style.display = 'none';
  } else {
    panel.classList.remove('open');
    stage.classList.remove('shifted');
    bar.classList.remove('shifted');
    document.getElementById('voice-hint').style.display = '';
  }
}

// ══════════════════════════════════════════════════════════════════
// STATUS BAR
// ══════════════════════════════════════════════════════════════════
function setStatus(text, state) {
  document.getElementById('s-main').textContent = text;
  document.getElementById('sd-main').className  = 's-dot' + (state === 'active' ? ' active' : '');
}

// ══════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════
const msgsEl = document.getElementById('msgs');
const inpEl  = document.getElementById('inp');
let loading  = false;

inpEl.addEventListener('input', () => {
  inpEl.style.height = 'auto';
  inpEl.style.height = Math.min(inpEl.scrollHeight, 110) + 'px';
  document.getElementById('char-count').textContent = inpEl.value.length;
});

inpEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

// role: 'u' = user (purple bubble, right), 'a' = assistant (cyan bubble, left)
function addMsg(role, html) {
  const d = document.createElement('div');
  d.className = 'msg ' + (role === 'u' ? 'u' : 'a');
  d.innerHTML = `<div class="msg-who">${role === 'u' ? 'YOU' : 'DocuChat'}</div><div class="msg-b">${html}</div>`;
  msgsEl.appendChild(d);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  const rect = d.getBoundingClientRect();
  spawnParticles(rect.left + 20, rect.top, 12, role === 'u' ? [168,85,247] : [0,255,224]);
  return d;
}

function addTyping() {
  const d = document.createElement('div');
  d.className = 'msg a';
  d.id        = 'typing';
  d.innerHTML = `<div class="msg-who">DocuChat</div><div class="typing-b"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  msgsEl.appendChild(d);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function rmTyping() {
  const e = document.getElementById('typing');
  if (e) e.remove();
}

function setProc(v) {
  isProcessing = v;
  document.getElementById('proc-bar').classList.toggle('on', v);
  document.getElementById('orb').classList.toggle('processing', v);
  if (v) {
    setStatus('RETRIEVING KNOWLEDGE…', 'proc');
    document.getElementById('sd-vec').className = 's-dot active';
    document.getElementById('sd-llm').className = 's-dot active';
  } else {
    setStatus('NEURAL NET ONLINE', 'active');
    document.getElementById('sd-vec').className = 's-dot';
    document.getElementById('sd-llm').className = 's-dot';
  }
}

function renderEvidence(items) {
  const sec = document.getElementById('ev-section');
  if (!items || !items.length) { sec.classList.remove('has-items'); return; }
  sec.classList.add('has-items');
  sec.innerHTML = items.map(it => `
    <div class="ev-item">
      <div>
        <div class="ev-score">${it.score ? (it.score * 100).toFixed(0) + '%' : '—'}</div>
      </div>
      <div>
        <div class="ev-text">${(it.text || '').slice(0, 90)}…</div>
        <div class="ev-src">${it.source || 'KNOWLEDGE BASE'}</div>
      </div>
    </div>
  `).join('');
}

async function sendMsg() {
  const txt = inpEl.value.trim();
  if (!txt || loading) return;
  loading = true;
  inpEl.value        = '';
  inpEl.style.height = 'auto';
  document.getElementById('char-count').textContent = '0';

  addMsg('u', txt);        // FIX: 'u' not 'user'
  addTyping();
  setProc(true);

  const t0 = Date.now();
  try {
    const res  = await fetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: txt })
    });
    const data = await res.json();
    rmTyping();
    addMsg('a', data.answer || 'No response from knowledge base.');  // FIX: 'a' not 'assistant'
    const lat = Date.now() - t0;
    const chk = data.evidence_count || 5;
    animMetrics(lat, Math.round(80 + Math.random() * 15), chk);
    confEl.textContent = Math.round(80 + Math.random() * 15) + '%';
    vecEl.textContent  = data.vectors_searched || Math.floor(Math.random() * 9000 + 1000);
    if (data.evidence) renderEvidence(data.evidence);
  } catch(e) {
    rmTyping();
    addMsg('a', `<span style="color:rgba(255,107,53,.8)">⚠ BACKEND OFFLINE</span> — Could not reach <code style="font-family:Share Tech Mono,monospace;font-size:11px">/chat</code>. Start your FastAPI server and reload.`);
  }

  setProc(false);
  loading = false;
}

// ══════════════════════════════════════════════════════════════════
// VOICE  (audio recorded in browser → sent to Python /transcribe
//         → Whisper transcribes → text sent to /chat)
// ══════════════════════════════════════════════════════════════════
let mediaRecorder = null;
let audioChunks   = [];
let isListening   = false;

const orbEl = document.getElementById('orb');
const vq    = document.getElementById('voice-q');
const va    = document.getElementById('voice-a');
const vhint = document.getElementById('voice-hint');

async function toggleVoice() {
  // ── Already recording → stop ──
  if (isListening) {
    mediaRecorder.stop();
    isListening = false;
    orbEl.classList.remove('listening');
    vhint.textContent = 'PROCESSING…';
    return;
  }

  // ── Request microphone permission ──
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    vhint.textContent = 'MIC ACCESS DENIED';
    return;
  }

  // ── Set up MediaRecorder ──
  audioChunks   = [];
  mediaRecorder = new MediaRecorder(stream);

  // Collect audio data chunks while recording
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  // ── When recording stops → send to Python /transcribe ──
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());   // release microphone

    const blob     = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    vhint.textContent = 'TRANSCRIBING…';
    setProc(true);

    try {
      // Python receives this, runs Whisper, returns { transcript: "..." }
      const res  = await fetch('/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      const text = data.transcript?.trim();

      if (text) {
        vq.textContent = text;          // show what was heard on screen
        vq.classList.add('visible');
        await sendVoice(text);          // send transcript to /chat
      } else {
        vhint.textContent = 'NOTHING HEARD — TRY AGAIN';
        setProc(false);
      }
    } catch (err) {
      vhint.textContent = 'TRANSCRIPTION FAILED';
      setProc(false);
    }
  };

  // ── Start recording ──
  mediaRecorder.start();
  isListening = true;
  orbEl.classList.add('listening');
  vhint.textContent = 'LISTENING… CLICK ORB TO STOP';
  spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 30, [0, 255, 163]);
}

function stopVoice() {
  if (mediaRecorder && isListening) {
    mediaRecorder.stop();
    isListening = false;
  }
  orbEl.classList.remove('listening', 'processing');
}

async function sendVoice(text) {
  setProc(true);   // FIX: ensure processing state is on for the full duration
  try {
    const res  = await fetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text })
    });
    const data = await res.json();
    const ans  = data.answer || 'No response.';

    va.textContent = ans;
    va.classList.add('visible');
    vhint.textContent = 'CLICK ORB TO SPEAK AGAIN';

    const chk = data.evidence_count || 5;
    animMetrics(Math.floor(Math.random() * 120 + 30), Math.round(80 + Math.random() * 15), chk);
    confEl.textContent = Math.round(80 + Math.random() * 15) + '%';
    if (data.evidence) renderEvidence(data.evidence);

    // ── Browser reads the answer aloud (text-to-speech) ──
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(ans);
      u.rate  = .95;
      u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    }
  } catch(e) {
    va.textContent = '⚠ Backend connection failed.';
    va.classList.add('visible');
    vhint.textContent = 'CLICK ORB TO RETRY';
  }
  setProc(false);
}

// BOOT SEQUENCE
setTimeout(() => document.getElementById('sd-vec').className = 's-dot', 1200);
setTimeout(() => document.getElementById('sd-llm').className = 's-dot', 2200);