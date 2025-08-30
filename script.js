
/* ===============================
   Block Adventure – stabile Eingaben & Layout
   =============================== */

let player, gravity = 0.6, jumpForce = -12, baseSpeed = 5;
let moveDir = 0;          // -1, 0, 1 – verhindert „Selbstlaufen“
let platforms = [];
let level = 1, maxLevels = 100;

let canvas;

/* ---------- Setup ---------- */
function setup(){
  canvas = createCanvas(560, 560);   // feste Logikgröße, skaliert per CSS
  canvas.parent("game-container");
  initPlayer();
  generatePlatforms(level);
  updateLevelInfo();
  hookUI();
}

/* ---------- Draw Loop ---------- */
function draw(){
  background(14, 18, 36);

  // Plattformen
  noStroke();
  fill(216,106,200); // var(--neon) nah
  for (const p of platforms){
    rect(p.x, p.y, p.w, p.h, 8);
  }

  // Player bewegen
  player.x += moveDir * baseSpeed;
  player.vy += gravity;
  player.y += player.vy;
  player.onGround = false;

  // Wrap an Seitenrändern
  if (player.x < -player.w) player.x = width;
  if (player.x > width)     player.x = -player.w;

  // Kollision Plattformen (nur von oben)
  for (const p of platforms){
    const hitsHorizontal = player.x + player.w > p.x && player.x < p.x + p.w;
    const hitsFromTop    = player.y + player.h <= p.y + 10 && player.y + player.h >= p.y - 8;
    if (hitsHorizontal && hitsFromTop && player.vy >= 0){
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Spieler zeichnen
  fill(0, 204, 255);
  rect(player.x, player.y, player.w, player.h, 6);

  // Siegbedingung: auf oberster Plattform stehen
  const top = platforms[platforms.length - 1];
  const onTop =
    player.y + player.h <= top.y + 4 &&
    player.x + player.w * 0.5 > top.x &&
    player.x + player.w * 0.5 < top.x + top.w;

  if (onTop) nextLevel();
  if (player.y > height + 40) restartLevel(); // runtergefallen
}

/* ---------- Eingabe: Tastatur ---------- */
function keyPressed(){
  if (keyCode === LEFT_ARROW)  moveDir = -1;
  if (keyCode === RIGHT_ARROW) moveDir =  1;
  if (key === ' ' && player.onGround) player.vy = jumpForce;
  if (key === 's' || key === 'S') saveProgress();
}
function keyReleased(){
  if ((keyCode === LEFT_ARROW && moveDir === -1) ||
      (keyCode === RIGHT_ARROW && moveDir === 1)) {
    moveDir = 0;
  }
}

/* ---------- Eingabe: Touch (gedrückt halten) ---------- */
function setTouchHold(el, startFn, endFn){
  el.addEventListener('touchstart', e => { e.preventDefault(); startFn(); }, {passive:false});
  el.addEventListener('touchend',   e => { e.preventDefault(); endFn();   }, {passive:false});
}
function hookUI(){
  // Buttons
  document.getElementById('continueButton').onclick = continueFromSave;
  document.getElementById('restartButton').onclick  = () => { level = 1; resetLevel(); };
  document.getElementById('saveButton').onclick     = saveProgress;

  // Touch-Steuerung halten
  setTouchHold(document.getElementById('leftBtn'),
    () => moveDir = -1,
    () => moveDir = (keyIsDown(RIGHT_ARROW)?1:0)
  );
  setTouchHold(document.getElementById('rightBtn'),
    () => moveDir =  1,
    () => moveDir = (keyIsDown(LEFT_ARROW)?-1:0)
  );
  document.getElementById('jumpBtn').addEventListener('touchstart', e=>{
    e.preventDefault();
    if (player.onGround) player.vy = jumpForce;
  }, {passive:false});
}

/* ---------- Spiellogik ---------- */
function initPlayer(){
  player = { x: 48, y: height - 64, w: 28, h: 28, vy: 0, onGround: false };
}

function resetLevel(){
  initPlayer();
  generatePlatforms(level);
  updateLevelInfo();
}

function nextLevel(){
  if (level < maxLevels){
    level++;
    resetLevel();
    levelUpFX();
  }else{
    victoryFX();
  }
}

function restartLevel(){ resetLevel(); }

/* ---------- Plattform-Generierung (abwechselnd L/R, Mindestabstand) ---------- */
function generatePlatforms(lvl){
  platforms = [];
  const count = Math.min(3 + Math.floor(lvl/2), 15);
  const gapY  = (height - 100) / count;
  let lastX = -999;

  for (let i=0;i<count;i++){
    const y = height - 60 - i * gapY;
    const half = width/2;
    const margin = 36;
    let x;

    // abwechselnd Links/Rechts, mit zufälligem Versatz
    if (i % 2 === 0){
      x = margin + Math.random() * (half - margin*2);
    }else{
      x = half + margin + Math.random() * (half - margin*2);
    }

    // Mindestabstand in X
    if (Math.abs(x - lastX) < 70){
      x += (x < half ? 90 : -90);
      x = Math.min(Math.max(margin, x), width - 140);
    }

    const w = 120; // einheitliche Breite
    platforms.push({x, y, w, h: 14});
    lastX = x;
  }
}

/* ---------- UI & Speicher ---------- */
function updateLevelInfo(){
  const info = document.getElementById('level-info');
  info.textContent = `Level ${level} von ${maxLevels}`;
  document.getElementById('progress-bar').style.width = (level/maxLevels*100)+'%';
  document.getElementById('continueButton').textContent = `▶ Fortfahren (Level ${level})`;
}

function saveProgress(){
  localStorage.setItem('blockAdventureLevel', String(level));
  toast('Gespeichert!');
}
function continueFromSave(){
  const saved = Number(localStorage.getItem('blockAdventureLevel') || '1');
  level = Math.min(Math.max(1, saved), maxLevels);
  resetLevel();
}

/* ---------- FX ---------- */
function levelUpFX(){
  // Text zentriert + leichtes Konfetti
  const tag = document.createElement('div');
  tag.textContent = `Level ${level}`;
  Object.assign(tag.style, {
    position:'fixed', left:'50%', top:'50%',
    transform:'translate(-50%,-50%)',
    color:'#d86ac8', fontWeight:'800',
    fontSize:'clamp(28px,6vw,48px)',
    textShadow:'0 0 12px rgba(216,106,200,.55)',
    zIndex:'9999', pointerEvents:'none', opacity:'0',
    transition:'opacity .15s ease'
  });
  document.body.appendChild(tag);
  requestAnimationFrame(()=> tag.style.opacity = '1');
  setTimeout(()=> tag.style.opacity='0', 900);
  setTimeout(()=> tag.remove(), 1200);

  // Mini-Konfetti
  for (let i=0;i<24;i++){
    const c = document.createElement('div');
    const size = 6 + Math.random()*6;
    Object.assign(c.style,{
      position:'fixed', left:'50%', top:'50%',
      width:size+'px', height:size+'px', borderRadius:'50%',
      background: i%2? '#00eaff':'#d86ac8',
      transform:`translate(-50%,-50%) translate(${(Math.random()-0.5)*260}px, ${(Math.random()-0.5)*160}px)`,
      opacity:'0', zIndex:'9998', pointerEvents:'none'
    });
    document.body.appendChild(c);
    setTimeout(()=>{ c.style.transition='opacity .3s ease'; c.style.opacity='1'; }, 10);
    setTimeout(()=>{ c.style.opacity='0'; }, 600);
    setTimeout(()=> c.remove(), 950);
  }
}

function victoryFX(){
  alert('🎉 Herzlichen Glückwunsch! Alle 100 Level gemeistert!');
}

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