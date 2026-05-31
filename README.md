# Godseye Holborn

Surveillance intelligence dashboard for the Holborn area of London — snapshot-only public camera monitoring and crime mapping in a single cinematic HUD-style interface.

The current release is intentionally single-location: **Holborn only**.

![Version](https://img.shields.io/badge/version-1.1.0-00F0FF)
![License](https://img.shields.io/badge/license-MIT-00F0FF)
![AWS](https://img.shields.io/badge/AWS-CloudFront%20%2B%20S3-FF9900)
![Lambda](https://img.shields.io/badge/AWS-Lambda%20%2B%20API%20Gateway-FF9900)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)

**Live demo:** https://d2az7a1a96iwgs.cloudfront.net/

<!-- TODO: record and add a demo gif at docs/demo.gif -->
![Demo](docs/demo.gif)

## What it does

Godseye Holborn pulls two public data sources into one map-centred dashboard and presents them with clear provenance and freshness indicators:

- **TfL JamCam** traffic-camera **snapshots** (still images, refreshed periodically — not continuous video).
- **Police UK** monthly crime data for the Holborn area.

It is built as a portfolio project to demonstrate real-time public-data integration, a polished cinematic UI, and an all-AWS serverless deployment.

## Features

### City Map View
- Dark-themed Leaflet map centred on Holborn
- Holborn-only operational scope (no multi-location switching)
- TfL JamCam markers with proximity-based filtering
- Crime incident markers with category filtering
- Target-area crosshair (Holborn, London)

### Camera Monitoring
- Snapshot-only TfL JamCam camera cards (no continuous-video claims)
- Source-truth status indicators (`snapshot`, `snapshot-aged`, `stale`, `offline`)
- Source and observed-snapshot timestamps shown in-panel
- Fullscreen camera view
- Auto-refresh with a configurable interval

### Crime Mapping
- Crime data from the Police UK API
- 14 crime categories with colour coding
- Interactive filtering by category
- Crime timeline and statistics
- Threat-score heatmap

### HUD Design
- Scan-line and grid overlay effects
- Glow animations and a dark theme
- Live clock and status indicators

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite 5 |
| **2D Maps** | Leaflet + React-Leaflet |
| **Styling** | Tailwind CSS |
| **Animation** | Framer Motion |
| **State** | Zustand |
| **HTTP** | Axios |
| **Camera runtime** | Snapshot-only JamCam images |
| **Testing** | Vitest + Playwright |
| **Hosting** | AWS CloudFront + S3 |
| **API proxy** | AWS Lambda + API Gateway |

## Project Structure

```
godseye-holborn/
├── src/
│   ├── components/
│   │   ├── core/         # App, settings, threat score, error boundary
│   │   ├── hud/          # HUD overlay, scan-line effects
│   │   ├── city/         # CityView — Leaflet map, markers, heatmap
│   │   ├── cctv/         # Camera grid + snapshot viewer
│   │   ├── crime/        # Crime panel, filters
│   │   └── layout/       # Header, panels
│   ├── services/
│   │   ├── policeApi.ts  # Police UK API (no auth)
│   │   └── tflApi.ts     # TfL JamCam API via Lambda proxy
│   ├── contexts/         # Camera + crime data providers
│   ├── store/            # Zustand store (UI preferences/selection)
│   ├── config/           # camera sources, constants
│   └── types/            # TypeScript definitions
├── proxy/                # AWS Lambda proxy source
│   └── src/
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright E2E tests
├── deploy.sh             # One-command deploy
└── .github/workflows/    # CI pipeline
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone https://github.com/MaverickHQ/godseye-holborn.git
cd godseye-holborn

npm install

cp .env.example .env.local
# Edit .env.local:
# VITE_PROXY_BASE_URL=https://<your-api-gateway-id>.execute-api.eu-west-2.amazonaws.com

npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run the Playwright E2E suite |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript checks |
| `npm run deploy` | Build and deploy to AWS (S3 + CloudFront) |

## API Keys

| Service | Purpose | Auth |
|---------|---------|------|
| **TfL API** | JamCam snapshots | `app_key` — set in the Lambda environment |
| **Police UK** | Crime data | None (public) |

The frontend is **proxy-only** for TfL runtime requests. `TFL_API_KEY` stays Lambda-side only and never enters the frontend bundle.

## Deployment

The app is a static SPA served from S3 via CloudFront, with a Lambda + API Gateway proxy as a second CloudFront origin for TfL requests.

```bash
S3_BUCKET=<your-bucket> \
CF_DIST_ID=<your-distribution-id> \
VITE_PROXY_BASE_URL=https://<your-api-gateway-id>.execute-api.eu-west-2.amazonaws.com \
npm run deploy
```

This builds the frontend, syncs hashed assets to S3 with long-lived caching, uploads `index.html` with no-cache headers, and invalidates the CloudFront distribution. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       CloudFront CDN                          │
│   /* → S3 bucket            /api/* → API Gateway (Lambda)     │
└──────────────┬───────────────────────────┬───────────────────┘
               │                           │
    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │     S3 Bucket        │    │  API Gateway HTTP    │
    │  (Static frontend)   │    │  Lambda Node 22 arm64│
    │  OAC — private       │    │  TFL_API_KEY in env  │
    └─────────────────────┘    └──────────┬───────────┘
                                          │
                               ┌──────────▼──────────┐
                               │  api.tfl.gov.uk      │
                               │  data.police.uk      │
                               └─────────────────────┘
```

## Target Area

**Holborn, London EC1**
Coordinates: `51.5185° N, 0.1065° W`

## Future Work

These are **ideas for future iterations**, not part of the current release. Anyone building on this project could take it in these directions:

- **Explainable crime-risk forecasting + backtesting.** Train an interpretable baseline model (e.g. a regularised count model) on the Holborn crime history to produce ranked risk hotspots per grid cell/time window, and backtest predictions against later-published actuals (MAE/RMSE, Precision@K, calibration). The emphasis would be honesty about what monthly, location-anonymised data can and cannot support.
- **Weekly summary reporting.** An in-app weekly view aggregating trend, forecast, and backtest outcomes, with explicit data-lag and confidence caveats.

## License

MIT — see [LICENSE](LICENSE) for details.

---

Built by [Maverick](https://github.com/MaverickHQ)
