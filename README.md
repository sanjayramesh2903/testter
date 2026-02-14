# BlueLane

BlueLane is a **light-blue + black** swim time analyzer focused on:
- **Math**: statistics, trend lines, variance, coefficient of variation
- **Computer Science**: parsing, event detection, and signal-to-metrics pipeline design

## What it does
1. Analyze manually entered split times.
2. Extract split-like events from uploaded race video using frame-based wall-zone change detection.
3. Optionally try browser OCR (`TextDetector`) on an uploaded split-sheet image.
4. Visualize pace trend and generate training guidance.

## Run locally
```bash
python3 -m http.server 4173
```
Then open `http://localhost:4173`.

## GitHub Pages deploy
This repository includes `.github/workflows/pages.yml`.

1. Push to GitHub.
2. Go to **Settings → Pages**.
3. Set source to **GitHub Actions**.
4. Push to `main` to deploy automatically.
