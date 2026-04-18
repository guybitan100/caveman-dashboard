# Titan

**Titan** is a unified UFDR (Unified Forensic Data Repository) platform that combines AI-powered UFDR generation with a full UFDR runtime creation center. Built with React 18, Material-UI 6, TypeScript, Vite, Zustand, and SWR.

---

## Features

### AI UFDR Generation
- **Conversational pipeline** — describe a scenario in natural language and a 7-step AI pipeline expands it into entities, social graphs, timelines, device selections, and full UFDR jobs.
- **Draft management** — create, rename, run, cancel, and delete UFDR generation jobs from a sidebar job list with real-time status polling.
- **Cart & entities** — inspect and edit the generated device context, entities, stories, tasks, and custom events before submission.
- **Download service** — track in-progress downloads with a floating indicator and browser-safe delivery.

### UFDR Runtime Creation Center
- **Builder tab** — step-by-step form for configuring UFDR duplication requests: choose execution mode (duplicate / summary / upload-only), source (local file or S3 evidence), model duplication strategy (copies / uniform / explicit), file and media transforms, and output/retention options.
- **Launch tab** — review the full request summary, start or cancel runs, and watch live progress with an embedded or pop-out runtime console.
- **Summary tab** — preview the source UFDR metadata (model counts, file totals, type distribution) before launching.
- **Inventory tab** — browse local UFDR files in the runtime workspace, click to select as the active source.
- **Logs tab** — full-screen live log stream with error / warning / info filtering.
- **System metrics** — header capsules show job status, UFDR count, hostname, memory, CPU load, and uptime.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **UI framework** | React 18.3.1 |
| **Component library** | Material-UI (MUI) 6.1.10 |
| **State management** | Zustand 5.0.2 + Immer |
| **Data fetching** | Axios 1.7.9 + SWR 2.2.5 |
| **Build tool** | Vite 6.0.3 (SWC) |
| **Language** | TypeScript 5.6.2 |
| **Unit tests** | Vitest 4.0.16 + Testing Library |
| **E2E tests** | Playwright 1.57.0 |
| **Theme** | Custom dark glass theme (cyan/coral accents, Space Grotesk + Manrope) |

---

## Project Structure

```
titan/
├── src/
│   ├── api/                      # API client modules
│   │   ├── jobsApi.ts            # Job CRUD + task progress
│   │   ├── pipelineApi.ts        # 7-step AI pipeline endpoints
│   │   ├── ufdrApi.ts            # UFDR submission + status polling
│   │   ├── ufdrRuntimeApi.ts     # UFDR runtime backend (health, files, run, cancel)
│   │   ├── draftApi.ts           # Draft entity/story management
│   │   ├── metafinderApi.ts      # MetaFinder data types
│   │   └── uploadsApi.ts         # File uploads
│   ├── components/
│   │   ├── layout/               # AppLayout, SplitScreenLayout
│   │   ├── home/                 # HomeHeader, GenerateInput
│   │   ├── chat/                 # ChatPanel (conversational pipeline)
│   │   ├── generation/           # GenerationPanel (pipeline steps)
│   │   ├── sidebar/              # LeftSidebar, JobCard, SearchBar
│   │   ├── cart/                 # RightSidebar, AccordionSection
│   │   ├── download/             # DownloadIndicator, DownloadProgress
│   │   ├── ufdr-runtime/         # UFDR Creation Center components
│   │   │   ├── UfdrRuntimePage   # Main page shell with tabs + header
│   │   │   ├── BuilderTab        # Request configuration form
│   │   │   ├── LaunchTab         # Launch review + console
│   │   │   ├── SummaryTab        # Summary output display
│   │   │   ├── InventoryTab      # Local UFDR file browser
│   │   │   └── ConsolePanel      # Live log stream with filtering
│   │   ├── shared/               # Reusable UI elements
│   │   └── icons/                # SVG icon components
│   ├── stores/                   # Zustand state stores
│   │   ├── conversationStore.ts  # AI pipeline conversation state
│   │   ├── jobStore.ts           # Job list + selection
│   │   ├── cartStore.ts          # Current job entities/tasks
│   │   ├── ufdrRuntimeStore.ts   # UFDR runtime form + job state
│   │   ├── downloadStore.ts      # Download tracking
│   │   ├── taskProgressStore.ts  # Task progress polling
│   │   ├── metafinderStore.ts    # MetaFinder options cache
│   │   └── deviceModelsStore.ts  # Device model catalog
│   ├── types/                    # TypeScript type definitions
│   │   ├── ufdrRuntime.ts        # Runtime types (FormState, JobSnapshot, etc.)
│   │   ├── job.ts                # Job status + list types
│   │   ├── pipeline.ts           # Pipeline step configuration
│   │   ├── cart.ts               # Cart/entity/story types
│   │   ├── taskParams.ts         # Event-specific parameter types
│   │   └── taskProgress.ts       # Task progress types
│   ├── utils/
│   │   ├── ufdrRuntime.ts        # Runtime utilities (formatting, command preview, log classification)
│   │   └── userStorage.ts        # User persistence
│   ├── contexts/                 # React contexts (Auth)
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # Business logic services
│   ├── theme/                    # MUI theme configuration
│   ├── pages/                    # Page-level components
│   ├── test/                     # Test setup + utilities
│   ├── App.tsx                   # Root component with view switching
│   └── main.tsx                  # Vite entry point
├── e2e/                          # Playwright E2E tests
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── tsconfig.app.json
```

---

## Getting Started

### Prerequisites
- **Node.js** >= 18
- **npm** >= 9

### Install dependencies
```bash
cd titan
npm install
```

### Development
```bash
npm run dev
```
Opens Vite dev server at `http://localhost:5176`.

### Build
```bash
npm run build
```
Type-checks with `tsc`, then bundles with Vite to `dist/`.

### Tests

```bash
# Unit tests (watch mode)
npm test

# Unit tests (single run)
npm run test:run

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

Coverage thresholds: 70% lines, functions, branches, and statements.

### Lint
```bash
npm run lint
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SIX_API_URL` | Base URL for the Six UFDR generation API | — |
| `VITE_UFDR_RUNTIME_URL` | Base URL for the UFDR runtime server | `http://localhost:8081` |

---

## Architecture

### View Switching
The app uses a state-driven view context (`AppView`) to switch between:
- **AI Generate** — the conversational UFDR generation pipeline (default view)
- **UFDR Runtime** — the UFDR Creation Center for manual duplication/upload

The header includes a toggle button for switching between views.

### State Management
All state is managed with **Zustand** stores using the **Immer** middleware for immutable updates:
- `conversationStore` — orchestrates the 7-step AI pipeline
- `jobStore` — manages the job list sidebar
- `cartStore` — manages the current job's entities and tasks
- `ufdrRuntimeStore` — manages the runtime creation center (form, job, files, console)

### API Layer
Each backend domain has its own API module built on **Axios**:
- `jobsApi` / `pipelineApi` / `ufdrApi` — AI generation backend
- `ufdrRuntimeApi` — UFDR runtime server (health, files, run, cancel, summary)

### Testing Strategy
- **Unit tests** with Vitest + Testing Library (440+ tests)
- **Component tests** render with a `ThemeProvider` wrapper via custom `render()` from `test/utils/test-utils.tsx`
- **API tests** mock `axios.create` and verify endpoint calls
- **Store tests** exercise Zustand state transitions directly
- **E2E tests** with Playwright for critical user flows

---

## UFDR Runtime API Reference

The UFDR Creation Center communicates with a Node.js + Python runtime server. Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/info` | App name, Python command, available UFDRs |
| GET | `/api/system/stats` | Hostname, memory, CPU load, uptime |
| GET | `/api/ufdr/files` | List local UFDR files |
| GET | `/api/ufdr/jobs/current` | Current job status + logs |
| POST | `/api/ufdr/summary` | Run UFDR summary (buffered) |
| POST | `/api/ufdr/run` | Start UFDR duplication job (background) |
| POST | `/api/ufdr/jobs/current/cancel` | Cancel running job |
| POST | `/api/restart` | Restart runtime server |
| POST | `/api/reset` | Clear job state |

---

## License

Internal use only. All rights reserved.
