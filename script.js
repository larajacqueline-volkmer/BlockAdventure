
let player, gravity = 0.6, jumpForce = -12, moveSpeed = 5;
let platforms = [];
let level = 1;
let maxLevels = 100;

function setup() {
  let canvas = createCanvas(500, 500);
  canvas.parent("game-container");
  player = { x: 50, y: height - 60, w: 30, h: 30, vy: 0, onGround: false };
  generatePlatforms(level);
  updateLevelInfo();
}

function draw() {
  background(15, 15, 30);

  // Plattformen
  fill(255, 102, 204);
  for (let p of platforms) {
    rect(p.x, p.y, p.w, p.h, 8);
  }

  // Spieler
  fill(0, 200, 255);
  rect(player.x, player.y, player.w, player.h, 5);

  // Bewegung
  if (keyIsDown(LEFT_ARROW)) player.x -= moveSpeed;
  if (keyIsDown(RIGHT_ARROW)) player.x += moveSpeed;

  // Schwerkraft
  player.y += player.vy;
  player.vy += gravity;
  player.onGround = false;

  // Plattform-Kollision
  for (let p of platforms) {
    if (player.x < p.x + p.w &&
        player.x + player.w > p.x &&
        player.y + player.h < p.y + 15 &&
        player.y + player.h > p.y &&
        player.vy >= 0) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Bildschirmrand
  if (player.x < -player.w) player.x = width;
  if (player.x > width) player.x = -player.w;

  // Level geschafft (oberste Plattform)
  let topPlatform = platforms[platforms.length - 1];
  if (player.y + player.h <= topPlatform.y + 5 &&
      player.x > topPlatform.x &&
      player.x < topPlatform.x + topPlatform.w) {
    nextLevel();
  }

  // Runterfallen
  if (player.y > height) restartLevel();
}

function keyPressed() {
  if (key === " " && player.onGround) {
    player.vy = jumpForce;
  }
  if (key === "s" || key === "S") {
    saveProgress();
  }
}

function generatePlatforms(lvl) {
  platforms = [];
  let count = Math.min(3 + Math.floor(lvl / 2), 15);
  let gap = height / count;
  let lastX = 0;

  for (let i = 0; i < count; i++) {
    let y = height - i * gap - 40;
    let x;
    if (i % 2 === 0) {
      x = 40 + Math.random() * (width / 2 - 80);
    } else {
      x = width / 2 + Math.random() * (width / 2 - 80);
    }
    if (Math.abs(x - lastX) < 60) {
      x += 80;
      if (x > width - 100) x = width - 120;
    }
    platforms.push({ x, y, w: 120, h: 15 });
    lastX = x;
  }
}

function nextLevel() {
  if (level < maxLevels) {
    level++;
    player.x = 50;
    player.y = height - 60;
    player.vy = 0;
    generatePlatforms(level);
    updateLevelInfo();
    levelUpAnimation();
  } else {
    victoryAnimation();
  }
}

function restartLevel() {
  player.x = 50;
  player.y = height - 60;
  player.vy = 0;
}

function updateLevelInfo() {
  document.getElementById("level-info").innerText = `Level ${level} von ${maxLevels}`;
  document.getElementById("progress-bar").style.width = `${(level / maxLevels) * 100}%`;
}

function saveProgress() {
  localStorage.setItem("blockAdventureLevel", level);
  alert("Fortschritt gespeichert!");
}

document.getElementById("continueButton").addEventListener("click", () => {
  let saved = localStorage.getItem("blockAdventureLevel");
  if (saved) {
    level = parseInt(saved);
    generatePlatforms(level);
    updateLevelInfo();
  }
});
document.getElementById("restartButton").addEventListener("click", () => {
  level = 1;
  generatePlatforms(level);
  updateLevelInfo();
});
document.getElementById("saveButton").addEventListener("click", saveProgress);

// Touch-Steuerung
document.getElementById("leftBtn").addEventListener("touchstart", () => player.x -= moveSpeed);
document.getElementById("rightBtn").addEventListener("touchstart", () => player.x += moveSpeed);
document.getElementById("jumpBtn").addEventListener("touchstart", () => {
  if (player.onGround) player.vy = jumpForce;
});

// Animation beim Levelwechsel
function levelUpAnimation() {
  let msg = document.createElement("div");
  msg.innerText = `Level ${level}`;
  msg.style.position = "absolute";
  msg.style.top = "50%";
  msg.style.left = "50%";
  msg.style.transform = "translate(-50%, -50%)";
  msg.style.fontSize = "2.5rem";
  msg.style.color = "#ff66cc";
  msg.style.textShadow = "0 0 12px rgba(255,102,204,0.8)";
  msg.style.zIndex = "999";
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 1500);
}

function victoryAnimation() {
  alert("🎉 Herzlichen Glückwunsch! Alle 100 Level geschafft! 🎉");
}