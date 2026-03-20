const MIN_SPEED = 5;
const MAX_SPEED = 32;
const DIRECTION_PENALTY_SECONDS = 0.8;

const elements = {
  modeButtons: [...document.querySelectorAll(".mode-button")],
  distance: document.getElementById("distance"),
  speed: document.getElementById("speed"),
  time: document.getElementById("time"),
  segments: document.getElementById("segments"),
  rest: document.getElementById("rest"),
  changes: document.getElementById("changes"),
  changesWrapper: document.getElementById("changesWrapper"),
  distanceValue: document.getElementById("distanceValue"),
  speedValue: document.getElementById("speedValue"),
  timeValue: document.getElementById("timeValue"),
  segmentsValue: document.getElementById("segmentsValue"),
  restValue: document.getElementById("restValue"),
  changesValue: document.getElementById("changesValue"),
  formulaTime: document.getElementById("formulaTime"),
  penaltyTime: document.getElementById("penaltyTime"),
  segmentTime: document.getElementById("segmentTime"),
  totalTime: document.getElementById("totalTime"),
  totalDistance: document.getElementById("totalDistance"),
  phaseLabel: document.getElementById("phaseLabel"),
  segmentLabel: document.getElementById("segmentLabel"),
  timeLeft: document.getElementById("timeLeft"),
  countdownHint: document.getElementById("countdownHint"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

const inputsToLock = [
  elements.distance,
  elements.speed,
  elements.time,
  elements.segments,
  elements.rest,
  elements.changes,
];

const state = {
  mode: "linear",
  values: {
    distance: Number(elements.distance.value),
    speed: Number(elements.speed.value),
    time: Number(elements.time.value),
    segments: Number(elements.segments.value),
    rest: Number(elements.rest.value),
    changes: Number(elements.changes.value),
  },
};

const timer = {
  phase: "idle",
  running: false,
  paused: false,
  currentSegment: 0,
  remainingSeconds: 0,
  tickHandle: null,
  lastTickMs: 0,
  snapshot: null,
  audioContext: null,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function secondsFromDistanceSpeed(distanceMeters, speedKmh) {
  if (distanceMeters <= 0 || speedKmh <= 0) return 0;
  const speedMs = speedKmh / 3.6;
  return distanceMeters / speedMs;
}

function speedFromDistanceTime(distanceMeters, timeSeconds) {
  if (distanceMeters <= 0 || timeSeconds <= 0) return MIN_SPEED;
  const speedMs = distanceMeters / timeSeconds;
  return speedMs * 3.6;
}

function formatClock(seconds, showTenths = false) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  if (showTenths) {
    const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function setMode(nextMode) {
  state.mode = nextMode;
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === nextMode);
  });
  elements.changesWrapper.classList.toggle("hidden", nextMode !== "direction");
  if (nextMode !== "direction") {
    state.values.changes = 0;
    elements.changes.value = "0";
  }
  updateAll();
}

function syncTimeFromDistanceSpeed() {
  const calculatedTime = secondsFromDistanceSpeed(state.values.distance, state.values.speed);
  state.values.time = clamp(
    calculatedTime,
    Number(elements.time.min),
    Number(elements.time.max)
  );
  elements.time.value = state.values.time.toFixed(1);
}

function syncSpeedFromTime() {
  const calculatedSpeed = speedFromDistanceTime(state.values.distance, state.values.time);
  state.values.speed = clamp(calculatedSpeed, MIN_SPEED, MAX_SPEED);
  elements.speed.value = state.values.speed.toFixed(1);
  state.values.time = secondsFromDistanceSpeed(state.values.distance, state.values.speed);
  elements.time.value = state.values.time.toFixed(1);
}

function getComputedValues() {
  const formulaTime = secondsFromDistanceSpeed(state.values.distance, state.values.speed);
  const penalty =
    state.mode === "direction"
      ? state.values.changes * DIRECTION_PENALTY_SECONDS
      : 0;
  const segmentTime = formulaTime + penalty;
  const totalTime =
    segmentTime * state.values.segments +
    state.values.rest * Math.max(0, state.values.segments - 1);
  const totalDistance = state.values.distance * state.values.segments;

  return {
    formulaTime,
    penalty,
    segmentTime,
    totalTime,
    totalDistance,
  };
}

function updateOutputs() {
  const values = state.values;
  const computed = getComputedValues();

  elements.distanceValue.textContent = values.distance.toFixed(0);
  elements.speedValue.textContent = values.speed.toFixed(1);
  elements.timeValue.textContent = values.time.toFixed(1);
  elements.segmentsValue.textContent = values.segments.toFixed(0);
  elements.restValue.textContent = values.rest.toFixed(0);
  elements.changesValue.textContent = values.changes.toFixed(0);

  elements.formulaTime.textContent = formatClock(computed.formulaTime, true);
  elements.penaltyTime.textContent = `+${computed.penalty.toFixed(2)} s`;
  elements.segmentTime.textContent = formatClock(computed.segmentTime, true);
  elements.totalTime.textContent = formatClock(computed.totalTime, true);
  elements.totalDistance.textContent = `${computed.totalDistance.toFixed(0)} m`;
}

function lockControls(locked) {
  inputsToLock.forEach((input) => {
    input.disabled = locked;
  });
  elements.modeButtons.forEach((button) => {
    button.disabled = locked;
  });
}

function phaseLabel(phase) {
  if (phase === "work") return "Bieg";
  if (phase === "rest") return "Przerwa";
  if (phase === "paused") return "Pauza";
  if (phase === "done") return "Koniec sesji";
  return "Gotowy";
}

function updateTimerPanel() {
  elements.phaseLabel.textContent = phaseLabel(timer.phase);

  const totalSegments = timer.snapshot ? timer.snapshot.segments : state.values.segments;
  const shownSegment = timer.currentSegment || 0;
  elements.segmentLabel.textContent = `Odcinek ${shownSegment} / ${totalSegments}`;

  if (timer.phase === "idle") {
    elements.timeLeft.textContent = "00:00";
    elements.countdownHint.textContent = "";
    elements.pauseBtn.textContent = "Pauza";
    return;
  }

  if (timer.phase === "done") {
    elements.timeLeft.textContent = "00:00";
    elements.countdownHint.textContent = "Sesja zakonczona";
    elements.pauseBtn.textContent = "Pauza";
    return;
  }

  elements.timeLeft.textContent = formatClock(timer.remainingSeconds);
  elements.pauseBtn.textContent = timer.paused ? "Wznow" : "Pauza";

  const ceilValue = Math.ceil(timer.remainingSeconds);
  if (timer.remainingSeconds > 0 && ceilValue <= 5) {
    const suffix = timer.phase === "rest" ? "konca przerwy" : "konca odcinka";
    elements.countdownHint.textContent = `${ceilValue} s do ${suffix}`;
  } else {
    elements.countdownHint.textContent = "";
  }
}

function createBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!timer.audioContext) timer.audioContext = new AudioCtx();
    return timer.audioContext;
  } catch (error) {
    return null;
  }
}

function playBeep() {
  const ctx = createBeep();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(920, now);
  osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.21);
}

function clearTicker() {
  if (timer.tickHandle) {
    clearInterval(timer.tickHandle);
    timer.tickHandle = null;
  }
}

function stopTimer() {
  clearTicker();
  timer.running = false;
}

function nextPhase() {
  const data = timer.snapshot;
  if (!data) return;

  playBeep();

  if (timer.phase === "work") {
    if (timer.currentSegment >= data.segments) {
      timer.phase = "done";
      timer.remainingSeconds = 0;
      timer.running = false;
      timer.paused = false;
      clearTicker();
      lockControls(false);
      updateTimerPanel();
      return;
    }

    if (data.rest > 0) {
      timer.phase = "rest";
      timer.remainingSeconds = data.rest;
      updateTimerPanel();
      return;
    }

    timer.currentSegment += 1;
    timer.phase = "work";
    timer.remainingSeconds = data.segmentTime;
    updateTimerPanel();
    return;
  }

  if (timer.phase === "rest") {
    timer.currentSegment += 1;
    timer.phase = "work";
    timer.remainingSeconds = data.segmentTime;
    updateTimerPanel();
  }
}

function onTick() {
  if (!timer.running || timer.paused) return;
  const now = performance.now();
  const delta = (now - timer.lastTickMs) / 1000;
  timer.lastTickMs = now;

  timer.remainingSeconds -= delta;
  if (timer.remainingSeconds <= 0) {
    nextPhase();
    return;
  }

  updateTimerPanel();
}

function startTimer() {
  if (timer.running && !timer.paused) return;

  if (timer.phase === "paused" && timer.paused) {
    timer.paused = false;
    timer.running = true;
    timer.phase = timer.snapshot.lastPhase;
    timer.lastTickMs = performance.now();
    clearTicker();
    timer.tickHandle = setInterval(onTick, 100);
    updateTimerPanel();
    return;
  }

  const computed = getComputedValues();
  if (computed.segmentTime <= 0) return;

  timer.snapshot = {
    segments: state.values.segments,
    rest: state.values.rest,
    segmentTime: computed.segmentTime,
    lastPhase: "work",
  };

  timer.phase = "work";
  timer.running = true;
  timer.paused = false;
  timer.currentSegment = 1;
  timer.remainingSeconds = computed.segmentTime;
  timer.lastTickMs = performance.now();

  lockControls(true);
  clearTicker();
  timer.tickHandle = setInterval(onTick, 100);
  updateTimerPanel();
}

function pauseResumeTimer() {
  if (!timer.running && timer.phase !== "paused") return;

  if (!timer.paused) {
    timer.paused = true;
    timer.running = false;
    timer.snapshot.lastPhase = timer.phase;
    timer.phase = "paused";
    clearTicker();
    updateTimerPanel();
    return;
  }

  timer.paused = false;
  timer.running = true;
  timer.phase = timer.snapshot.lastPhase;
  timer.lastTickMs = performance.now();
  clearTicker();
  timer.tickHandle = setInterval(onTick, 100);
  updateTimerPanel();
}

function resetTimer() {
  stopTimer();
  timer.phase = "idle";
  timer.paused = false;
  timer.currentSegment = 0;
  timer.remainingSeconds = 0;
  timer.snapshot = null;
  lockControls(false);
  updateTimerPanel();
}

function updateAll() {
  updateOutputs();
  if (timer.phase === "idle" || timer.phase === "done") {
    updateTimerPanel();
  }
}

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.mode !== state.mode) {
      resetTimer();
      setMode(button.dataset.mode);
    }
  });
});

elements.distance.addEventListener("input", () => {
  state.values.distance = Number(elements.distance.value);
  syncTimeFromDistanceSpeed();
  updateAll();
});

elements.speed.addEventListener("input", () => {
  state.values.speed = Number(elements.speed.value);
  syncTimeFromDistanceSpeed();
  updateAll();
});

elements.time.addEventListener("input", () => {
  state.values.time = Number(elements.time.value);
  syncSpeedFromTime();
  updateAll();
});

elements.segments.addEventListener("input", () => {
  state.values.segments = Number(elements.segments.value);
  updateAll();
});

elements.rest.addEventListener("input", () => {
  state.values.rest = Number(elements.rest.value);
  updateAll();
});

elements.changes.addEventListener("input", () => {
  state.values.changes = Number(elements.changes.value);
  updateAll();
});

elements.startBtn.addEventListener("click", startTimer);
elements.pauseBtn.addEventListener("click", pauseResumeTimer);
elements.resetBtn.addEventListener("click", resetTimer);

syncTimeFromDistanceSpeed();
setMode("linear");
resetTimer();
