# winSLAP

> A physical-impact–to–audio transducer for Windows and Android — inspired by **SlapMac**.

---

## Motivation

Consumer hardware ships with accelerometers rarely surfaced to end users. winSLAP exploits the Windows Sensor API (and falls back to microphone peak analysis) to detect chassis impacts in real time and emit a configurable audio response. It exists as a proof-of-concept for hybrid sensor fusion in a cross-platform Electron + React stack.

---

## Limitations

| Constraint | Detail |
|---|---|
| **Accelerometer availability** | Windows Sensor API requires OEM firmware support. Most desktop towers have no built-in accelerometer; the engine falls back to microphone-based peak detection. |
| **Microphone false positives** | In fallback mode, high ambient SPL (e.g. bass-heavy audio) can exceed the detection threshold despite the noise gate. |
| **Android build** | APK is debug-signed and unsigned for production. Sideloading requires disabling "Install unknown sources" restrictions. |
| **Audio latency** | Web Audio API decode latency on Windows can reach 50–120 ms depending on driver buffer size. |
| **No persistent calibration** | Sensitivity settings are runtime-only; no config file is persisted between sessions. |

---

## Architecture

```
winSLAP/
├── .github/
│   └── workflows/
│       └── build-release.yml      # CI: EXE + APK + ZIP artifacts
├── slapper/                       # Electron + React application
│   ├── src/
│   │   ├── App.jsx                # UI shell, sensor routing, Web Audio API
│   │   ├── index.css              # Design tokens, ferro-link animations
│   │   └── main.jsx               # React entry point
│   ├── main.cjs                   # Electron main process + IPC bridge
│   ├── engine.py                  # Bundled Python sensor engine (extraResources)
│   ├── backend.py                 # Python process launcher
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── slapwin.py                     # Standalone Python engine (tray mode, no Electron)
├── app_ui.py                      # Legacy Tkinter UI prototype
├── SlapWin.spec                   # PyInstaller spec for standalone EXE
└── scream.wav                     # Default fallback audio asset
```

### Sensing Pipeline

```
Physical Impact
      │
      ▼
┌─────────────────────────────────────────┐
│         Windows Sensor API              │  ← Primary (Accelerometer)
│  delta-g = |√(ax²+ay²+az²) − 1.0|      │
└────────────────┬────────────────────────┘
                 │ not available
                 ▼
┌─────────────────────────────────────────┐
│      Microphone Peak Analysis           │  ← Fallback
│  volume_norm = ‖indata‖₂ × 10          │
└────────────────┬────────────────────────┘
                 │
                 ▼
         Threshold Gate
         + Cooldown Guard
                 │
                 ▼
      Web Audio API → GainNode → Output
```

---

## Installation

### Option A — Pre-built (Recommended)

Download the latest artifacts from **[GitHub Actions → Most Recent Run](https://github.com/tanbaycu/winslap/actions)**:

| Target | File | Notes |
|---|---|---|
| Windows | `winSLAP-Setup.exe` | NSIS installer, runs without Python |
| Android | `winSLAP-debug.apk` | Sideload via ADB or direct install |
| Source | `winslap_source.zip` | Full repository snapshot |

### Option B — Local Development

**Prerequisites:** Node.js ≥ 22, Python ≥ 3.10, pip

```bash
# 1. Clone
git clone https://github.com/tanbaycu/winslap.git
cd winslap/slapper

# 2. Install JS dependencies
npm install

# 3. Install Python sensor engine
pip install numpy sounddevice soundfile pystray Pillow winrt-Windows.Devices.Sensors

# 4. Run in development mode (Vite + Electron)
npm run dev        # Vite dev server
npm start          # Electron shell (separate terminal)

# 5. Package for Windows
npm run dist
```

---

## Runtime Behavior

| Mode | Trigger Condition | Indicator |
|---|---|---|
| `SENSOR` | `delta-g > threshold` | Blue badge in status bar |
| `MICROPHONE` | `volume_norm > threshold` | Green badge in status bar |
| `ACCEL` (mobile) | `‖acceleration‖ > threshold` | Green badge |

Sensitivity and cooldown are tunable at runtime via the in-app slider interface.

---

## CI/CD

Triggered on every push to `main` / `master`. Produces three artifacts via GitHub Actions:

- **winslap-source-zip** — git archive of HEAD
- **winSLAP-Setup-exe** — Electron NSIS installer (Windows runner)
- **winSLAP-android-apk** — Capacitor debug APK (Ubuntu runner + Android SDK)

Artifacts are retained for **5 days** per run.

---

*Built by [tanbaycu](https://github.com/tanbaycu).*
