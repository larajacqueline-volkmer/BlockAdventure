// === Block Adventure – script.js (vollständig) ===

// ---------- Konfiguration ----------
const MAX_LEVELS = 100;
const GRAVITY = 0.65;
const JUMP = -12;
const SPEED = 5;

const START_W = 200;
const BASE_W_MIN = 120;
const BASE_W_MAX = 160;
const BASE_MIN_DX = 100;
const BASE_MAX_DX = 180;
const MAX_STEP_Y  = 105;
const TOP_MARGIN  = 80;

// Gedimmte UI‑Pink‑Farbe (konsistent mit CSS)
const UI_PINK = [212, 87, 174]; // #d457ae

const SAVE_KEY = "block_adventure_level";
const RESTART_SAME_LEVEL_ON_DEATH = true;

// ---------- State ----------
let level = 1;
let running = false;
let player;
let platforms = [];
let prevY = 0;

let particles = [];
let finale = false;

// ---------- Setup / UI ----------
function setup(){
  const cv = createCanvas(720, 420);
  cv.parent("canvas-container");

  // Tastatur global
  window.addEventListener('keydown', (e)=>{
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (!running && (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')){
      running = true;
    }
  }, {passive:false});

  // Buttons
  const startBtn   = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const saveBtn    = document.getElementById('save-btn');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const saved = loadProgress();
      if (saved) level = clamp(saved, 1, MAX_LEVELS);
      running = true; finale = false;
      resetLevel(true);
      showLevelUp(getLevelMsg(level, level%5===0), {etappe: (level%5===0)});
    });
  }
  if (restartBtn){
    restartBtn.addEventListener('click', () => {
      running = true; finale = false;
      level = 1; clearProgress();
      resetLevel(true);
      updateStartButtonLabel();
      showLevelUp(getLevelMsg(level, false), {etappe:false});
    });
  }
  if (saveBtn){
    saveBtn.addEventListener('click', () => {
      saveProgress(level);
      updateStartButtonLabel();
      showToast(`Spielstand gespeichert (Level ${level})`);
    });
  }

  // Menü‑Vorschau und HUD
  resetLevel(false);
  updateHUD(true);
  updateStartButtonLabel();   // Beschriftung „Fortfahren (Level X)“
}

function draw(){
  background(10,12,40);

  // Plattformen & Spieler
  for(const p of platforms) drawPlatform(p);
  drawPlayer();

  // Partikel
  updateParticles();

  // HUD
  updateHUD();

  if(!running || finale) return;

  // Eingabe + Physik + Kollision
  handleInput();
  applyPhysics();
  handleCollisions();

  // Level‑Up nur auf oberster Plattform
  const top = getTopMostPlatform();
  if (player.grounded && player.standingOn === top) {
    level = Math.min(level + 1, MAX_LEVELS);
    saveProgress(level);
    updateStartButtonLabel();

    if (level > MAX_LEVELS){
      running = false;
      triggerFinale();
      return;
    }

    running = false;
    const etappe = (level % 5 === 0);
    showLevelUp(getLevelMsg(level, etappe), {etappe}, () => {
      resetLevel(true);
      running = true;
    });
  }
}

// ---------- Eingabe ----------
function handleInput(){
  player.vx = 0;
  if (keyIsDown(LEFT_ARROW))  player.vx = -SPEED;
  if (keyIsDown(RIGHT_ARROW)) player.vx =  SPEED;
}
function keyPressed(){
  if (key === ' ' && player.grounded && running && !finale){
    player.vy = JUMP;
    player.grounded = false;
    player.standingOn = null;
  }
  if (key === 's' || key === 'S'){
    saveProgress(level);
    updateStartButtonLabel();
    showToast(`Spielstand gespeichert (Level ${level})`);
  }
}

// ---------- Physik ----------
function applyPhysics(){
  prevY = player.y;
  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;

  // Wrap-around
  if (player.x > width)        player.x = -player.w;
  if (player.x + player.w < 0) player.x = width;

  // Boden = Tod
  if (player.y + player.h >= height){ die(); return; }
  else player.grounded = false;
}

// ---------- Kollisionen ----------
function handleCollisions(){
  const eps = 1.0;
  const prevBottom = prevY + player.h;
  const currBottom = player.y + player.h;

  for (const p of platforms){
    const falling   = player.vy >= 0;
    const withinX   = player.x + player.w > p.x && player.x < p.x + p.w;
    const crossedTop= (prevBottom <= p.y + eps) && (currBottom >= p.y - eps);

    if (falling && withinX && crossedTop){
      player.y  = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.standingOn = p;
      break;
    }
  }
}

// ---------- Tod / Respawn ----------
function die(){
  running = false;
  burst(player.x + player.w/2, player.y + player.h/2, 30, 'death');
  showFade('Oops! Versuch es nochmal', 650, () => {
    if (!RESTART_SAME_LEVEL_ON_DEATH && level > 1) level -= 1;
    resetLevel(true);
    running = true;
  }, {scaleFrom:1.0, scaleTo:1.0}); // Tod: nur Fade, kein Zoom
}

// ---------- Level-Logik ----------
function resetLevel(placeOnStart = true){
  generatePlatforms(level);

  const startP = getBottomMostPlatform();

  player = {
    x: startP.x + startP.w/2 - 13,
    y: startP.y - 26,
    w: 26, h: 26,
    vx: 0, vy: 0,
    grounded: true,
    standingOn: startP
  };

  if (!placeOnStart){
    player.vx = 0; player.vy = 0; player.grounded = true; player.standingOn = startP;
  }

  updateHUD(true);
}

// ---------- Plattform-Generierung ----------
// Reduktion: immer 2–3 weniger als früher (min 3, max 20)
function platformCountForLevel(lvl){
  const desired = 3 + (lvl - 1);       // alter Zuwachs
  const reduction = (lvl < 10 ? 2 : 3);
  return clamp(desired - reduction, 3, 20);
}

// Seitwärts‑Abstände skalieren mit Anzahl; Etappenziel‑Level (alle 5) schwerer
function lateralConfigForCount(count, etappe){
  if (etappe){
    if (count < 13) return { wMin: 110, wMax: 145, minDX: 150, maxDX: 230 };
    if (count < 17) return { wMin: 105, wMax: 140, minDX: 170, maxDX: 250 };
    return             { wMin: 100, wMax: 135, minDX: 190, maxDX: 270 };
  }
  if (count < 9)   return { wMin: BASE_W_MIN, wMax: BASE_W_MAX, minDX: BASE_MIN_DX, maxDX: BASE_MAX_DX };
  if (count < 13)  return { wMin: 115, wMax: 155, minDX: 120, maxDX: 200 };
  if (count < 17)  return { wMin: 110, wMax: 150, minDX: 140, maxDX: 230 };
  return            { wMin: 105, wMax: 145, minDX: 160, maxDX: 260 };
}

function generatePlatforms(lvl){
  // deterministisch je Level
  randomSeed(lvl * 9973);

  platforms = [];
  const count = platformCountForLevel(lvl);
  const etappe = (lvl % 5 === 0);

  const bottomY   = height - 60;
  const desiredStep = (count > 1) ? (bottomY - TOP_MARGIN) / (count - 1) : 0;
  const stepY = Math.min(desiredStep, MAX_STEP_Y);

  const lat = lateralConfigForCount(count, etappe);

  // Startplattform links
  let prev = { x: 40, y: bottomY, w: START_W, h: 12 };
  platforms.push(prev);

  for (let i = 1; i < count; i++){
    const w = random(lat.wMin, lat.wMax);
    const y = bottomY - i * stepY;

    // abwechselnd rechts/links
    const sign = (i % 2 === 1) ? +1 : -1;

    const prevCenter = prev.x + prev.w/2;

    // Zielmittelpunkt mit Seitwärtsabständen
    let targetCenter = prevCenter + sign * random(lat.minDX, lat.maxDX);

    // Ränder
    const leftLimit  = 16 + w/2;
    const rightLimit = width - 16 - w/2;

    // einklemmen
    targetCenter = constrain(targetCenter, leftLimit, rightLimit);

    // falls Abstand < minDX ⇒ Gegenrichtung probieren oder exakt minDX setzen
    let dx = targetCenter - prevCenter;
    if (Math.abs(dx) < lat.minDX){
      const altCenter = prevCenter - sign * lat.minDX;
      const clampedAlt = constrain(altCenter, leftLimit, rightLimit);
      const altDX = clampedAlt - prevCenter;
      targetCenter = (Math.abs(altDX) >= lat.minDX) ? clampedAlt
                    : (sign > 0 ? Math.min(prevCenter + lat.minDX, rightLimit)
                                : Math.max(prevCenter - lat.minDX, leftLimit));
    }

    const x = targetCenter - w/2;
    const p = { x, y, w, h: 12 };
    platforms.push(p);
    prev = p;
  }

  // sortieren: kleinster y = ganz oben
  platforms.sort((a,b)=> a.y - b.y);
}

// ---------- Partikel & Animationen ----------
function burst(cx, cy, n=40, mode='confetti'){
  for (let i=0;i<n;i++){
    const ang = random(TWO_PI);
    const spd = (mode==='finale') ? random(2.5,6) : random(1.5,4);
    const vx  = cos(ang) * spd;
    const vy  = sin(ang) * spd - (mode==='confetti' ? 1 : 0);
    const life= (mode==='finale') ? random(70,110) : random(40,70);
    const c   = (mode==='death')  ? color(255,80,120)
              : (mode==='finale') ? color(random(120,255),random(120,255),255)
                                   : color(255,200,255);
    particles.push({x:cx,y:cy,vx,vy,life,ttl:life,c});
  }
}

function updateParticles(){
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.vy += 0.08;
    p.x  += p.vx;
    p.y  += p.vy;
    p.ttl--;
    if (p.ttl<=0) { particles.splice(i,1); continue; }
    const a = map(p.ttl, 0, p.life, 0, 180);
    noStroke();
    fill(red(p.c), green(p.c), blue(p.c), a);
    rect(p.x, p.y, 4, 4, 2);
  }
}

// — Levelwechsel-Animationen — (zentriert + Konfetti)
function showLevelUp(text, opts={}, after){
  const isEtappe = !!opts.etappe;

  // Partikelstärke
  const n = isEtappe ? 110 : 60;

  // IMMER Canvas-Zentrum (nicht Spieler-Position)
  const cx = width / 2;
  const cy = height / 2;
  burst(cx, cy, n, 'confetti');

  // Overlay mit Zoom animieren
  const dur = isEtappe ? 1100 : 800;
  const scaleFrom = isEtappe ? 1.25 : 1.15;
  const scaleTo   = 1.0;

  showFade(text, dur, after, {scaleFrom, scaleTo});
}

// Zeigt #fade mittig über dem Canvas mit Zoom
function showFade(text, duration=550, after, scaleOpts){
  const fade = document.getElementById('fade');
  const t    = document.getElementById('fade-text');
  if(!fade || !t) { after && after(); return; }

  t.textContent = text;
  fade.classList.remove('hidden');

  // Startzustand (leicht größer/kleiner je nach Mode)
  fade.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  fade.style.transformOrigin = 'center center';
  fade.style.opacity = '0';
  fade.style.transform = `translate(-50%, -50%) scale(${scaleOpts ? scaleOpts.scaleFrom : 1.05})`;

  // Einblenden
  requestAnimationFrame(()=>{
    fade.classList.add('show');
    fade.style.opacity = '1';
    fade.style.transform = `translate(-50%, -50%) scale(${scaleOpts ? scaleOpts.scaleTo : 1})`;
  });

  // Ausblenden nach duration
  setTimeout(()=>{
    fade.style.opacity = '0';
    // kleiner Pop beim Ausblenden
    fade.style.transform = `translate(-50%, -50%) scale(${scaleOpts ? Math.max(0.92, scaleOpts.scaleTo - 0.08) : 0.95})`;
    setTimeout(()=>{
      fade.classList.remove('show');
      fade.classList.add('hidden');
      after && after();
    }, 330);
  }, duration);
}

function showToast(text){
  const fade = document.getElementById('fade');
  const t    = document.getElementById('fade-text');
  if(!fade || !t) return;
  t.textContent = text;
  fade.classList.remove('hidden');
  fade.style.transition = 'opacity 0.25s ease';
  fade.style.opacity = '0';
  fade.style.transform = `translate(-50%, -50%) scale(1)`;
  requestAnimationFrame(()=>{
    fade.classList.add('show');
    fade.style.opacity = '1';
  });
  setTimeout(()=>{
    fade.style.opacity = '0';
    setTimeout(()=>{ fade.classList.remove('show'); fade.classList.add('hidden'); }, 220);
  }, 900);
}

// Finale
function triggerFinale(){
  finale = true;
  const cx = width/2, cy = height/2;
  for (let k=0;k<6;k++){
    setTimeout(()=> burst(cx, cy, 120, 'finale'), k*180);
  }
  showFade('🎉 Herzlichen Glückwunsch! Du hast alle 100 Level gemeistert. Du bist ein echter Profi! 🎉', 3000, ()=>{
    // optional: zurücksetzen
    // level = 1; clearProgress(); resetLevel(false);
  }, {scaleFrom:1.25, scaleTo:1.0});
}

// ---------- HUD & Utilities ----------
function updateHUD(initial=false){
  const label = document.getElementById('levelDisplay');
  if(label) label.textContent = `Level ${Math.min(level,MAX_LEVELS)} von ${MAX_LEVELS}`;

  const fillEl = document.getElementById('progress-fill');
  if(fillEl) fillEl.style.width = `${(Math.min(level,MAX_LEVELS) / MAX_LEVELS) * 100}%`;

  if(initial && !running){ redraw(); }
}

function getLevelMsg(lvl, etappe=false){
  return etappe ? `Etappenziel erreicht! Level ${lvl}` : `Level ${lvl}`;
}

// Speichern
function saveProgress(lvl){ try { localStorage.setItem(SAVE_KEY, String(lvl)); } catch(_){} }
function loadProgress(){ try { const v = localStorage.getItem(SAVE_KEY); return v? parseInt(v,10) : null; } catch(_) { return null; } }
function clearProgress(){ try { localStorage.removeItem(SAVE_KEY); } catch(_){} }

// Start‑Button‑Beschriftung dynamisch
function updateStartButtonLabel(){
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  const saved = loadProgress();
  btn.textContent = saved ? `▶️ Fortfahren (Level ${saved})` : "▶️ Fortfahren";
}

// Helpers
function getTopMostPlatform(){
  let m = platforms[0];
  for (const p of platforms) if (p.y < m.y) m = p;
  return m;
}
function getBottomMostPlatform(){
  let m = platforms[0];
  for (const p of platforms) if (p.y > m.y) m = p;
  return m;
}
function drawPlatform(p){
  noStroke();

  // Farbvariante je Level – gedimmt, nicht grell
  let col;
  if (level % 3 === 1) col = color(...UI_PINK);                   // Pink (gedimmt)
  else if (level % 3 === 2) col = color(176, 122, 255);           // Violett
  else col = color(102, 234, 255);                                // Cyan

  fill(col);
  rect(p.x, p.y, p.w, p.h, 6);

  // sanfter Glow
  push();
  drawingContext.shadowColor = col.toString();
  drawingContext.shadowBlur  = 8;
  fill(red(col), green(col), blue(col), 90);
  rect(p.x, p.y, p.w, p.h, 6);
  pop();
}
function drawPlayer(){
  noStroke();
  fill(102,234,255);
  rect(player.x, player.y, player.w, player.h, 5);
  // Mini-Schatten
  fill(0,0,0,40);
  rect(player.x+2, player.y+player.h-3, player.w-4, 3, 2);
}
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }