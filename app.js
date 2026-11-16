"use strict";

/* days — dinding goresan. satu goresan per hari, sejak hari pertama.
   Tidak ada petunjuk di sini. Hanya kamu yang tahu. */

const START = new Date(1785283200000); // patokan
const HOLD_MS = 7000;                  // tujuh detik
const PEACE_KEY = "days.peace.v1";

const wall       = document.getElementById("wall");
const countEl    = document.getElementById("count");
const detailEl   = document.getElementById("detail");
const ring       = document.getElementById("ring");
const tip        = document.getElementById("tip");
const veil       = document.getElementById("veil");
const dialog     = document.getElementById("dialog");
const abortEl    = document.getElementById("abort");
const finale     = document.getElementById("finale");
const finaleLine = document.getElementById("finale-line");

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

let done = false;
let peace = null;

/* ---------- helpers ---------- */

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function diffDays(a, b) {
  return Math.round((b - a) / 864e5);
}

function dayNumber(d) {
  return diffDays(START, d) + 1; // hari pertama = hari ke-1
}

// rincian mingguan dipindah — sekarang murni glitch, nggak ada yang terbaca

function fmt(d) {
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

// detail terbaca: pekan dan bulan — hari sudah tampil di angka besar
function detailLine(end) {
  const total = diffDays(START, end);
  const w = Math.floor(total / 7);
  let m = (end.getFullYear() - START.getFullYear()) * 12
        + (end.getMonth() - START.getMonth());
  if (end.getDate() < START.getDate()) m--;
  const parts = [];
  if (w) parts.push(w + " week" + (w === 1 ? "" : "s"));
  if (m) parts.push(m + " month" + (m === 1 ? "" : "s"));
  return parts.join(" / ");
}

function loadPeace() {
  try {
    const raw = localStorage.getItem(PEACE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* PRNG deterministik — goresan yang sama setiap kali dibuka, seperti terukir */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- menggambar goresan ---------- */

// satu goresan vertikal: sedikit miring, melengkung halus, panjangnya beda-beda
function scratchPath(rng, x) {
  const len = 30 + rng() * 10;
  const yTop = (48 - len) / 2 + rng() * 4 - 2;
  const yBot = yTop + len;
  const bend = rng() * 5 - 2.5;
  const j1 = rng() * 2 - 1;
  const j2 = rng() * 2 - 1;
  return {
    d: `M ${x + j1} ${yTop.toFixed(1)} Q ${(x + bend).toFixed(1)} ${((yTop + yBot) / 2).toFixed(1)} ${x + j2} ${yBot.toFixed(1)}`,
    w: 2 + rng() * 1.2,
    o: 0.5 + rng() * 0.35,
    tilt: rng() * 6 - 3,
  };
}

// goresan kelima: menyilang keempat goresan sebelumnya
function slashPath(rng) {
  const midY = 36 + rng() * 5;
  return {
    d: `M 1 ${midY.toFixed(1)} Q 26 ${(30 + rng() * 6).toFixed(1)} 51 ${(7 + rng() * 4).toFixed(1)}`,
    w: 2.6 + rng() * 1.1,
    o: 0.6 + rng() * 0.3,
    tilt: rng() * 4 - 2,
  };
}

// fromDay..toDay: posisi goresan dalam dinding (0-based, mulai dari goresan pertama).
// Posisi >= strokesTotal = goresan samar "besok".
function buildGroup(fromDay, toDay, strokesTotal, lastFresh) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 52 48");
  svg.setAttribute("width", "52");
  svg.setAttribute("height", "48");

  const rng = mulberry32((fromDay + 1) * 2654435761);
  const count = toDay - fromDay + 1;

  for (let p = 0; p < count; p++) {
    const dayIdx = fromDay + p;
    const isGhost = dayIdx >= strokesTotal;
    const isDiagonal = !isGhost && count === 5 && p === 4;
    const s = isDiagonal ? slashPath(rng) : scratchPath(rng, 7 + p * 12.7);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    let date = null;
    if (isGhost) {
      g.setAttribute("class", "next");
    } else {
      date = new Date(START.getFullYear(), START.getMonth(), START.getDate() + dayIdx);
      g.dataset.day = dayNumber(date);
      g.dataset.date = fmt(date);
      g.style.setProperty("--i", dayIdx);
    }

    const visible = document.createElementNS("http://www.w3.org/2000/svg", "path");
    visible.setAttribute("class",
      "scratch" + (!isGhost && date29(date) ? " deep" : ""));
    visible.setAttribute("d", s.d);
    visible.setAttribute("stroke-width", s.w.toFixed(2));
    visible.setAttribute("stroke-opacity", s.o.toFixed(2));
    visible.setAttribute("transform", `rotate(${s.tilt.toFixed(2)} 26 24)`);
    if (dayIdx === lastFresh) visible.classList.add("fresh");
    visible.setAttribute("pointer-events", "none");

    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("class", "hit");
    hit.setAttribute("d", s.d);
    hit.setAttribute("transform", `rotate(${s.tilt.toFixed(2)} 26 24)`);

    g.appendChild(visible);
    g.appendChild(hit);
    svg.appendChild(g);
  }
  return svg;
}

function date29(d) {
  return d.getDate() === 29;
}

/* ---------- render dinding ---------- */

function render() {
  const t = today();
  const total = diffDays(START, t); // hari yang sudah lewat

  if (done && peace) {
    const end = new Date(peace.endedAt + "T00:00:00");
    countEl.textContent = diffDays(START, end);
    detailEl.textContent = detailLine(end);
  } else {
    countEl.textContent = total;
    detailEl.textContent = detailLine(t);
  }

  wall.innerHTML = "";
  const upto = done && peace ? diffDays(START, new Date(peace.endedAt + "T00:00:00")) : total;
  const strokes = upto + 1;        // termasuk hari ini
  const lastFresh = done ? -1 : upto;
  const totalPos = strokes + 1;    // +1 goresan samar "besok"
  const nGroups = Math.ceil(totalPos / 5);

  for (let gIdx = 0; gIdx < nGroups; gIdx++) {
    const from = gIdx * 5;
    const to = Math.min(from + 4, totalPos - 1);
    wall.appendChild(buildGroup(from, to, strokes, lastFresh));
  }

  if (!done) bindWall();
}

/* ---------- tooltip ---------- */

function bindWall() {
  wall.addEventListener("mouseover", (e) => {
    const g = e.target.closest("g");
    if (!g || g.classList.contains("next")) { tip.hidden = true; return; }
    tip.textContent = "day " + g.dataset.day + " \u00b7 " + g.dataset.date;
    tip.hidden = false;
  });
  wall.addEventListener("mousemove", (e) => {
    if (tip.hidden) return;
    tip.style.left = e.clientX + "px";
    tip.style.top = e.clientY + "px";
  });
  wall.addEventListener("mouseleave", () => { tip.hidden = true; });
  bindHold(wall.querySelector('g[data-day="1"]'));
}

/* ---------- pintu tersembunyi: tekan lama goresan pertama, 7 detik ---------- */

let holdTimer = null;

function positionRing(el) {
  const r = el.getBoundingClientRect();
  ring.style.left = (r.left + r.width / 2) + "px";
  ring.style.top = (r.top + r.height / 2) + "px";
}

function startHold(e) {
  if (done || holdTimer) return;
  e.preventDefault();
  positionRing(e.currentTarget);
  ring.classList.remove("on");
  void ring.getBoundingClientRect();
  ring.classList.add("on");
  holdTimer = setTimeout(() => { holdTimer = null; beginRitual(); }, HOLD_MS);
}

function cancelHold() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  ring.classList.remove("on");
}

function bindHold(firstGroup) {
  if (!firstGroup) return;
  firstGroup.addEventListener("pointerdown", startHold);
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    firstGroup.addEventListener(ev, cancelHold)
  );
  firstGroup.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* ---------- ritual ---------- */

const steps = [
  {
    text: () => "sudah " + diffDays(START, today()) + " hari. kamu yakin mau berhenti menghitung?",
    no: "belum", yes: "lanjut",
  },
  {
    text: () => "kalau lanjut, angkanya berhenti di sini. selamanya. tidak bisa diulang.",
    no: "aku belum yakin", yes: "aku tahu",
  },
  {
    text: () => "kamu sudah berdamai?",
    no: "belum", yes: "sudah",
  },
  {
    type: "type",
    text: () => "kalau kamu sudah yakin \u2014 ketik: damai",
    no: "belum", yes: "selesaikan",
  },
];

let stepIndex = 0;

function beginRitual() {
  cancelHold();
  if (done) return;
  stepIndex = 0;
  tip.hidden = true;
  veil.hidden = false;
  requestAnimationFrame(() => veil.classList.add("on"));
  showStep();
}

function closeRitual() {
  veil.classList.remove("on");
  setTimeout(() => { veil.hidden = true; dialog.innerHTML = ""; }, 600);
  abortEl.hidden = false;
  requestAnimationFrame(() => abortEl.classList.add("on"));
  setTimeout(() => {
    abortEl.classList.remove("on");
    setTimeout(() => { abortEl.hidden = true; }, 900);
  }, 2600);
}

function btn(label, primary, fn) {
  const b = document.createElement("button");
  b.textContent = label;
  if (primary) b.classList.add("primary");
  b.addEventListener("click", fn);
  return b;
}

function showStep() {
  const s = steps[stepIndex];
  dialog.innerHTML = "";

  const q = document.createElement("p");
  q.className = "q";
  q.textContent = s.text();
  dialog.appendChild(q);

  const row = document.createElement("div");
  row.className = "row";

  const noBtn = btn(s.no, false, closeRitual);
  row.appendChild(noBtn);

  if (s.type === "type") {
    const input = document.createElement("input");
    input.autocomplete = "off";
    input.spellcheck = false;
    const err = document.createElement("p");
    err.className = "err";

    const yesBtn = btn(s.yes, true, () => {
      if (input.value.trim().toLowerCase() === "damai") finishPeace();
      else {
        err.textContent = "\u2026bukan itu.";
        input.value = "";
        input.focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") yesBtn.click();
    });

    dialog.appendChild(input);
    dialog.appendChild(err);
    row.appendChild(yesBtn);
    setTimeout(() => input.focus(), 700);
  } else {
    const yesBtn = btn(s.yes, true, () => {
      stepIndex++;
      if (stepIndex < steps.length) showStep();
    });
    row.appendChild(yesBtn);
  }

  dialog.appendChild(row);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !veil.hidden) closeRitual();
});

/* ---------- selesai ---------- */

function finishPeace() {
  const t = today();
  peace = { endedAt: t.toISOString().slice(0, 10), day: dayNumber(t) };
  try { localStorage.setItem(PEACE_KEY, JSON.stringify(peace)); } catch (e) { /* tanpa reset */ }

  veil.classList.remove("on");
  setTimeout(() => { veil.hidden = true; dialog.innerHTML = ""; }, 600);
  enterPeace(true);
}

function enterPeace(animate) {
  done = true;
  document.body.classList.add("peace");

  const end = new Date(peace.endedAt + "T00:00:00");
  countEl.textContent = diffDays(START, end);
  detailEl.textContent = detailLine(end);
  finaleLine.textContent = "penghitungan selesai di hari ke-" + peace.day + ".";

  if (animate) {
    const n = wall.querySelectorAll("g").length;
    const delay = Math.min(n * 40 + 1800, 5200);
    setTimeout(() => {
      finale.hidden = false;
      requestAnimationFrame(() => finale.classList.add("on"));
    }, delay);
  } else {
    document.body.classList.add("instant");
    finale.hidden = false;
    requestAnimationFrame(() => finale.classList.add("on"));
  }
}

/* ---------- start ---------- */

peace = loadPeace();
done = !!peace;
render();
if (done) enterPeace(false);

// tepat tengah malam: satu goresan baru tergores sendiri
let lastDate = today().toDateString();
setInterval(() => {
  const t = today().toDateString();
  if (t !== lastDate && !done) {
    lastDate = t;
    render();
  }
}, 30000);
