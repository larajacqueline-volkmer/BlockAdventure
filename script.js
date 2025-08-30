
// === Block Adventure – responsive + zentriert über Wrapper ===

// ----- Config -----
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

const UI_PINK = [212,87,174]; // #d457ae
const SAVE_KEY = "block_adventure_level";
const RESTART_SAME_LEVEL_ON_DEATH = true;

// Basis-Seitenverhältnis des Spiels
const CANVAS_BASE_W = 720;
const CANVAS_BASE_H = 420;

// ----- Responsive Canvas: an Wrapperbreite koppeln -----
function targetCanvasSize(){
  const wrapper = document.querySelector('.page');
  const pageWidth = wrapper ? wrapper.clientWidth : Math.min(720, window.innerWidth*0.92);
  const height = Math.round(pageWidth * (CANVAS_BASE_H / CANVAS_BASE_W));
  const w = Math.min(pageWidth, CANVAS_BASE_W);
  const h = Math.min(height, CANVAS_BASE_H * (w / CANVAS_BASE_W));
  return { w: Math.round(w), h: Math.round(h) };
}

// ----- State -----
let level = 1;
let running = false;
let player;
let platforms = [];
let prevY = 0;

let particles = [];
let finale = false;

// Touch input flags
let touchLeft = false, touchRight = false;

// ----- Setup -----
function setup(){
  const {w,h} = targetCanvasSize();
  const cv = createCanvas(w, h);
  cv.parent("canvas-container");
  applyContainerSize();

  // Keyboard
  window.addEventListener('keydown', (e)=>{
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (!running && (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')){
      running = true;
    }
  }, {passive:false});

  // Buttons
  sel('#start-btn')   ?.addEventListener('click', onContinue);
  sel('#restart-btn') ?.addEventListener('click', onRestart);
  sel('#save-btn')    ?.addEventListener('click', onSave);

  // Touch buttons
  wireTouch('#btn-left',  v=>touchLeft=v);
  wireTouch('#btn-right', v=>touchRight=v);
  wireTouch('#btn-jump',  v=>{ if(v) tryJump(); });

  // Start
  resetLevel(false);
  updateHUD(true);
  updateStartButtonLabel();
}

function windowResized(){
  const {w,h} = targetCanvasSize();
  resizeCanvas(w,h);
  applyContainerSize();
  const keepRunning = running;
  resetLevel(true);
  running = keepRunning;
}

function applyContainerSize(){
  const el = document.getElementById('canvas-container');
  if (el){
    el.style.setProperty('--cw', `${width}px`);
    el.style.setProperty('--ch', `${height}px`);
  }
}

// ----- Button handlers -----
function onContinue(){
  const saved = loadProgress();
  if (saved) level = clamp(saved, 1, MAX_LEVELS);
  running = true; finale = false;
  resetLevel(true);
  showLevelUp(getLevelMsg(level, level%5===0), {etappe:(level%5===0)});
}
function onRestart(){
  running = true; finale = false;
  level = 1; clearProgress();
  resetLevel(true);
  updateStartButtonLabel();
  showLevelUp(getLevelMsg(level,false), {etappe:false});
}
function onSave(){
  saveProgress(level);
  updateStartButtonLabel();
  showToast(`Spielstand gespeichert (Level ${level})`);
}

// ----- Draw loop -----
function draw(){
  background(10,12,40);

  for(const p of platforms) drawPlatform(p);
  drawPlayer();
  updateParticles();
  updateHUD();

  if(!running || finale) return;

  handleInput();
  applyPhysics();
  handleCollisions();

  // Level-Up nur auf oberster Plattform
  const top = getTopMostPlatform();
  if (player.grounded && player.standingOn === top){
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

// ----- Input -----
function handleInput(){
  player.vx = 0;
  const left  = keyIsDown(LEFT_ARROW)  || touchLeft;
  const right = keyIsDown(RIGHT_ARROW) || touchRight;
  if (left && !right)  player.vx = -SPEED;
  if (right && !left)  player.vx =  SPEED;
}
function keyPressed(){
  if ((key === ' ' || keyCode === 32) && running && player.grounded && !finale){
    tryJump();
  }
  if (key === 's' || key === 'S'){ onSave(); }
}
function tryJump(){
  if (!player.grounded) return;
  player.vy = JUMP;
  player.grounded = false;
  player.standingOn = null;
}
function wireTouch(selStr, setFlag){
  const el = document.querySelector(selStr);
  if (!el) return;
  const down = (e)=>{ e.preventDefault(); setFlag(true); running = true; };
  const up   = (e)=>{ e.preventDefault(); setFlag(false); };
  el.addEventListener('touchstart', down, {passive:false});
  el.addEventListener('touchend',   up,   {passive:false});
  el.addEventListener('touchcancel',up,   {passive:false});
  el.addEventListener('mousedown',  down);
  el.addEventListener('mouseup',    up);
  el.addEventListener('mouseleave', up);
}

// ----- Physik/Kollision -----
function applyPhysics(){
  prevY = player.y;
  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;

  // Wrap
  if (player.x > width)        player.x = -player.w;
  if (player.x + player.w < 0) player.x = width;

  // Boden = Tod
  if (player.y + player.h >= height){ die(); return; }
  else player.grounded = false;
}
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

// ----- Death / Respawn -----
function die(){
  running = false;
  burst(player.x + player.w/2, player.y + player.h/2, 30, 'death');
  showFade('Oops! Versuch es nochmal', 650, () => {
    if (!RESTART_SAME_LEVEL_ON_DEATH && level > 1) level -= 1;
    resetLevel(true);
    running = true;
  }, {scaleFrom:1.0, scaleTo:1.0});
}

// ----- Level-Logik / Generierung -----
function resetLevel(placeOnStart=true){
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

function platformCountForLevel(lvl){
  const desired = 3 + (lvl - 1);
  const reduction = (lvl < 10 ? 2 : 3);
  return clamp(desired - reduction, 3, 20);
}

function lateralConfigForCount(count, etappe){
  const scale = width / CANVAS_BASE_W; // an echte Canvasbreite koppeln
  const s = (v)=> v*scale;

  if (etappe){
    if (count < 13) return { wMin:s(110), wMax:s(145), minDX:s(150), maxDX:s(230) };
    if (count < 17) return { wMin:s(105), wMax:s(140), minDX:s(170), maxDX:s(250) };
    return             { wMin:s(100), wMax:s(135), minDX:s(190), maxDX:s(270) };
  }
  if (count < 9)   return { wMin:s(BASE_W_MIN), wMax:s(BASE_W_MAX), minDX:s(BASE_MIN_DX), maxDX:s(BASE_MAX_DX) };
  if (count < 13)  return { wMin:s(115), wMax:s(155), minDX:s(120), maxDX:s(200) };
  if (count < 17)  return { wMin:s(110), wMax:s(150), minDX:s(140), maxDX:s(230) };
  return            { wMin:s(105), wMax:s(145), minDX:s(160), maxDX:s(260) };
}

function generatePlatforms(lvl){
  randomSeed(lvl * 9973);
  platforms = [];

  const count = platformCountForLevel(lvl);
  const etappe = (lvl % 5 === 0);

  const bottomY   = height - 60;
  const desiredStep = (count > 1) ? (bottomY - TOP_MARGIN) / (count - 1) : 0;
  const stepY = Math.min(desiredStep, MAX_STEP_Y);

  const lat = lateralConfigForCount(count, etappe);

  // Startplattform links
  let prev = { x: 12, y: bottomY, w: Math.min(START_W, width*0.35), h: 12 };
  platforms.push(prev);

  for (let i=1; i<count; i++){
    const w = random(lat.wMin, lat.wMax);
    const y = bottomY - i * stepY;

    const sign = (i % 2 === 1) ? +1 : -1;

    const prevCenter = prev.x + prev.w/2;
    const leftLimit  = 12 + w/2;
    const rightLimit = width - 12 - w/2;

    let targetCenter = prevCenter + sign * random(lat.minDX, lat.maxDX);
    targetCenter = constrain(targetCenter, leftLimit, rightLimit);

    let dx = targetCenter - prevCenter;
    if (Math.abs(dx) < lat.minDX){
      const altCenter = prevCenter - sign * lat.minDX;
      const clampedAlt = constrain(altCenter, leftLimit, rightLimit);
      const altDX = clampedAlt - prevCenter;
      targetCenter = (Math.abs(altDX) >= lat.minDX) ? clampedAlt
                    : (sign>0 ? Math.min(prevCenter + lat.minDX, rightLimit)
                              : Math.max(prevCenter - lat.minDX, leftLimit));
    }

    const x = targetCenter - w/2;
    const p = { x, y, w, h:12 };
    platforms.push(p);
    prev = p;
  }

  platforms.sort((a,b)=> a.y - b.y);
}

// ----- Partikel/Overlay -----
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
    p.vy += 0.08; p.x += p.vx; p.y += p.vy; p.ttl--;
    if (p.ttl<=0){ particles.splice(i,1); continue; }
    const a = map(p.ttl, 0, p.life, 0, 180);
    noStroke(); fill(red(p.c),green(p.c),blue(p.c),a); rect(p.x,p.y,4,4,2);
  }
}
function showLevelUp(text, opts={}, after){
  const etappe = !!opts.etappe;
  const n = etappe ? 110 : 60;
  burst(width/2, height/2, n, 'confetti');
  const dur = etappe ? 1100 : 800;
  const scaleFrom = etappe ? 1.25 : 1.15;
  const scaleTo   = 1.0;
  showFade(text, dur, after, {scaleFrom, scaleTo});
}
function showFade(text, duration=550, after, scaleOpts){
  const fade = sel('#fade'), t = sel('#fade-text');
  if(!fade || !t){ after&&after(); return; }
  t.textContent = text;
  fade.classList.remove('hidden');
  fade.style.transition='opacity .35s ease, transform .35s ease';
  fade.style.transformOrigin='center center';
  fade.style.opacity='0';
  fade.style.transform=`translate(-50%,-50%) scale(${scaleOpts?scaleOpts.scaleFrom:1.05})`;
  requestAnimationFrame(()=>{
    fade.classList.add('show');
    fade.style.opacity='1';
    fade.style.transform=`translate(-50%,-50%) scale(${scaleOpts?scaleOpts.scaleTo:1})`;
  });
  setTimeout(()=>{
    fade.style.opacity='0';
    fade.style.transform=`translate(-50%,-50%) scale(${Math.max(0.92,(scaleOpts?scaleOpts.scaleTo:1)-0.08)})`;
    setTimeout(()=>{ fade.classList.remove('show'); fade.classList.add('hidden'); after&&after(); }, 330);
  }, duration);
}
function showToast(text){
  const fade = sel('#fade'), t = sel('#fade-text'); if(!fade||!t) return;
  t.textContent = text; fade.classList.remove('hidden');
  fade.style.transition='opacity .25s ease'; fade.style.opacity='0'; fade.style.transform='translate(-50%,-50%)';
  requestAnimationFrame(()=>{ fade.classList.add('show'); fade.style.opacity='1'; });
  setTimeout(()=>{ fade.style.opacity='0'; setTimeout(()=>{ fade.classList.remove('show'); fade.classList.add('hidden'); },220); }, 900);
}
function triggerFinale(){
  finale = true;
  const cx = width/2, cy = height/2;
  for (let k=0;k<6;k++){ setTimeout(()=> burst(cx, cy, 120, 'finale'), k*180); }
  showFade('🎉 Herzlichen Glückwunsch! Du hast alle 100 Level gemeistert. 🎉', 3000, null, {scaleFrom:1.25, scaleTo:1.0});
}

// ----- HUD/Utils -----
function updateHUD(initial=false){
  const label = sel('#levelDisplay');
  if(label) label.textContent = `Level ${Math.min(level,MAX_LEVELS)} von ${MAX_LEVELS}`;
  const fillEl = sel('#progress-fill');
  if(fillEl) fillEl.style.width = `${(Math.min(level,MAX_LEVELS)/MAX_LEVELS)*100}%`;
  if(initial && !running){ redraw(); }
}
function getLevelMsg(lvl, etappe=false){
  return etappe ? `Etappenziel erreicht! Level ${lvl}` : `Level ${lvl}`;
}
function saveProgress(lvl){ try{ localStorage.setItem(SAVE_KEY, String(lvl)); }catch{} }
function loadProgress(){ try{ const v=localStorage.getItem(SAVE_KEY); return v?parseInt(v,10):null; }catch{ return null; } }
function clearProgress(){ try{ localStorage.removeItem(SAVE_KEY); }catch{} }
function updateStartButtonLabel(){
  const btn = sel('#start-btn'); if(!btn) return;
  const saved = loadProgress();
  btn.textContent = saved ? `▶ Fortfahren (Level ${saved})` : '▶ Fortfahren';
}
function getTopMostPlatform(){ return platforms.reduce((m,p)=> p.y<m.y?p:m, platforms[0]); }
function getBottomMostPlatform(){ return platforms.reduce((m,p)=> p.y>m.y?p:m, platforms[0]); }

function drawPlatform(p){
  noStroke();
  let col;
  if (level % 3 === 1) col = color(...UI_PINK);
  else if (level % 3 === 2) col = color(176,122,255);
  else col = color(102,234,255);
  fill(col); rect(p.x,p.y,p.w,p.h,6);
  push(); drawingContext.shadowColor = col.toString(); drawingContext.shadowBlur = 8;
  fill(red(col),green(col),blue(col),90); rect(p.x,p.y,p.w,p.h,6); pop();
}
function drawPlayer(){
  noStroke(); fill(102,234,255); rect(player.x,player.y,player.w,player.h,5);
  fill(0,0,0,40); rect(player.x+2, player.y+player.h-3, player.w-4, 3, 2);
}

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function sel(q){ return document.querySelector(q); }