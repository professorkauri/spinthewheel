const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const listEl = document.getElementById("list");
const inputEl = document.getElementById("input");
const applyBtn = document.getElementById("apply");
const titleInput = document.getElementById("title-input");
const listTitleEl = document.getElementById("list-title");
const completedInput = document.getElementById("completed-input");
const listProgressEl = document.getElementById("list-progress");


// ---------------------------
// Segment styling controls
// ---------------------------
const SEGMENT_FONT_SIZE = 26;                 // change me
const SEGMENT_FONT_FAMILY = "system-ui, sans-serif";
const SEGMENT_FONT_WEIGHT = "600";            // bold
const SEGMENT_ICON_SIZE = 120;                 // change me
const SEGMENT_CONTENT_X = 0.48;               // how far from centre (0.0–1.0)

// Order: text first, then icon (below it)
const SEGMENT_TEXT_Y = -90;                   // change me
const SEGMENT_ICON_Y = -70;                    // change me (top of icon box)

// Winner icon bounce
const WINNER_BOUNCE_AMPLITUDE = 10;   // px (smaller = subtler)
const WINNER_BOUNCE_PERIOD = 700;     // ms (lower = faster)

let winnerAnimRaf = null;
let winnerAnimTime = 0;

// ---------------------------
// localStorage persistence
// ---------------------------
const STORAGE_KEY = "spinWheelState.v2";

function saveState() {
  const state = {
    title: titleInput.value || "",
    completedText: completedInput.value || "",
    angle: angle || 0,
    items: items.map(i => ({
      title: i.title,
      spriteName: i.spriteName,
      completed: !!i.completed,
      completedBounceUntil: i.completedBounceUntil || 0
    }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


function startWinnerBounce() {
  if (winnerAnimRaf) return;

  const tick = (t) => {
    winnerAnimTime = t;
    drawWheel();
    winnerAnimRaf = requestAnimationFrame(tick);
  };

  winnerAnimRaf = requestAnimationFrame(tick);
}

function stopWinnerBounce() {
  if (!winnerAnimRaf) return;
  cancelAnimationFrame(winnerAnimRaf);
  winnerAnimRaf = null;
}

const COMPLETED_BOUNCE_DURATION_MS = 1000;

function nowMs() {
  return Date.now();
}

function shouldBounceCompleted(item) {
  return typeof item.completedBounceUntil === "number" && item.completedBounceUntil > nowMs();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const state = JSON.parse(raw);

    // Basic schema guard – if it's not the new shape, ignore it
    if (!state || !Array.isArray(state.items)) return false;
    if (state.items.length && (typeof state.items[0]?.spriteName !== "string")) return false;

    if (typeof state.title === "string") {
      titleInput.value = state.title;
    }
    if (typeof state.completedText === "string") {
      completedInput.value = state.completedText;
    }

    if (typeof state.angle === "number") {
      angle = state.angle;
    }

    items = state.items.map(it => {
      const title = (it.title || "(Unnamed)");
      const spriteName = (it.spriteName || "").trim().toLowerCase();

      return {
        title,
        spriteName,
        completed: !!it.completed,
        completedBounceUntil: typeof it.completedBounceUntil === "number" ? it.completedBounceUntil : 0,
        img: loadImage(spriteName)
      };
    });

    // Keep textarea in sync
    inputEl.value = items.map(i => `${i.title} | ${i.spriteName}`).join("\n");

    renderProgress();
    return true;
  } catch {
    return false;
  }
}



let items = [];
let angle = 0;
let spinning = false;
let winnerItem = null;

const size = canvas.width;
const radius = size / 2;

applyBtn.addEventListener("click", loadItems);
canvas.addEventListener("click", spin);
titleInput.addEventListener("input", renderTitle);
completedInput.addEventListener("input", () => {
  saveState();
  renderList(); // so existing completed items update their data attribute immediately
});

function renderProgress() {
  const total = items.length;
  const completedCount = items.filter(i => i.completed).length;

  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  listProgressEl.textContent = `${pct}%`;

  const allComplete = total > 0 && completedCount === total;

  // Persisting animation state (until anything becomes incomplete)
  listTitleEl.classList.toggle("all-complete", allComplete);
  listProgressEl.classList.toggle("all-complete", allComplete);
}

function renderTitle() {
  const title = titleInput.value.trim();
  listTitleEl.textContent = title || "Wheel Items";
  saveState();
}


function loadItems() {
  const prevByKey = new Map(
    items.map(i => [i.spriteName, i])
  );

  const parsed = inputEl.value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [titleRaw, spriteRaw] = line.split("|").map(s => (s ?? "").trim());

      const title = titleRaw || "(Unnamed)";
      const spriteName = (spriteRaw || "").trim().toLowerCase();

      const prev = prevByKey.get(spriteName);

      return {
        title,
        spriteName,
        completed: prev ? !!prev.completed : false,
        completedBounceUntil: prev ? (prev.completedBounceUntil || 0) : 0,
        img: loadImage(spriteName)
      };
    });

  items = parsed;
  winnerItem = null;

  renderTitle();
  renderList();   // <- this applies latest completedInput text to ALL completed items
  renderProgress();
  drawWheel();
  saveState();
}






function getWinnerFromPointer() {
  const active = items.filter(i => !i.completed);
  if (!active.length) return null;

  const slice = (Math.PI * 2) / active.length;

  // Pointer is fixed at 12 o’clock
  const pointerAngle = -Math.PI / 2;

  // Normalise angle into [0, 2π)
  const norm = (a) => ((a % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);

  // Compute where the pointer sits relative to the wheel rotation
  const relative = norm(pointerAngle - angle);

  const idx = Math.floor(relative / slice);
  return active[idx] ?? null;
}

function renderList() {
  listEl.innerHTML = "";

  items.forEach((item) => {
    const div = document.createElement("div");

    const isWinner = winnerItem === item && !item.completed;

    // Base classes
    div.className = "list-item" + (item.completed ? " completed" : "");
    // Apply completed data attribute when completed
    if (item.completed) {
      div.dataset.completedText = completedInput.value.trim();
    } else {
      delete div.dataset.completedText;
    }

    if (isWinner) div.classList.add("winner");

    // Apply "just completed" bounce class if still within window
    if (shouldBounceCompleted(item)) {
      div.classList.add("just-completed");

      // Ensure we re-render when the bounce window ends (so the class drops off)
      const remaining = item.completedBounceUntil - nowMs();
      window.setTimeout(() => {
        renderList();
      }, Math.max(0, remaining));
    }

    div.innerHTML = `
      <img src="${item.img.src}">
      <span>${item.title}</span>
    `;

    div.onclick = () => {
      const wasCompleted = item.completed;

      item.completed = !item.completed;

      // Start 2s bounce window when it becomes completed
      if (!wasCompleted && item.completed) {
        item.completedBounceUntil = nowMs() + COMPLETED_BOUNCE_DURATION_MS;
      } else {
        item.completedBounceUntil = 0;
      }

      // Clear winner if winner item got completed
      if (winnerItem === item && item.completed) {
        winnerItem = null;
        stopWinnerBounce();
      }

      // Clear winner if it is no longer in active items
      if (!items.filter(i => !i.completed).includes(winnerItem)) {
        winnerItem = null;
        stopWinnerBounce();
      }

      renderList();
      renderProgress();
      drawWheel();
      saveState();
    };

    listEl.appendChild(div);
  });
}




function loadImage(spriteName) {
  const img = new Image();

  img.onload = () => drawWheel();
  img.onerror = () => drawWheel();

  const raw = (spriteName || "").trim().toLowerCase();
  if (!raw) {
    img.src = "";
    return img;
  }

  const isShiny = raw.endsWith("-s");
  const baseName = isShiny ? raw.slice(0, -2) : raw;
  const variant = isShiny ? "shiny" : "regular";

  img.src = `images/pokemon/${baseName}/${variant}.png`;
  return img;
}


function drawWheel() {
  ctx.clearRect(0, 0, size, size);

  const active = items.filter(i => !i.completed);

  if (!active.length) {
    // Background fill for completed wheel
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  
    // Optional subtle inner circle to keep wheel identity
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 6, 0, Math.PI * 2);
    ctx.fillStyle = "#e5eaf6";
    ctx.fill();
    ctx.restore();
  
    // Text
    ctx.save();
    ctx.fillStyle = "#5476c2";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("All Pokémon Caught", radius, radius);
    ctx.restore();
  
    drawPointer();
    return;
  }

  const slice = (Math.PI * 2) / active.length;

  active.forEach((item, i) => {
    const start = angle + i * slice;
    const end = start + slice;

    const isWinner = winnerItem === item;

    // Base slice
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 2, start, end);
    ctx.closePath();

    ctx.fillStyle = i % 2 ? "#f4f4f4" : "#ececec";
    ctx.fill();

    // Winner overlay + stronger stroke
    if (isWinner) {
      ctx.save();
      ctx.fillStyle = "#e5eaf6";
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Segment content (text then icon) – rotated 90° clockwise
    ctx.save();
    ctx.translate(radius, radius);

    // 1) Aim at the middle of this slice
    ctx.rotate(start + slice / 2);

    // 2) Move outward along the slice direction
    const contentR = radius * SEGMENT_CONTENT_X;
    ctx.translate(contentR, 0);

    // 3) Rotate the CONTENT 90° clockwise (canvas +ve rotation is clockwise)
    ctx.rotate(Math.PI / 2);

    // 4) Draw text first (above), icon second (below), centred on local origin
    ctx.fillStyle = isWinner ? "#5476c2" : "#111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${SEGMENT_FONT_WEIGHT} ${SEGMENT_FONT_SIZE}px ${SEGMENT_FONT_FAMILY}`;
    ctx.fillText(item.title, 0, SEGMENT_TEXT_Y);

    if (item.img && item.img.complete && item.img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high"; // supported in modern browsers
      const phase = (winnerAnimTime / WINNER_BOUNCE_PERIOD) * Math.PI * 2;

      // “Bouncing” usually looks best going up and back to rest (not above rest),
      // so we use -abs(sin) to keep it on one side.
      const bounce = isWinner ? (-Math.abs(Math.sin(phase)) * WINNER_BOUNCE_AMPLITUDE) : 0;

      ctx.drawImage(
        item.img,
        -SEGMENT_ICON_SIZE / 2,
        SEGMENT_ICON_Y + bounce,
        SEGMENT_ICON_SIZE,
        SEGMENT_ICON_SIZE
      );

    }

    ctx.restore();


  });

  // Centre hub
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#5476c2";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Pointer last, so it sits above everything
  drawPointer();
}

function drawPointer() {
  // Fixed pointer at the top of the wheel (12 o'clock)
  const tipX = radius;
  const tipY = 15;

  ctx.save();
  ctx.fillStyle = "#e5eaf6";
  ctx.strokeStyle = "#5476c2";
  ctx.lineWidth = 3;

  // Small pointer base circle (above the triangle)
  ctx.beginPath();
  ctx.arc(tipX, tipY - 6, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#5476c2";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  // Triangle pointer (pointing DOWN into the wheel)
  ctx.beginPath();
  ctx.moveTo(tipX, tipY + 26);     // tip (now lower)
  ctx.lineTo(tipX - 16, tipY);     // left base
  ctx.lineTo(tipX + 16, tipY);     // right base
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}


function spin() {
  if (spinning) return;

  const active = items.filter(i => !i.completed);
  if (active.length < 1) return;

  spinning = true;

  // Clear winner while spinning (optional – feels better visually)
  winnerItem = null;
  stopWinnerBounce();
  renderList();

  const extraTurns = 5 + Math.random() * 4; // 5–9 turns
  const randomOffset = Math.random() * Math.PI * 2;
  const startAngle = angle;
  const targetAngle = startAngle + extraTurns * Math.PI * 2 + randomOffset;

  const start = performance.now();
  const duration = 2200;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(time) {
    const t = Math.min((time - start) / duration, 1);
    const eased = easeOutCubic(t);

    angle = startAngle + (targetAngle - startAngle) * eased;
    angle = angle % (Math.PI * 2);

    drawWheel();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;

      // Set winner based on final resting position
      winnerItem = getWinnerFromPointer();
      if (winnerItem) startWinnerBounce();

      drawWheel();
      renderList();
      renderProgress();
      saveState();
    }
  }

  requestAnimationFrame(animate);
}
const didLoad = loadState();

renderTitle();
renderList();
renderProgress();
drawWheel();

// If nothing was saved yet, fall back to textarea defaults
if (!didLoad) {
  renderTitle();
  loadItems();
}
