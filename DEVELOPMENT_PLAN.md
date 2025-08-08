
# CNCjs Unified Sender — Phased Implementation Plan

A phased plan to enhance **CNCjs** into a unified sender/configurator that supports **grblHAL** and **FluidNC**, combining:
- ioSender‑grade **probing** workflows
- FluidNC **config editing** (YAML + endstop/status testing)
- CNCjs‑style **web UI** and **G‑code visualizer**

Each phase is intended to ship as its own PR with clear goals and acceptance criteria.

---

## Phase 0 — Project Setup & Scaffolding

### Goals
- Add a **feature flag** and **type interfaces** without breaking existing senders.
- Provide **simulated controller** for offline development and tests.

### Work Items
- Add a **device adapter** abstraction wrapping CNCjs controller plumbing.
- Implement a **simulation backend** that replays status lines and echoes G‑code.

### Acceptance Criteria
- Socket stream provides status/events to the new UI.

---

## Phase 1 — grblHAL Adapter (Serial + Telnet)

### Goals
- First‑class **grblHAL** support via a dedicated adapter.
- Robust **status parsing**: states, MPos/WPos, WCO, `Pn:` pins, feed/spindle, overrides.
- Minimal but solid job streaming.

### Work Items
- Implement `GrblHALDriver` with:
  - **Serial** transport (CNCjs serialport plumbing).
  - **Telnet** transport for TCP‑exposed boards.
- Poll `?` and parse `<...>` status lines, including extended fields.
- Map alarms/errors to CNCjs notifications.
- Ensure buffer‑aware streaming and graceful resume.

### Acceptance Criteria
- Connect via serial or telnet; see live **DRO**, **feed/spindle**, and **pin** updates.
- Run a short job end‑to‑end with correct flow control.
- Parser tolerates unknown/optional fields.

### Tech Notes
- grblHAL extends Grbl status; parser must accept variants without crashing.
- Keep sender integration compatible with existing CNCjs streaming semantics.

---

## Phase 2 — FluidNC Adapter (Serial + Optional HTTP)

### Goals
- Connect to **FluidNC** over serial for streaming/status.
- Opportunistically use **HTTP** endpoints for file and configuration operations when available.

### Work Items
- Implement `FluidNCDriver`:
  - Serial streaming + status parsing.
  - HTTP discovery (if a base URL is provided) and session handling.
  - If HTTP is available: `listFiles`, `uploadFile`, `getConfig` (YAML), `applyConfig` (upload) and **soft reboot**.
- Maintain serial‑only fallback when HTTP is not reachable.

### Acceptance Criteria
- Connect and stream a job on FluidNC.
- **Config** tab can **Load** YAML when HTTP is configured; otherwise shows a clear limitation message.
- **Files** view lists files when HTTP is available.

### Tech Notes
- Prefer HTTP for config/files to avoid SD card quirks via serial.
- Keep serial as the primary/always‑available transport.

---

## Phase 3 — Config Tab (grblHAL `$` Params, FluidNC YAML) + Inputs Panel

### Goals
- Unified **Config** tab with:
  - **grblHAL**: live `$` parameter grid (read `$$`, write `$n=value` with validation).
  - **FluidNC**: YAML editor (load, diff, apply & prompt for soft reboot).
- Live **Inputs** panel exposing endstops/probe (`Pn:`) and other pins.

### Work Items
- Backend routes:
  - `config:get` delegates to driver (`getConfig()` or `$$` dump).
  - `config:apply` writes `$` params or uploads YAML then reboots.
  - `inputs:watch` streams pin changes from status events.
- Frontend:
  - Two modes (driver‑detected) for grblHAL vs FluidNC.
  - `$` Param grid: search, inline docs tooltips, changed‑only view, import/export JSON.
  - YAML editor: side‑by‑side diff, “Apply & Reboot,” and backup on controller when possible.
  - **Inputs widget** with clear labeling of active pins.

### Acceptance Criteria
- `$` param edits apply successfully and are confirmed by a post‑apply re‑read.
- FluidNC YAML loads, diffs, applies, and prompts for soft reboot.
- Toggling a physical endstop/probe updates the Inputs panel in near‑real time.

### Tech Notes
- Batch `$` writes and confirm by re‑reading `$$` to detect mismatches.
- For YAML, generate a textual diff and store a backup copy (HTTP path) before applying.

---

## Phase 4 — Probing Tab (ioSender‑Grade Workflows)

### Goals
- Deliver a polished **Probing** UI:
  - **Edge** X±/Y±, **corner** (inside/outside), **hole center**, **Z touch**.
  - **Dry‑run**, **retract**, **safe Z**, **plate thickness**, **tool radius compensation**.
- Provide robust safety checks and clear failure handling.

### Work Items
- Implement a **probing engine** that emits controller‑agnostic G‑code:
  - `G38.2` approach w/ failure abort.
  - Optional second/slow pass.
  - Retract and apply WCS/tool offset via `G10 L20` / `G43.1`.
- Preflight safety:
  - Verify probe pin idle before starting.
  - Auto‑retract on early/false trigger.
  - Enforce configured feed/axis limits.
- Presets for metric/imperial, stored plate thickness, default feeds.

### Acceptance Criteria
- Dry‑run produces a preview (no `G38.*` sent).
- Each cycle completes and updates offsets correctly.
- Mis‑wiring/pre‑trigger produces a clear, non‑destructive abort.

### Tech Notes
- Keep emitted G‑code Grbl‑compatible; handle minor differences in error codes upstream in the adapter layer.
- Provide labeled segments so the visualizer can highlight probing motion (optional).

---

## Phase 5 — Visualizer & Job‑Control QoL

### Goals
- Enhance the existing CNCjs visualizer and job control:
  - **Start from here** (restart at a selected line with safety checks).
  - **Tool length** helper (`G43.1`), with apply/clear UI.
  - Highlight **completed** vs **remaining** toolpath segments.

### Work Items
- Map G‑code lines to visualizer segments; maintain a live line index.
- Implement **Start from here** workflow:
  - Pause, move to safe Z, optional re‑home/zero subset axes.
  - Rebuild sender queue and restart at selected line with modal confirmations.
- Add **Tooling** panel for quick `G43.1` application and clearing.

### Acceptance Criteria
- Visualizer dims/exposes segments based on sender progress.
- Restarting from a line correctly resumes motion and visual progress.
- Tool length helper applies and clears offsets without corrupting WCS/state.

---

## Phase 6 — Profiles, Safety Page, Persistence

### Goals
- **Profiles**: store multiple machine configurations (comms, driver kind, HTTP URL).
- **Safety page**: big, high‑contrast indicators for pins and interlocks.
- Persist app state and preferences to CNCjs settings.

### Work Items
- CRUD for machine profiles with per‑profile defaults.
- Safety view:
  - Live indicators for **endstops, probe, door, estop**.
  - Optional interlock to prevent job start when unsafe.
- Persist last used profile and UI settings; auto‑select on startup (optional).

### Acceptance Criteria
- Users can create/select/edit profiles.
- Interlock blocks run when an unsafe pin is active (if enabled).
- Settings persist across app restarts.

---

## Phase 7 — Tests, Docs, Packaging & Beta Release

### Goals
- Solid unit tests for parsers and probing engine; E2E smoke via simulator.
- Documentation for setup and safety.
- Beta release behind feature flag.

### Work Items
- Unit tests:
  - grblHAL/FluidNC status parsers with mixed fields and edge cases.
  - Probing G‑code builders and YAML diff utilities.
- E2E:
  - Simulator runs a short job and a probe cycle with assertions.
- Docs:
  - **Unified Sender** user guide.
  - Controller setup notes (grblHAL/FluidNC).
  - Safety disclaimers and probing best practices.
- Release:
  - Tag `vX.Y.0-beta`.
  - Change log and migration notes.

### Acceptance Criteria
- CI green on Node LTS across platforms.
- Docs discoverable from the UI help.
- Feature flag defaults to off; advanced users can enable.

---

## API & Event Contracts (Server ⇄ UI)

**REST**
- `POST /api/unified/connect { profile }` → `{ ok }`
- `POST /api/unified/disconnect` → `{ ok }`
- `POST /api/unified/send { gcode }` → `{ ok }`
- `GET /api/unified/config` → `$ map` (grblHAL) or YAML (FluidNC)
- `POST /api/unified/config` → `{ ok }`
- `GET /api/unified/files?path=/` → `string[]` (FluidNC HTTP only)
- `POST /api/unified/files/upload { path, content }` → `{ ok }`

**Socket.IO**
- `unified:status` → `{ state, position, feed, spindleRpm, pins, raw }`
- `unified:message` → `{ text }`
- `unified:alarm` → `{ code?, text }`
- `unified:error` → `{ text }`

---

## Risks & Mitigations

- **Status format variance (grblHAL builds):**
  - Write tolerant parsers; ignore unknown fields.
- **FluidNC HTTP availability:**
  - Serial‑only fallback with a clear “HTTP unavailable” banner; reduced features.
- **Probe safety:**
  - Preflight pin check, mandatory retracts, and dry‑run default on first execution.
- **“Start from here” hazards:**
  - Safety checklist modal (mode, WCS, tool, spindle, offsets) and explicit user confirmation.

---

## Recommended PR Breakdown

1. Scaffold & simulators (**Phase 0**)
2. grblHAL driver + status parser (**Phase 1**)
3. FluidNC driver + HTTP ops (**Phase 2**)
4. Config tab (+ Inputs panel) (**Phase 3**)
5. Probing tab + engine (**Phase 4**)
6. Visualizer QoL (start‑from‑here, progress) (**Phase 5**)
7. Profiles & Safety page (**Phase 6**)
8. Tests + docs + beta packaging (**Phase 7**)

---

## Developer Checklists

### Status Parsers
- [ ] Accept unknown fields without error.
- [ ] Extract `state`, `M/WPos`, `WCO`; compute missing variant if necessary.
- [ ] Parse `Pn:` into named booleans (xMin, yMin, zMin, probe, door, …).

### Probing
- [ ] Generate cycles as commented G‑code programs.
- [ ] Dry‑run replaces `G38.*` with safe rapid preview moves.
- [ ] Abort on pre‑triggered probe; retract on unexpected trigger mid‑move.
- [ ] Update WCS/tool offset via `G10 L20` / `G43.1`.

### Config
- [ ] `$` grid supports search, changed‑only, import/export JSON.
- [ ] YAML editor shows human‑readable diff and stores backup (HTTP path) before apply.
- [ ] Post‑apply verification (re‑read `$$` or YAML) with mismatch warning flow.
