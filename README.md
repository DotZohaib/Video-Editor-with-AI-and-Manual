# AI Video Studio - Professional AI-Powered In-Browser Video Editor

AI Video Studio is a full-featured, local-first professional video editing application built with Next.js App Router, TypeScript, Tailwind CSS, Zustand, IndexedDB, and FFmpeg/WASM, featuring an AI editing assistant integrated with Google Gemini.

---

## ?? Highlights & Architecture

- **Local-First Privacy**: Source media files and video processing stay entirely inside your browser. No video is silently uploaded to external clouds.
- **FFmpeg WASM Media Engine**: Real in-browser rendering for trimming, concatenating, scaling, mixing audio, and burning subtitles into MP4/WebM containers.
- **Multi-Track Editing Timeline**: Real timeline with multiple video, audio, and text/caption tracks. Interactive clip dragging, trimming, splitting, boundary snapping, and timecode ruler.
- **Gemini AI Editing Assistant**: Natural-language editing assistant backed by Google Gemini Flash models (`gemini-2.0-flash` with fallback to `gemini-1.5-flash`), with strict Zod plan validation and smart heuristic fallbacks for offline editing.
- **IndexedDB Persistence**: Automatically saves and restores projects, clips, transforms, effects, and binary assets across page reloads. Supports JSON project export and import.
- **Real-Time Synchronized Preview**: Canvas & HTML5 video playback with interactive scrubbing, frame stepping, volume control, and dynamic text/caption overlays.

---

## ?? Getting Started

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+ recommended
- **npm**: v9+

### 2. Installation
```bash
git clone <repository-url>
cd editor
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey):
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
GEMINI_FALLBACK_MODEL=gemini-1.5-flash
```
*Note: If no API key is supplied, AI Video Studio automatically uses its intelligent heuristic rule engine to generate editing plans offline without failing.*

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ?? Testing & Verification

Run the automated test suite powered by Vitest:
```bash
npm run test
```

### Verified Test Suites:
1. `src/tests/timeline.test.ts`:
   - Time formatting (MM:SS, HH:MM:SS.mmm, parseTime)
   - Duration calculations
   - Non-destructive clip splitting at playhead with source in/out offsets
   - Edge trimming (start/end)
   - Clip movement and boundary snapping
2. `src/tests/ai-validation.test.ts`:
   - AI plan validation against existing tracks, assets, and clips
   - Rejection of invalid action kinds and dangerous payloads
   - Validation of timestamps, speed ranges, and color parameters
3. `src/tests/project-persistence.test.ts`:
   - Project factory and default track configuration
   - Schema versioning and migration
   - Subtitle SRT export and parsing

---

## ?? Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **Space** | Play / Pause Preview |
| **S** | Split selected clip at playhead |
| **Delete / Backspace** | Delete selected clip or subtitle |
| **Ctrl + Z** | Undo last operation |
| **Ctrl + Y** / **Ctrl + Shift + Z** | Redo operation |

---

## ?? Project Structure

```
editor/
+-- src/
¦   +-- app/
¦   ¦   +-- api/
¦   ¦   ¦   +-- ai/
¦   ¦   ¦       +-- route.ts          # Server-side Gemini API route
¦   ¦   +-- layout.tsx                # App layout & styling
¦   ¦   +-- page.tsx                  # Root application router (Dashboard / Editor)
¦   +-- components/
¦   ¦   +-- ai-assistant/             # Gemini chat assistant & plan review
¦   ¦   +-- dashboard/                # Project dashboard, creation & IDB storage
¦   ¦   +-- export/                   # Video export modal with FFmpeg WASM
¦   ¦   +-- inspector/                # Clip & caption properties inspector
¦   ¦   +-- media-library/            # Asset import, drag-and-drop & previews
¦   ¦   +-- preview/                  # Video preview player with live overlays
¦   ¦   +-- timeline/                 # Multi-track timeline, tracks, ruler & playhead
¦   ¦   +-- toolbar/                  # Top navigation, aspect ratio & editing tools
¦   ¦   +-- ui/                       # Reusable UI primitives (Button, Modal, Badge)
¦   +-- lib/
¦   ¦   +-- ai-validation.ts          # Strict Zod schema validator for AI actions
¦   ¦   +-- ffmpeg-renderer.ts        # In-browser FFmpeg rendering pipeline
¦   ¦   +-- idb.ts                    # IndexedDB persistence layer
¦   ¦   +-- ids.ts                    # Unique ID generator
¦   ¦   +-- media-import.ts           # Metadata, thumbnail & waveform generation
¦   ¦   +-- project-utils.ts          # Pure timeline manipulation functions
¦   ¦   +-- time.ts                   # Timecode formatters & parsers
¦   +-- store/
¦   ¦   +-- editor-store.ts           # Central Zustand store with Immer
¦   +-- tests/                        # Vitest unit & integration test suites
¦   +-- types/
¦       +-- project.ts                # TypeScript canonical project data model
+-- vitest.config.ts                  # Vitest configuration
+-- package.json
+-- README.md
```

---

## ?? Supported Formats

- **Video**: MP4 (H.264), WebM (VP8/VP9), MOV
- **Audio**: MP3, WAV, OGG, AAC
- **Images**: PNG, JPG, JPEG, WebP, GIF
- **Subtitles**: SRT, custom synchronized captions
- **Aspect Ratios**: 16:9 (YouTube), 9:16 (Shorts/Reels/TikTok), 1:1 (Square), 4:3 (Classic)









GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash
MAX_FILE_SIZE_BYTES=2147483648
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_APP_URL=http://localhost:3000

