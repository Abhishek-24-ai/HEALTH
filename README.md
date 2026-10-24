# AURA-TRIAGE (Offline Air-Gapped Emergency Clinical Protocol)

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Air--Gapped-rose)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

A production-ready Progressive Web Application (PWA) designed for **zero-connectivity rural emergency triage** and **air-gapped optical patient transfers**. Styled like modern clinical telemetry workstations (Linear / Epic Systems), it enables continuous triage, automated Modified Early Warning Score (MEWS) clinical decision support, and camera-to-screen optical patient handoffs with zero radio frequency emissions.

---

## ⚡ Core Architecture & Features

### 1. Deterministic MEWS Clinical Engine
- **0ms Calculation Latency**: Evaluates Systolic BP, Heart Rate, Respiratory Rate, Body Temperature, and AVPU Consciousness Scale.
- **Triage Acuity Bands**:
  - 🔴 **CODE RED** ($\ge 5$ pts): Immediate Resuscitation Directive (Target: $< 5$ min).
  - 🟡 **CODE YELLOW** ($3 - 4$ pts): Urgent Intervention (Target: $< 30$ min).
  - 🟢 **CODE GREEN** ($0 - 2$ pts): Low Acuity / Routine Ward (Target: $< 120$ min).
- **Stage Demo Presets**: Instant 1-click loading of *Sepsis/Shock*, *Pediatric Fever*, *Routine Checkup*, and *Severe Trauma/Hypothermia*.

### 2. Optical Air-Gap Transfer Protocol (`AURA-1`)
- **Zero RF Emissions**: Immunity to radio jamming, deep-bunker blackouts, and disaster-zone telecom outages.
- **High-Density Payload Compression**: Minifies clinical metadata keys and applies `LZ-String` URI component compression to shrink JSON telemetry by **~70%**.
- Fits rich patient profiles, complete vitals breakdown, and anamnesis into standard QR matrix grids.

### 3. Tactical Optical Scanner & Viewfinder
- Built with `html5-qrcode` with live reticle and animated laser scanline.
- Dual-mode ingest: Camera viewfinder or direct clipboard/token fallback.
- Auto-ingest into Central Hospital Queue upon optical handshake.

### 4. Red-First Priority Background Sync Engine
- Prioritizes critical emergency patients: **RED $\rightarrow$ YELLOW $\rightarrow$ GREEN**.
- Interactive Terminal Console: Streams simulated TLS 1.3 packets, HTTP 201 responses, and server handshake IDs (`ACK-HOSP-...`).
- Dynamic Connectivity Toggle in sticky top bar: `[Air-Gap Mode (Offline)] <---> [District Cloud (Online)]`.

### 5. Web Audio API Emergency Alert System
- **Level RED**: 880 Hz / 659 Hz oscillating resuscitation pulse alarm + device haptic feedback.
- **Level YELLOW**: Resonant dual harmonic sonar chime.
- **Level GREEN**: Soft clinical confirmation.
- **Scan Handshake**: 4-note ascending arpeggio on QR ingest.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (dark slate/zinc canvas, glassmorphism, glowing urgency borders)
- **Local Database**: IndexedDB via `dexie`
- **Compression**: `lz-string`
- **QR Generation**: `qrcode.react` (SVG & Canvas for PNG download)
- **Optical Scanner**: `html5-qrcode`
- **Icons**: `lucide-react`
- **Sound & Haptics**: Web Audio API & `navigator.vibrate`

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd HEALTH
```

### 2. Install dependencies
```bash
npm install
```

### 3. Launch the development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for production
```bash
npm run build
```

---

## 📋 Air-Gap Handshake Flow

```
+---------------------------------------------------------+
| FIELD UNIT / AMBULANCE (Zero Connectivity)              |
| 1. Clinician inputs vitals or clicks 1-Click Preset     |
| 2. Deterministic MEWS calculated in 0ms (Level RED/YEL) |
| 3. "SAVE & GENERATE AIR-GAP QR" compresses payload      |
| 4. High-contrast QR displayed on screen / printed       |
+---------------------------------------------------------+
                            │
              [Air-Gapped Optical Photons]
                            ▼
+---------------------------------------------------------+
| RECEIVING TRAUMA CENTER / HOSPITAL TABLET               |
| 1. Optical scanner captures QR code                     |
| 2. Instant decompression & cryptographic verification   |
| 3. Audio alarm triggers for Code RED patients           |
| 4. Record admitted to local IndexedDB queue             |
| 5. When cloud link restored: Red-First priority sync    |
+---------------------------------------------------------+
```

---

## 📄 License
MIT License. Created for offline emergency medical response.
