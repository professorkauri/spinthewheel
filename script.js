const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const listEl = document.getElementById("list");
const inputEl = document.getElementById("input");
const applyBtn = document.getElementById("apply");

let items = [];
let angle = 0;
let spinning = false;

const size = canvas.width;
const radius = size / 2;

applyBtn.addEventListener("click", loadItems);
canvas.addEventListener("click", spin);

function loadItems() {
  // Parse input lines into items
  const parsed = inputEl.value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [nameRaw, numberRaw] = line.split("|").map(s => (s ?? "").trim());
      const name = nameRaw || "(Unnamed)";
      const number = numberRaw || "0";
      const img = loadImage(number);

      return {
        name,
        number,
        completed: false,
        img
      };
    });

  items = parsed;

  renderList();

  // Draw once immediately (text + segments), then redraw as images load
  drawWheel();
}

function renderList() {
  listEl.innerHTML = "";

  items.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "list-item" + (item.completed ? " completed" : "");
    div.innerHTML = `
      <img src="images/pkmn/${item.number}.webp">
      <span>${item.name}</span>
    `;

    div.onclick = () => {
      item.completed = !item.completed;
      renderList();
      drawWheel();
    };

    listEl.appendChild(div);
  });
}

function loadImage(number) {
  const img = new Image();
  img.onload = () => {
    // Redraw as soon as this image loads so it's visible without needing a click
    drawWheel();
  };
  img.onerror = () => {
    // If an image is missing, still redraw (optional) so the app stays responsive
    drawWheel();
  };
  img.src = `images/pkmn/${number}.png`;
  return img;
}

function drawWheel() {
  ctx.clearRect(0, 0, size, size);

  const active = items.filter(i => !i.completed);

  // If nothing active, still show pointer and a message
  if (!active.length) {
    drawPointer();
    ctx.save();
    ctx.fillStyle = "#333";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No active items", radius, radius);
    ctx.restore();
    return;
  }

  const slice = (Math.PI * 2) / active.length;

  // Wheel segments
  active.forEach((item, i) => {
    const start = angle + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 2, start, end);
    ctx.closePath();

    ctx.fillStyle = i % 2 ? "#fdd835" : "#ffecb3";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Segment content (icon + text)
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(start + slice / 2);

    // Place content a bit out from centre
    const contentX = radius * 0.48;

    // Icon
    if (item.img && item.img.complete && item.img.naturalWidth > 0) {
      const iconSize = 42;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(item.img, contentX - iconSize / 2, -iconSize - 8, iconSize, iconSize);
    }

    // Text
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.font = "16px sans-serif";
    ctx.fillText(item.name, contentX, 18);

    ctx.restore();
  });

  // Centre hub (nice visual anchor)
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Pointer arrow at 12 o’clock (winning reference)
  drawPointer();
}

function drawPointer() {
  // Fixed pointer at the top of the wheel (12 o'clock)
  const tipX = radius;
  const tipY = 10;

  ctx.save();
  ctx.fillStyle = "#e53935";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;

  // Triangle pointer
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);          // tip
  ctx.lineTo(tipX - 16, tipY + 26);
  ctx.lineTo(tipX + 16, tipY + 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Small pointer base circle (optional, helps visibility)
  ctx.beginPath();
  ctx.arc(tipX, tipY + 28, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.stroke();

  ctx.restore();
}

function spin() {
  if (spinning) return;

  const active = items.filter(i => !i.completed);
  if (active.length < 2) return;

  spinning = true;

  // Spin a few rotations plus a random offset
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

    // Keep angle bounded to avoid huge numbers over time
    angle = angle % (Math.PI * 2);

    drawWheel();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      // (Optional: you can compute "winner" here later if you want)
    }
  }

  requestAnimationFrame(animate);
}

loadItems();
