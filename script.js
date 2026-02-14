const modeSelect = document.getElementById("mode");
const splitsPanel = document.getElementById("splitsPanel");
const videoPanel = document.getElementById("videoPanel");

const splitControls = {
  poolLength: document.getElementById("poolLength"),
  distance: document.getElementById("distance"),
  splitsInput: document.getElementById("splitsInput")
};

const videoControls = {
  videoFile: document.getElementById("videoFile"),
  sampleRate: document.getElementById("sampleRate"),
  sensitivity: document.getElementById("sensitivity"),
  videoPreview: document.getElementById("videoPreview"),
  scanCanvas: document.getElementById("scanCanvas")
};

const plot = document.getElementById("plot");
const plotCtx = plot.getContext("2d");
const scanCtx = videoControls.scanCanvas.getContext("2d", { willReadFrequently: true });

let calibratedZone = null;
let extractedSplits = [];

modeSelect.addEventListener("change", () => {
  const isVideo = modeSelect.value === "video";
  splitsPanel.classList.toggle("hidden", isVideo);
  videoPanel.classList.toggle("hidden", !isVideo);
});

videoControls.videoFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  videoControls.videoPreview.src = url;
});

function parseSplits(raw) {
  return raw
    .split(/[,\n\s]+/)
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function linearRegression(yValues) {
  const n = yValues.length;
  const xMean = (n - 1) / 2;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (yValues[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function analyzeSplits(splits, sourceLabel) {
  if (splits.length < 2) {
    alert("Add at least two splits for analysis.");
    return;
  }

  extractedSplits = [...splits];

  const mean = splits.reduce((a, b) => a + b, 0) / splits.length;
  const variance = splits.reduce((sum, s) => sum + (s - mean) ** 2, 0) / splits.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;

  const best = Math.min(...splits);
  const worst = Math.max(...splits);
  const dropOff = ((worst - best) / best) * 100;

  const regression = linearRegression(splits);
  const trendPerLap = regression.slope;
  const consistencyScore = Math.max(0, 100 - cv * 6 - Math.abs(trendPerLap) * 30);

  renderChart(splits, regression);
  renderInsights({
    splitCount: splits.length,
    best,
    mean,
    dropOff,
    trendPerLap,
    consistencyScore,
    sourceLabel
  });
}

function renderChart(splits, regression) {
  plotCtx.clearRect(0, 0, plot.width, plot.height);
  const pad = 42;
  const w = plot.width - 2 * pad;
  const h = plot.height - 2 * pad;

  const minY = Math.min(...splits) * 0.95;
  const maxY = Math.max(...splits) * 1.05;

  const y = (value) => pad + ((maxY - value) / (maxY - minY || 1)) * h;
  const x = (i) => pad + (i / Math.max(splits.length - 1, 1)) * w;

  plotCtx.strokeStyle = "rgba(143,215,255,0.24)";
  plotCtx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const gy = pad + (h / 4) * i;
    plotCtx.beginPath();
    plotCtx.moveTo(pad, gy);
    plotCtx.lineTo(pad + w, gy);
    plotCtx.stroke();
  }

  plotCtx.beginPath();
  plotCtx.strokeStyle = "#52cfff";
  plotCtx.lineWidth = 2.2;
  splits.forEach((split, i) => {
    const px = x(i);
    const py = y(split);
    if (i === 0) plotCtx.moveTo(px, py);
    else plotCtx.lineTo(px, py);
  });
  plotCtx.stroke();

  plotCtx.beginPath();
  plotCtx.strokeStyle = "#9beeff";
  plotCtx.lineWidth = 1.8;
  splits.forEach((_, i) => {
    const predicted = regression.intercept + regression.slope * i;
    const px = x(i);
    const py = y(predicted);
    if (i === 0) plotCtx.moveTo(px, py);
    else plotCtx.lineTo(px, py);
  });
  plotCtx.stroke();
}

function renderInsights({ splitCount, best, mean, dropOff, trendPerLap, consistencyScore, sourceLabel }) {
  const stats = document.getElementById("stats");
  const algoNotes = document.getElementById("algoNotes");
  const studyPrompt = document.getElementById("studyPrompt");

  stats.innerHTML = [
    metric("Data Source", sourceLabel),
    metric("Total Splits", splitCount),
    metric("Best Split", `${best.toFixed(2)} s`),
    metric("Average Split", `${mean.toFixed(2)} s`),
    metric("Drop-off", `${dropOff.toFixed(2)}%`),
    metric("Trend / Lap", `${trendPerLap.toFixed(3)} s`),
    metric("Consistency", `${consistencyScore.toFixed(1)} / 100`),
    metric("Model", "Linear Regression + CV")
  ].join("");

  algoNotes.textContent =
    "The analyzer combines statistical dispersion (coefficient of variation) with linear-regression slope to estimate pacing stability. This is a CS pipeline problem: parse noisy inputs, detect events, then model trend quality.";

  const planTone = trendPerLap > 0.12 ? "front-half endurance" : "negative-split control";
  studyPrompt.textContent = `Practice idea: run 2 sets where lap 1 starts at race pace and later laps stay within ±2% of your mean split. Focus on ${planTone} and compare consistency score across sessions.`;
}

function metric(label, value) {
  return `<div class="metric"><p>${label}</p><strong>${value}</strong></div>`;
}

function averageBrightness(imageData, zone) {
  const { data, width } = imageData;
  let sum = 0;
  let count = 0;

  for (let y = zone.y; y < zone.y + zone.h; y += 1) {
    for (let x = zone.x; x < zone.x + zone.w; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count += 1;
    }
  }

  return count === 0 ? 0 : sum / count;
}

function calibrateZone() {
  const video = videoControls.videoPreview;
  if (!video.videoWidth) {
    alert("Load a video first.");
    return;
  }

  const w = videoControls.scanCanvas.width;
  const h = videoControls.scanCanvas.height;
  scanCtx.drawImage(video, 0, 0, w, h);

  calibratedZone = {
    x: Math.floor(w * 0.78),
    y: Math.floor(h * 0.2),
    w: Math.floor(w * 0.18),
    h: Math.floor(h * 0.58)
  };

  scanCtx.strokeStyle = "#52cfff";
  scanCtx.lineWidth = 2;
  scanCtx.strokeRect(calibratedZone.x, calibratedZone.y, calibratedZone.w, calibratedZone.h);
}

async function analyzeVideo() {
  const video = videoControls.videoPreview;
  const sampleRate = Number(videoControls.sampleRate.value);
  const sensitivity = Number(videoControls.sensitivity.value);

  if (!video.videoWidth) {
    alert("Load a video first.");
    return;
  }

  if (!calibratedZone) {
    calibrateZone();
  }

  const w = videoControls.scanCanvas.width;
  const h = videoControls.scanCanvas.height;
  const duration = video.duration;
  const frameStep = 1 / Math.max(sampleRate, 1);

  const contactTimes = [];
  let previous = null;

  for (let t = 0; t < duration; t += frameStep) {
    await seekVideo(video, t);
    scanCtx.drawImage(video, 0, 0, w, h);
    const imageData = scanCtx.getImageData(0, 0, w, h);
    const bright = averageBrightness(imageData, calibratedZone);

    if (previous !== null) {
      const delta = Math.abs(bright - previous);
      if (delta > sensitivity) {
        const last = contactTimes[contactTimes.length - 1];
        if (!last || t - last > 3.5) {
          contactTimes.push(t);
        }
      }
    }

    previous = bright;
  }

  if (contactTimes.length < 3) {
    alert("Could not detect enough wall events. Try higher sensitivity or a clearer video angle.");
    return;
  }

  const splits = [];
  for (let i = 1; i < contactTimes.length; i += 1) {
    splits.push(contactTimes[i] - contactTimes[i - 1]);
  }

  analyzeSplits(splits, "Video event detector");
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

async function runOCR() {
  const fileInput = document.getElementById("imageFile");
  const output = document.getElementById("ocrOutput");
  const file = fileInput.files[0];
  if (!file) {
    output.textContent = "Upload an image first.";
    return;
  }

  const canUseOCR = "TextDetector" in window;
  if (!canUseOCR) {
    output.textContent = "OCR API unavailable in this browser. Use manual split entry above.";
    return;
  }

  const bitmap = await createImageBitmap(file);
  const detector = new window.TextDetector();
  const blocks = await detector.detect(bitmap);
  const text = blocks.map((b) => b.rawValue).join(" ");
  output.textContent = `Detected text: ${text || "(none)"}`;

  const candidateTimes = parseSplits(text.replace(/[^0-9.\s,]/g, " "));
  if (candidateTimes.length >= 2) {
    analyzeSplits(candidateTimes, "Image OCR");
  }
}

document.getElementById("analyzeSplitsBtn").addEventListener("click", () => {
  const splits = parseSplits(splitControls.splitsInput.value);
  analyzeSplits(splits, "Manual splits");
});

document.getElementById("calibrateBtn").addEventListener("click", calibrateZone);
document.getElementById("analyzeVideoBtn").addEventListener("click", analyzeVideo);
document.getElementById("ocrBtn").addEventListener("click", runOCR);

analyzeSplits(parseSplits(splitControls.splitsInput.value), "Manual splits");
