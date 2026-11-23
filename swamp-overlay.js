(function () {
  if (window.SwampOverlay) return;

  let root = null, crackCanvas = null, crackCtx = null, ogreBox = null;
  let chatLog = null, chatInput = null, sysLog = null, bsodEl = null;
  let audioCtx = null, active = false, mischiefTimer = null, logTimer = null, dripTimer = null, cloneRaf = null;
  let escCount = 0, escTimer = null, chatHistory = [], logIdx = 0;
  let shrekCutoutUrl = '/assets/shrek.png';
  const drips = [], clones = [];

  function buildCutoutShrek() {
    const srcImg = new Image();
    srcImg.crossOrigin = 'anonymous';
    srcImg.onload = () => {
      try {
        const w = srcImg.naturalWidth, h = srcImg.naturalHeight;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(srcImg, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const visited = new Uint8Array(w * h);
        const queue = [];
        const isBg = idx => d[idx] > 230 && d[idx + 1] > 230 && d[idx + 2] > 230;
        for (let x = 0; x < w; x++) {
          queue.push(x, (h - 1) * w + x);
        }
        for (let y = 0; y < h; y++) {
          queue.push(y * w, y * w + (w - 1));
        }
        let head = 0;
        while (head < queue.length) {
          const p = queue[head++];
          if (visited[p]) continue;
          visited[p] = 1;
          const idx = p * 4;
          if (!isBg(idx)) continue;
          d[idx + 3] = 0;
          const x = p % w, y = (p - x) / w;
          if (x > 0 && !visited[p - 1]) queue.push(p - 1);
          if (x < w - 1 && !visited[p + 1]) queue.push(p + 1);
          if (y > 0 && !visited[p - w]) queue.push(p - w);
          if (y < h - 1 && !visited[p + w]) queue.push(p + w);
        }
        ctx.putImageData(imgData, 0, 0);
        shrekCutoutUrl = c.toDataURL('image/png');
        document.querySelectorAll('#swampOgre img, .swamp-clone').forEach(el => { el.src = shrekCutoutUrl; });
      } catch (_) {}
    };
    srcImg.src = '/assets/shrek.png';
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playScareBoom() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const sub = ctx.createOscillator();
    const gSub = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(115, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.85);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 280;
    gSub.gain.setValueAtTime(0.82, t);
    gSub.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    sub.connect(lp).connect(gSub).connect(ctx.destination);
    sub.start(t); sub.stop(t + 0.92);

    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.22));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gN = ctx.createGain();
    gN.gain.setValueAtTime(0.55, t);
    src.connect(gN).connect(ctx.destination);
    src.start(t);
  }

  function playThud() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.3);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.36);

    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1600;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.42, t);
    src.connect(hp).connect(g2).connect(ctx.destination);
    src.start(t);
  }

  function playSwampFart() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(78, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.55);
    lfo.frequency.value = 26;
    lfoGain.gain.value = 24;
    lfo.connect(lfoGain).connect(osc.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 340;
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    osc.connect(lp).connect(gain).connect(ctx.destination);
    lfo.start(t); osc.start(t);
    lfo.stop(t + 0.6); osc.stop(t + 0.6);
  }

  function playLaugh() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const notes = [115, 96, 122, 88, 108, 82];
    notes.forEach((f, idx) => {
      const t = ctx.currentTime + idx * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.72, t + 0.11);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 520;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(lp).connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.13);
    });
  }

  function playGlitch() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.setValueAtTime(720, t + 0.04);
    osc.frequency.setValueAtTime(85, t + 0.09);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.17);
  }

  function drawCrack(cx, cy) {
    if (!crackCtx || !crackCanvas) return;
    const ctx = crackCtx;
    ctx.save();
    ctx.strokeStyle = 'rgba(230, 248, 255, 0.9)';
    ctx.lineWidth = 2.1;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    const rays = 12 + Math.floor(Math.random() * 5);
    for (let i = 0; i < rays; i++) {
      let ang = (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      let x = cx, y = cy;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 5 + Math.floor(Math.random() * 4);
      for (let s = 0; s < segs; s++) {
        const len = 26 + Math.random() * 52;
        ang += (Math.random() - 0.5) * 0.45;
        x += Math.cos(ang) * len;
        y += Math.sin(ang) * len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function splatMud(count = 2) {
    if (!crackCtx || !crackCanvas) return;
    playSwampFart();
    shakeScreen(false);
    const tones = ['#4a5e18', '#5c4314', '#394f12', '#6b531b'];
    for (let n = 0; n < count; n++) {
      const cx = 100 + Math.random() * Math.max(200, window.innerWidth - 200);
      const cy = 80 + Math.random() * Math.max(200, window.innerHeight - 240);
      const color = tones[Math.floor(Math.random() * tones.length)];
      crackCtx.save();
      crackCtx.fillStyle = color;
      crackCtx.globalAlpha = 0.88;
      // Main irregular mud splat
      const blobs = 9 + Math.floor(Math.random() * 6);
      for (let i = 0; i < blobs; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 42;
        const r = 12 + Math.random() * 30;
        crackCtx.beginPath();
        crackCtx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, Math.PI * 2);
        crackCtx.fill();
      }
      // Satellite drops
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 45 + Math.random() * 75;
        crackCtx.beginPath();
        crackCtx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 + Math.random() * 7, 0, Math.PI * 2);
        crackCtx.fill();
      }
      crackCtx.restore();
      drips.push({ x: cx + (Math.random() - 0.5) * 30, y: cy + 15, len: 0, max: 140 + Math.random() * 180, w: 5 + Math.random() * 6, color });
    }
  }

  function stepDrips() {
    if (!crackCtx || !active) return;
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      if (d.len >= d.max) { drips.splice(i, 1); continue; }
      d.y += 3.5;
      d.len += 3.5;
      crackCtx.save();
      crackCtx.fillStyle = d.color;
      crackCtx.globalAlpha = 0.82;
      crackCtx.beginPath();
      crackCtx.arc(d.x, d.y, d.w, 0, Math.PI * 2);
      crackCtx.fill();
      crackCtx.restore();
    }
  }

  function spawnClones(num = 4) {
    if (!root) return;
    playLaugh();
    for (let i = 0; i < num; i++) {
      if (clones.length >= 10) break;
      const el = document.createElement('img');
      el.src = shrekCutoutUrl;
      el.className = 'swamp-clone';
      root.appendChild(el);
      clones.push({
        el,
        x: Math.random() * Math.max(200, window.innerWidth - 140),
        y: Math.random() * Math.max(200, window.innerHeight - 140),
        vx: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5),
        vy: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5),
        rot: 0,
        vr: (Math.random() - 0.5) * 6
      });
    }
  }

  function stepClones() {
    if (!active) return;
    const maxW = window.innerWidth - 110, maxH = window.innerHeight - 110;
    for (const c of clones) {
      c.x += c.vx; c.y += c.vy; c.rot += c.vr;
      if (c.x <= 0 || c.x >= maxW) c.vx *= -1;
      if (c.y <= 0 || c.y >= maxH) c.vy *= -1;
      c.x = Math.max(0, Math.min(maxW, c.x));
      c.y = Math.max(0, Math.min(maxH, c.y));
      c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.rot}deg)`;
    }
    cloneRaf = requestAnimationFrame(stepClones);
  }

  function shakeScreen(heavy = false) {
    document.body.classList.remove('swamp-shake', 'swamp-shake-heavy');
    void document.body.offsetWidth;
    document.body.classList.add(heavy ? 'swamp-shake-heavy' : 'swamp-shake');
    setTimeout(() => document.body.classList.remove('swamp-shake', 'swamp-shake-heavy'), 520);
  }

  function triggerGlitch() {
    playGlitch();
    if (!root) return;
    root.classList.add('swamp-glitch');
    setTimeout(() => root && root.classList.remove('swamp-glitch'), 580);
  }

  function triggerFlip() {
    playGlitch();
    document.body.classList.add('swamp-flip');
    setTimeout(() => document.body.classList.remove('swamp-flip'), 2400);
  }

  function triggerTroll() {
    playLaugh();
    document.body.classList.add('swamp-drunk');
    setTimeout(() => document.body.classList.remove('swamp-drunk'), 3500);
    spawnClones(2);
  }

  function flashBreach() {
    if (!bsodEl) return;
    bsodEl.classList.add('show');
    setTimeout(() => bsodEl && bsodEl.classList.remove('show'), 1200);
  }

  function slamScreen(scary = false) {
    const x = 140 + Math.random() * Math.max(200, window.innerWidth - 280);
    const y = 120 + Math.random() * Math.max(200, window.innerHeight - 240);
    if (scary) playScareBoom(); else playThud();
    shakeScreen(true);
    drawCrack(x, y);
    if (ogreBox) {
      ogreBox.classList.add('slamming');
      setTimeout(() => ogreBox && ogreBox.classList.remove('slamming'), 480);
    }
  }

  const FAKE_POPUPS = [
    { title: 'C:\\Windows\\System32\\cmd.exe', body: 'GRANTING ROOT TO SHREK_KERNEL... [OK]' },
    { title: 'Веб-камера', body: 'Снимок лица кента сохранён в /Болото/мемы.jpg' },
    { title: 'Диспетчер задач', body: 'Мозг_Друга.exe — Не отвечает (Приоритет: Лук)' },
    { title: 'Windows Defender', body: 'Критическая угроза: ОГР В СЕТИ. Закрыть невозможно.' },
    { title: 'Steam', body: 'Передаю аккаунт и инвентарь Шреку...' }
  ];

  function spawnFakeWindow() {
    if (!root) return;
    playGlitch();
    const spec = FAKE_POPUPS[Math.floor(Math.random() * FAKE_POPUPS.length)];
    const win = document.createElement('div');
    win.className = 'swamp-popup';
    win.style.left = Math.max(24, Math.random() * (window.innerWidth - 340)) + 'px';
    win.style.top = Math.max(24, Math.random() * (window.innerHeight - 220)) + 'px';
    win.innerHTML = `<div class="swamp-pop-bar"><span>${spec.title}</span><button type="button">✕</button></div><div class="swamp-pop-body">${spec.body}</div>`;
    win.querySelector('button').onclick = () => { playThud(); win.remove(); spawnFakeWindow(); splatMud(1); };
    root.appendChild(win);
    setTimeout(() => {
      if (!win.parentNode) return;
      playThud();
      shakeScreen(false);
      win.classList.add('smashed');
      setTimeout(() => win.remove(), 260);
    }, 2300);
  }

  const SYS_LINES = [
    '[WARN] Обнаружен несанкционированный доступ: SWAMP_ROOT',
    '[SCAN] Чтение Рабочего стола... Найдено: 42 мема',
    '[CAM] Микрофон и камера переведены в режим болота',
    '[NET] Отправка истории браузера Шреку... 64%',
    '[LOCK] Перехват сессии Windows... УСПЕШНО',
    '[SYS] Загрязнение монитора болотной жижей...'
  ];

  function pushSysLog() {
    if (!sysLog) return;
    const line = document.createElement('div');
    line.textContent = SYS_LINES[logIdx++ % SYS_LINES.length];
    sysLog.appendChild(line);
    if (sysLog.children.length > 7) sysLog.firstChild.remove();
  }

  function runAction(action) {
    switch (action) {
      case 'SPLAT': splatMud(2); break;
      case 'FART': splatMud(3); break;
      case 'CLONE': spawnClones(4); break;
      case 'TROLL': triggerTroll(); break;
      case 'CRACK': slamScreen(true); break;
      case 'SHAKE': playThud(); shakeScreen(true); break;
      case 'GLITCH': triggerGlitch(); flashBreach(); break;
      case 'FLIP': triggerFlip(); break;
      case 'LAUGH': playLaugh(); break;
      case 'FAKE_WINDOW': spawnFakeWindow(); break;
      case 'EXIT': stop(); break;
      default: splatMud(1); playLaugh();
    }
  }

  function appendMsg(who, text) {
    if (!chatLog) return null;
    const row = document.createElement('div');
    row.className = 'swamp-msg ' + (who === 'shrek' ? 'shrek' : 'user');
    row.textContent = (who === 'shrek' ? 'Шрек: ' : 'Ты: ') + text;
    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;
    return row;
  }

  async function sendToShrek(text) {
    const clean = text.trim();
    if (!clean) return;
    appendMsg('user', clean);
    chatHistory.push({ role: 'user', content: clean });
    const waitEl = appendMsg('shrek', '...');
    if (ogreBox) ogreBox.classList.add('talking');
    try {
      const r = await fetch('/api/swamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const reply = data.reply || 'Чё надо, кент?';
      chatHistory.push({ role: 'assistant', content: reply });
      if (waitEl) waitEl.textContent = 'Шрек: ' + reply;
      runAction(data.action || 'SPLAT');
    } catch (_) {
      if (waitEl) waitEl.textContent = 'Шрек: Болотный вайфай лагает, держи жижу на монитор!';
      splatMud(2);
    } finally {
      if (ogreBox) setTimeout(() => ogreBox && ogreBox.classList.remove('talking'), 800);
    }
  }

  function requestFull() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {}
  }

  function onBeforeUnload(e) {
    if (!active) return;
    e.preventDefault();
    e.returnValue = '';
  }

  function onResize() {
    if (!crackCanvas) return;
    crackCanvas.width = window.innerWidth;
    crackCanvas.height = window.innerHeight;
  }

  function injectStyles() {
    if (document.getElementById('swampStyles')) return;
    const st = document.createElement('style');
    st.id = 'swampStyles';
    st.textContent = `
      #swampRoot{position:fixed;inset:0;z-index:99999;pointer-events:auto;font-family:Consolas,monospace;overflow:hidden;background:radial-gradient(circle at center,rgba(0,0,0,.15) 35%,rgba(10,22,4,.78) 100%)}
      #swampRoot::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,255,70,.045) 0 2px,transparent 2px 4px);pointer-events:none}
      #swampRoot.swamp-glitch{backdrop-filter:hue-rotate(140deg) contrast(1.85) invert(.28);animation:swampGl .1s infinite}
      @keyframes swampGl{0%{transform:translate(4px,-3px)}50%{transform:translate(-5px,3px)}100%{transform:none}}
      body.swamp-shake{animation:swampSh .35s ease}
      body.swamp-shake-heavy{animation:swampShH .5s ease}
      body.swamp-flip{transform:rotate(180deg);transition:transform .35s ease}
      body.swamp-drunk{animation:swampDrunk .45s ease-in-out infinite alternate}
      @keyframes swampDrunk{from{transform:skewX(-3deg) rotate(-1.5deg)}to{transform:skewX(3deg) rotate(1.5deg)}}
      @keyframes swampSh{0%,100%{transform:none}25%{transform:translate(-7px,5px)}50%{transform:translate(7px,-5px)}75%{transform:translate(-5px,-3px)}}
      @keyframes swampShH{0%,100%{transform:none}20%{transform:translate(-18px,11px) rotate(-.8deg)}40%{transform:translate(16px,-13px) rotate(.8deg)}60%{transform:translate(-12px,-9px)}80%{transform:translate(10px,7px)}}
      #swampCrack{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8}
      .swamp-clone{position:absolute;top:0;left:0;width:120px;height:120px;object-fit:contain;border:none;border-radius:0;filter:drop-shadow(0 8px 18px rgba(0,0,0,.75));pointer-events:none;z-index:9}
      #swampBsod{position:absolute;inset:0;background:#0b3b91;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:8vw;opacity:0;pointer-events:none;transition:opacity .08s;z-index:15;font-family:'Segoe UI',Tahoma,sans-serif}
      #swampBsod.show{opacity:1}
      #swampBsod .sad{font-size:88px;margin-bottom:18px}
      #swampBsod h1{font-size:24px;font-weight:400;max-width:720px;line-height:1.4;margin:0 0 18px}
      #swampBsod p{font-size:15px;opacity:.9}
      #swampSysLog{position:absolute;left:18px;top:16px;width:440px;background:rgba(6,12,4,.88);border:1px solid #3c8c26;border-radius:6px;padding:10px 12px;color:#7dff59;font-size:11.5px;line-height:1.45;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.65);z-index:10}
      #swampOgre{position:absolute;left:16px;bottom:0;width:280px;height:280px;pointer-events:auto;cursor:pointer;border:none;border-radius:0;box-shadow:none;background:transparent;filter:drop-shadow(0 16px 32px rgba(0,0,0,.85));transition:transform .22s cubic-bezier(.2,1.4,.4,1);z-index:12}
      #swampOgre img{width:100%;height:100%;object-fit:contain;display:block}
      #swampOgre:hover{transform:scale(1.06)}
      #swampOgre.lunge{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(2.25) !important;z-index:20;box-shadow:0 0 90px rgba(255,40,30,.75)}
      #swampOgre.slamming{transform:scale(1.36) translate(32px,-36px) rotate(-6deg);filter:contrast(1.25) saturate(1.3)}
      #swampOgre.talking{animation:swampBounce .22s infinite alternate}
      @keyframes swampBounce{from{transform:translateY(0)}to{transform:translateY(-6px)}}
      #swampChat{position:absolute;right:20px;bottom:20px;width:360px;background:rgba(10,16,8,.96);border:1.5px solid #5cb83c;border-radius:10px;box-shadow:0 18px 55px rgba(0,0,0,.85);pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;color:#d6f5c9;z-index:14}
      .swamp-head{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#1a3013;border-bottom:1px solid #3a6b28;font-size:12px;font-weight:700;color:#8ef264}
      .swamp-head small{font-weight:400;opacity:.7;font-size:10.5px}
      #swampLog{height:195px;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px;font-size:12.5px;line-height:1.4}
      .swamp-msg.shrek{color:#9cff70}.swamp-msg.user{color:#f0f0f0}
      .swamp-form{display:flex;border-top:1px solid #2c4f1e}
      .swamp-form input{flex:1;background:#070d05;border:0;color:#eaffdf;padding:10px 11px;font:inherit;font-size:12.5px;outline:none}
      .swamp-form button{background:#4da32f;border:0;color:#081205;font-weight:700;padding:0 15px;cursor:pointer;font-size:13px}
      .swamp-popup{position:absolute;width:310px;background:#ece9d8;color:#111;border:2px solid #0054e3;border-radius:4px;box-shadow:0 12px 32px rgba(0,0,0,.65);pointer-events:auto;font-family:Tahoma,sans-serif;transition:transform .22s ease,opacity .22s ease;z-index:11}
      .swamp-popup.smashed{transform:scale(1.18) rotate(9deg);opacity:0}
      .swamp-pop-bar{background:linear-gradient(90deg,#0058e6,#3b93ff);color:#fff;padding:5px 8px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;font-weight:700}
      .swamp-pop-bar button{background:#d94032;color:#fff;border:1px solid #fff;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1}
      .swamp-pop-body{padding:12px;font-size:12px}
    `;
    document.head.appendChild(st);
  }

  function start() {
    if (active) return;
    active = true;
    chatHistory = [];
    logIdx = 0;
    drips.length = 0;
    clones.length = 0;
    injectStyles();
    requestFull();

    root = document.createElement('div');
    root.id = 'swampRoot';
    root.onclick = () => requestFull();

    crackCanvas = document.createElement('canvas');
    crackCanvas.id = 'swampCrack';
    crackCanvas.width = window.innerWidth;
    crackCanvas.height = window.innerHeight;
    crackCtx = crackCanvas.getContext('2d');
    root.appendChild(crackCanvas);

    bsodEl = document.createElement('div');
    bsodEl.id = 'swampBsod';
    bsodEl.innerHTML = '<div class="sad">:(</div><h1>На вашем ПК возникла проблема, и его необходимо перезагрузить. Передача управления ядру SWAMP_KERNEL_v4.2...</h1><p>Код остановки: CRITICAL_SHREK_OVERFLOW (0x0000DEAD)</p>';
    root.appendChild(bsodEl);

    sysLog = document.createElement('div');
    sysLog.id = 'swampSysLog';
    root.appendChild(sysLog);

    ogreBox = document.createElement('div');
    ogreBox.id = 'swampOgre';
    ogreBox.className = 'lunge';
    ogreBox.title = 'Кликни, чтобы Шрек дал леща экрану';
    const img = document.createElement('img');
    img.src = shrekCutoutUrl;
    img.alt = 'Shrek';
    ogreBox.appendChild(img);
    buildCutoutShrek();
    ogreBox.onclick = e => { e.stopPropagation(); requestFull(); slamScreen(true); splatMud(1); };
    root.appendChild(ogreBox);

    const chat = document.createElement('div');
    chat.id = 'swampChat';
    chat.onclick = e => e.stopPropagation();
    chat.innerHTML = `
      <div class="swamp-head"><span>SWAMP_OS v4.2 // ШРЕК</span><small>ROOT ACCESS</small></div>
      <div id="swampLog"></div>
      <form class="swamp-form"><input placeholder="Напиши Шреку..." autocomplete="off"><button type="submit">→</button></form>
    `;
    root.appendChild(chat);
    document.body.appendChild(root);

    chatLog = chat.querySelector('#swampLog');
    chatInput = chat.querySelector('input');
    chat.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const val = chatInput.value;
      chatInput.value = '';
      sendToShrek(val);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('resize', onResize);

    // Jumpscare sequence: BSOD -> Shrek lunge + glass shatter + mud splat + clones
    flashBreach();
    playScareBoom();
    shakeScreen(true);
    drawCrack(window.innerWidth * 0.5, window.innerHeight * 0.5);
    pushSysLog();
    setTimeout(() => {
      if (!active) return;
      if (ogreBox) ogreBox.classList.remove('lunge');
      splatMud(2);
      spawnFakeWindow();
      spawnClones(3);
    }, 1200);

    appendMsg('shrek', 'Здарова, кент! Хватит уже играть, теперь твой комп — моё болото. Пиши, щас поугараем!');

    dripTimer = setInterval(stepDrips, 55);
    cloneRaf = requestAnimationFrame(stepClones);
    logTimer = setInterval(pushSysLog, 2200);
    mischiefTimer = setInterval(() => {
      if (!active) return;
      const roll = Math.random();
      if (roll < 0.26) splatMud(2);
      else if (roll < 0.46) slamScreen(true);
      else if (roll < 0.64) spawnFakeWindow();
      else if (roll < 0.80) triggerGlitch();
      else if (roll < 0.92) triggerTroll();
      else triggerFlip();
    }, 5000);
  }

  function stop() {
    if (!active) return;
    active = false;
    clearInterval(mischiefTimer);
    clearInterval(logTimer);
    clearInterval(dripTimer);
    cancelAnimationFrame(cloneRaf);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('resize', onResize);
    document.body.classList.remove('swamp-shake', 'swamp-shake-heavy', 'swamp-flip', 'swamp-drunk');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (root) { root.remove(); root = null; }
  }

  window.SwampOverlay = { start, stop, slam: () => slamScreen(true), splat: () => splatMud(2) };
})();
