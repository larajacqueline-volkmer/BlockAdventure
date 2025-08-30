
/* =========================
   Block Adventure – Canvas-Fix
   ========================= */

let canvas;
const LOGIC_W = 560, LOGIC_H = 560;

let player;
const gravity   = 0.6;
const jumpForce = -12;
const speed     = 5;

let leftHeld = false;
let rightHeld = false;

let platforms = [];
let level = 1;
const maxLevels = 100;

function setup(){
  canvas = createCanvas(LOGIC_W, LOGIC_H);
  canvas.parent("game-container");

  // ► WICHTIG: nach dem Einfügen einmal Layout erzwingen
  fitCanvasToContainer();
  setTimeout(fitCanvasToContainer, 0);
  window.addEventListener('resize', fitCanvasToContainer);

  initPlayer();
  generatePlatforms(level);
  updateUI();
  hookUI();

  window.addEventListener('blur', ()=>{ leftHeld=false; rightHeld=false; });
}

function fitCanvasToContainer(){
  const holder = document.getElementById('game-container');
  if (!holder) return;
  // Canvas füllt den Container; p5 rechnet weiter in LOGIC_W/H
  canvas.elt.style.width  = '100%';
  canvas.elt.style.height = '100%';
}

function draw(){
  background(14,18,36);

  // Plattformen
  noStroke();
  fill(201,93,185);
  for (const p of platforms) rect(p.x, p.y, p.w, p.h, 8);

  const dir = (rightHeld?1:0) - (leftHeld?1:0);
  player.prevY = player.y;
  player.x += dir * speed;

  // Wrap
  if (player.x < -player.w) player.x = width;
  if (player.x > width)     player.x = -player.w;

  // Physik
  player.vy += gravity;
  player.y  += player.vy;
  player.onGround = false;

  // Kollisionen (Top-only)
  for (const p of platforms){
    const overlapX = player.x + player.w > p.x && player.x < p.x + p.w;
    const falling  = player.vy >= 0;
    const crossing = player.prevY + player.h <= p.y && player.y + player.h >= p.y;
    if (overlapX && falling && crossing){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Player
  fill(0,204,255);
  rect(player.x, player.y, player.w, player.h, 6);

  // Zielprüfung
  const top = platforms[platforms.length - 1];
  const onTop = player.onGround &&
    Math.abs(player.y + player.h - top.y) < 0.5 &&
    (player.x + player.w/2) > top.x &&
    (player.x + player.w/2) < top.x + top.w;

  if (onTop) nextLevel();

  // Fail
  if (player.y > height + 60) resetLevel();
}

/* -------- Input -------- */
function keyPressed(){
  if (keyCode === LEFT_ARROW)  leftHeld  = true;
  if (keyCode === RIGHT_ARROW) rightHeld = true;
  if ((key === ' ' || key === 'Spacebar') && player.onGround) player.vy = jumpForce;
  if (key === 's' || key === 'S') saveProgress();
}
function keyReleased(){
  if (keyCode === LEFT_ARROW)  leftHeld  = false;
  if (keyCode === RIGHT_ARROW) rightHeld = false;
}

/* Touch */
function hold(el, on, off){
  el.addEventListener('touchstart', e=>{ e.preventDefault(); on();  }, {passive:false});
  el.addEventListener('touchend',   e=>{ e.preventDefault(); off(); }, {passive:false});
}
function hookUI(){
  document.getElementById('continueButton').onclick = continueFromSave;
  document.getElementById('restartButton').onclick  = ()=>{ level=1; resetLevel(); };
  document.getElementById('saveButton').onclick     = saveProgress;

  hold(document.getElementById('leftBtn'),  ()=> leftHeld = true,  ()=> leftHeld = false);
  hold(document.getElementById('rightBtn'), ()=> rightHeld = true, ()=> rightHeld = false);
  document.getElementById('jumpBtn').addEventListener('touchstart', e=>{
    e.preventDefault();
    if (player.onGround) player.vy = jumpForce;
  }, {passive:false});
}

/* -------- Logic -------- */
function initPlayer(){ player = { x: 48, y: height - 64, w: 28, h: 28, vy: 0, onGround:false, prevY: height-64 }; }
function resetLevel(){ initPlayer(); generatePlatforms(level); updateUI(); }
function nextLevel(){
  if (level < maxLevels){ level++; resetLevel(); levelUpFX(level); }
  else { victoryFX(); }
}

/* Plattformen: weiter auseinander, aber erreichbar */
function seededRandom(seed){ let x = (seed * 9301 + 49297) % 233280; return ()=>{ x = (x*9301 + 49297) % 233280; return x/233280; }; }

function generatePlatforms(lvl){
  platforms = [];
  const rand = seededRandom(lvl*12345+7);

  const count = Math.min(3 + Math.floor(lvl/3), 12);
  const topMargin = 80, bottomMargin = 60;
  const verticalSpan = height - topMargin - bottomMargin;

  const gapY = verticalSpan / (count - 1) * 1.2; // 20% lockerer

  const baseW = 130, minW = 80;
  const shrink = Math.min(50, Math.floor(lvl*0.6));

  let lastX = -999;
  for (let i=0;i<count;i++){
    const w = Math.max(minW, baseW - shrink);
    const y = height - bottomMargin - i*gapY;

    const half = width/2, margin=24;
    let x;
    if (i%2===0){
      const minX=margin, maxX=half - w - 48;
      x = minX + rand()*Math.max(12, maxX-minX);
    }else{
      const minX=half + 48, maxX=width - margin - w;
      x = minX + rand()*Math.max(12, maxX-minX);
    }

    if (Math.abs(x - lastX) < 80){
      x += (x < half ? 100 : -100);
      x = Math.min(Math.max(margin, x), width - w - margin);
    }

    platforms.push({x, y, w, h:14});
    lastX = x;
  }
}

/* UI / FX */
function updateUI(){
  document.getElementById('level-info').textContent = `Level ${level} von ${maxLevels}`;
  document.getElementById('progress-bar').style.width = (level/maxLevels*100)+'%';
  document.getElementById('continueButton').textContent = `▶ Fortfahren (Level ${level})`;
}

function saveProgress(){ localStorage.setItem('blockAdventureLevel', String(level)); toast('Gespeichert!'); }
function continueFromSave(){
  const saved = Number(localStorage.getItem('blockAdventureLevel')||'1');
  level = Math.min(Math.max(1, saved), maxLevels);
  resetLevel();
}

function levelUpFX(lvl){
  const overlay = document.getElementById('overlay');
  const tag = document.createElement('div');
  tag.textContent = `Level ${lvl}`;
  Object.assign(tag.style, {
    position:'absolute', left:'50%', top:'50%',
    transform:'translate(-50%,-50%)',
    color:'#c95db9', fontWeight:'800',
    fontSize:'clamp(28px,6vw,48px)',
    textShadow:'0 0 12px rgba(201,93,185,.5)',
    opacity:'0', transition:'opacity .18s ease'
  });
  overlay.appendChild(tag);
  requestAnimationFrame(()=> tag.style.opacity='1');
  setTimeout(()=> tag.style.opacity='0', 900);
  setTimeout(()=> tag.remove(), 1200);

  for (let i=0;i<24;i++){
    const dot = document.createElement('div');
    const size = 6 + Math.random()*6;
    Object.assign(dot.style,{
      position:'absolute', left:'50%', top:'50%',
      width:size+'px', height:size+'px', borderRadius:'50%',
      background: (i%2?'#00eaff':'#c95db9'),
      transform:`translate(${(Math.random()-0.5)*260}px, ${(Math.random()-0.5)*160}px)`,
      opacity:'0', transition:'opacity .25s ease'
    });
    overlay.appendChild(dot);
    setTimeout(()=> dot.style.opacity='1', 10);
    setTimeout(()=> dot.style.opacity='0', 600);
    setTimeout(()=> dot.remove(), 950);
  }
}

function victoryFX(){ alert('🎉 Herzlichen Glückwunsch! Alle 100 Level gemeistert!'); }

function toast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style,{
    position:'fixed', left:'50%', bottom:'24px',
    transform:'translateX(-50%)',
    background:'#0f1424', color:'#eef2ff',
    border:'2px solid #00eaff', borderRadius:'10px',
    padding:'8px 14px', zIndex:'9999', opacity:'0',
    transition:'opacity .2s ease'
  });
  document.body.appendChild(el);
  requestAnimationFrame(()=> el.style.opacity='1');
  setTimeout(()=> el.style.opacity='0', 1100);
  setTimeout(()=> el.remove(), 1400);
}