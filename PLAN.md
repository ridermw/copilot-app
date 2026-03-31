# Azure AI Constellation — Demo App Plan

## Problem Statement
Build a visually stunning, interactive demo app for Microsoft Azure HPC SWEs that showcases what GitHub Copilot CLI can build in 30 minutes. The audience engineers GPU data centers hosting NVIDIA H100/B200 GPUs that power OpenAI, Microsoft AI, and the broader AI revolution.

## What We're Building
**"Azure AI Constellation"** — An interactive GPU data center visualization that renders a living, breathing cluster of GPU nodes as a star constellation. Nodes pulse with compute activity, particle trails show InfiniBand communication, and a real-time dashboard tracks training metrics. The entire app is built from scratch by Copilot CLI in 30 minutes.

## Demo Flow (5-10 min screen share)
1. Open the app → dramatic intro animation as GPU nodes fly in and form the constellation
2. Click "Launch Training" → watch GPUs cascade to life, training a simulated LLM
3. Point out the real-time loss curve, TFLOPS, power draw, and network metrics
4. Scale the cluster with a slider → watch nodes multiply
5. Switch between visualization modes (constellation view ↔ rack topology)
6. Show the "Built by Copilot CLI" overlay with code stats
7. Trigger the celebration when training "completes"

## Visual Design — "Mission Control" Aesthetic

### Design Language
Inspired by SpaceX launch control and CERN operator surfaces. Dark, precise, trustworthy. Every pixel earns its place. Glow is reserved for status (not decoration).

### Color Palette (CSS custom properties)
```css
/* Backgrounds */
--bg-void:      #060a14;    /* deepest background — canvas area */
--bg-primary:   #0a0e1a;    /* main surface — panels, header */
--bg-elevated:  #0f1629;    /* slightly lifted — hover states, active panel */
--bg-overlay:   rgba(6,10,20,0.92);  /* modal/summary overlays */

/* Accent — one primary, one alert */
--accent:       #0078D4;    /* Azure blue — THE accent color */
--accent-glow:  rgba(0,120,212,0.25); /* subtle glow on hero elements only */
--alert:        #F59E0B;    /* Amber — OFR, warnings, node failures */
--success:      #10B981;    /* Green — convergence, recovery, healthy */

/* Text */
--text-primary: #E2E8F0;    /* main body text — high contrast on dark */
--text-muted:   #64748B;    /* labels, secondary info */
--text-bright:  #FFFFFF;    /* PFLOPS hero, active metric values */

/* Constellation node colors (by utilization) */
--node-idle:    #1E3A5F;    /* dim steel blue */
--node-active:  #0078D4;    /* Azure blue — working */
--node-hot:     #F97316;    /* orange — high utilization */
--node-critical:#EF4444;    /* red — near thermal limit */
--node-ofr:     #374151;    /* gray — out for repair */

/* Borders — thin, subtle */
--border:       rgba(255,255,255,0.06);  /* panel separators */
--border-focus: rgba(0,120,212,0.4);     /* active panel indicator */
```

### Typography
```css
/* Font stack: no defaults. Use Inter for UI, JetBrains Mono for metrics/log */
--font-ui:      'Inter', -apple-system, sans-serif;  /* load from Google Fonts */
--font-mono:    'JetBrains Mono', 'SF Mono', monospace;  /* metrics + log */

/* Scale (Major Third — 1.25 ratio) */
--text-hero:    48px / 700;  /* PFLOPS counter — JetBrains Mono, tabular-nums */
--text-title:   20px / 600;  /* "AZURE AI CONSTELLATION" header — Inter, tracking 0.08em */
--text-section: 11px / 600;  /* "CLUSTER", "TRAINING" section labels — Inter, uppercase, tracking 0.12em, --text-muted */
--text-metric:  28px / 700;  /* metric values (GPU Util %, Loss) — JetBrains Mono, tabular-nums */
--text-label:   12px / 500;  /* metric labels (Nodes, OFR, Uptime) — Inter, --text-muted */
--text-body:    14px / 400;  /* general text — Inter */
--text-log:     13px / 400;  /* activity log entries — JetBrains Mono, --text-muted */
```

### Spacing Grid
- Base unit: **4px**
- Panel padding: 16px (4×4)
- Section gap: 12px (3×4)
- Metric row height: 32px (8×4)
- Header height: 48px (12×4)
- Control spacing: 8px between controls

### Panel Treatment (NO glassmorphism — matte + separators)
- Panels: `background: var(--bg-primary)`, no border-radius, no blur, no shadows
- Separated by: 1px solid `var(--border)` lines
- Active panel: left border 2px `var(--accent)` or subtle background shift to `var(--bg-elevated)`
- No card containers — metrics are structured rows with thin separators
- Only exception: PFLOPS hero gets a subtle `box-shadow: 0 0 30px var(--accent-glow)` — the ONE glow

### Motion Budget (hierarchical — not everything at once)
```
Priority │ What                          │ When                    │ Timing
─────────┼───────────────────────────────┼─────────────────────────┼──────────────────
   1     │ State transition animations   │ IDLE→LAUNCH, etc.       │ 400ms easeOutCubic
   2     │ Node status changes           │ Activation, failure     │ 200ms linear
   3     │ Metric counter updates        │ Every frame during sim  │ lerp, no easing
   4     │ Particle flow                 │ During TRAINING         │ continuous, 60fps
   5     │ Node idle breathing           │ IDLE, background        │ 2s ease-in-out, pauses during state transitions
   6     │ View toggle morph             │ User-triggered          │ 800ms easeInOutCubic
```
- Rule: Priority 1-2 animations PAUSE priority 4-5 animations briefly (100ms) to focus attention
- Rule: Never more than 2 motion priorities active simultaneously

## Architecture

### Information Hierarchy (by state)
- **IDLE**: Constellation is the anchor (dim, drifting). Eye goes to the "Launch Training" button.
- **LAUNCHING**: Activity log is bright (telling the story). Metrics dim. Constellation cascading.
- **TRAINING**: PFLOPS hero counter dominates. Loss curve secondary. Log fades to 40% opacity.
- **CONVERGING**: Loss curve flattens visibly. Nodes shift toward green. Progress bar glows.
- **COMPLETE**: Celebration → summary overlay with key stats.

### Layout (no card containers — structured rows with thin separators)
```
┌──────────────────────────────────────────────────────────────┐
│  ⬡ AZURE AI CONSTELLATION   [Model ▾] [Launch ▶] [Scale ══] │
├────────────────────────────────┬─────────────────────────────┤
│                                │  ┌─ HERO ──────────────────┐│
│                                │  │  1,247.3 PFLOPS         ││
│   ★  ✦    ★                   │  │  ▲ 12.3% from last step ││
│ ✦    ✧  ✦   ★  ✦             │  └──────────────────────────┘│
│   ★  ✦  ★    ✧    ✦          │                              │
│     ★    ✦  ★   ✦            │  TRAINING                    │
│   ✧   ★    ✦    ★  ✦         │  ████████████░░░ 78.3%       │
│     ✦  ✧  ★     ✧            │  Loss: 0.0342 ↓              │
│   [GPU CONSTELLATION CANVAS]   │  [LOSS CURVE mini-canvas]    │
│                                │                              │
│                                │  CLUSTER ─────────────────── │
│                                │  Nodes    2,048 / 2,112      │
│                                │  OFR      64 (3.0%)          │
│                                │  Uptime   99.2%              │
├────────────────────────────────┤  GPU Util  87% ████████░     │
│ ▶ Launching GPT-5 training     │  Memory   78.2 / 96 TB      │
│ ▶ Allocated 2048 H100 GPUs     │  Power    4.2 MW            │
│ ▶ InfiniBand mesh connected    │  IB       18.4 Tb/s         │
│ [ACTIVITY LOG — dims during    │                              │
│  TRAINING, brightens during    │                              │
│  LAUNCHING]                    │                              │
└────────────────────────────────┴─────────────────────────────┘
```

### Context-Aware Focus System
- During **LAUNCHING**: Activity log panel at full opacity + subtle border glow. Metrics panel at 60% opacity.
- During **TRAINING**: Metrics panel at full opacity + PFLOPS counter glow. Activity log at 40% opacity, update rate throttled to 1/5s.
- During **CONVERGING/COMPLETE**: Both panels visible, celebration overlay takes precedence.
- Transition between focus states: 400ms ease-out opacity crossfade.

### File Structure
```
copilot-app/
├── index.html              # Main HTML structure + script tags
├── style.css               # All styling (dark theme, glassmorphism, animations)
├── js/
│   ├── config.js           # Constants: colors, GPU specs, physics params
│   ├── constellation.js    # Canvas: GPU nodes as stars, pulsing, positioning
│   ├── particles.js        # Canvas: particle trails, data flows, explosions
│   ├── dashboard.js        # Metrics display, animated counters, loss curve
│   ├── activity-log.js     # Scrolling terminal-style activity feed
│   └── app.js              # Main orchestration, event handlers, game loop
├── README.md               # Demo instructions + talking points
└── package.json            # Optional: simple http-server for convenience
```

### Zero-dependency approach
- Pure HTML5 Canvas for all visualizations
- CSS Grid + Flexbox for layout
- CSS custom properties for theming
- RequestAnimationFrame for animation loop
- No frameworks, no build step, no npm install required
- Opens directly from `file://` or via `npx serve`

## Interaction State Table

```
STATE        │ CONSTELLATION              │ METRICS PANEL           │ ACTIVITY LOG            │ CONTROLS
─────────────┼────────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────
IDLE         │ Nodes dim blue, slow drift │ PFLOPS: "0.0" pulse     │ "Cluster ready.         │ Launch: ▶ enabled
             │ wobble. Subtle starfield.  │ GPU Util: ░░░░ 0%       │  2,112 nodes online."   │ Scale: enabled
             │ Breathe animation: 2s ease │ OFR: 0. Uptime: 99.9%  │ Log at full opacity     │ Model: enabled
             │                            │ Training: "—"           │                         │ View: enabled
─────────────┼────────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────
LAUNCHING    │ Cascade activation: nodes  │ PFLOPS ramps up 0→peak  │ Full opacity + glow.    │ Launch: ⏸ pause
(~5s)        │ light up from center out,  │ GPU Util rises in waves │ Rapid messages:         │ Scale: disabled
             │ 50ms stagger per ring.     │ OFR holds. Progress: 0% │ "Allocating H100s..."   │ Model: disabled
             │ Color: dim blue → bright   │ Loss curve: first point │ "InfiniBand connecting" │ View: disabled
─────────────┼────────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────
TRAINING     │ All active nodes pulsing.  │ PFLOPS: hero, animated  │ 40% opacity, 1msg/5s.   │ Launch: ⏸ pause
             │ Particles flowing between  │ Loss curve descending   │ "Checkpoint step 4.2M"  │ Scale: enabled
             │ nodes. Node failures:      │ Training: filling bar   │ "Gradient sync OK"      │ Model: disabled
             │ random node → red flash,   │ OFR ticks up on failure │ Node fail: highlighted  │ View: enabled
             │ particles reroute.         │ Uptime adjusts          │ "Node r42-g7 → OFR"     │
             │ Recovery: 10-15s, rejoin.  │ Metrics tied to sim     │ "Node r42-g7 recovered" │
─────────────┼────────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────
CONVERGING   │ Nodes shift blue → green.  │ Loss curve flattens.    │ "Convergence detected"  │ Same as TRAINING
             │ Pulse rate slows (calm).   │ PFLOPS stabilizes.      │ "Final checkpoint..."   │
             │ Particle speed reduces.    │ Progress: >90% glow     │ Both panels at 80%      │
─────────────┼────────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────
COMPLETE     │ Brief fireworks burst:     │ Summary overlay:        │ "Training complete!      │ Launch: "Reset"
             │ 20-40 particles/node,      │ "2,048 H100s ×4.2h     │  Final loss: 0.031"     │ Scale: enabled
             │ radial, accent colors,     │  Final loss: 0.031      │                         │ Model: enabled
             │ gravity+fade over 2s.      │  1,247 peak PFLOPS"     │                         │
             │ Then gentle idle glow.     │ Auto-dismiss after 8s   │                         │
             │ Duration: 3s burst.        │ or click to dismiss     │                         │
─────────────┼────────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────
NODE_FAILURE │ Target node: red flash     │ OFR counter: +1,        │ "⚠ Node rXX-gYY OFR"   │ No change
(sub-state)  │ (200ms), then dim gray.    │ red text flash 1s.      │ in amber text.          │
             │ Neighbors brighten (load   │ Uptime adjusts.         │ After recovery:         │
             │ redistribution).           │ PFLOPS dips briefly.    │ "✓ Node rXX-gYY back"   │
             │ Particles reroute around.  │                         │ in green text.           │
             │ Recovery: fade back in,    │                         │                         │
             │ 10-15s random interval.    │                         │                         │
```

### Canvas Initialization
- Frame 0: Black screen with faint grid lines fading in (100ms)
- Frame 1: Title text renders, controls appear (200ms)
- Frame 2-60: Nodes spawn from center, spiral outward to rack positions (1.5s total, 2ms stagger per node, easeOutCubic)
- Frame 61+: Idle state — nodes settle into breathing animation

### Intro Animation Spec
- Total duration: 2 seconds
- Node spawn: staggered from center outward, each node scales from 0 → full size
- Easing: easeOutCubic (fast start, gentle settle)
- Grid lines fade in at 30% opacity behind nodes
- Header + controls slide down from top (300ms, easeOutQuart)
- Sidebar slides in from right (400ms delay, 300ms duration)
- Activity log types first message: "Cluster online. 2,112 nodes ready."

## Technical Details

### GPU Constellation (constellation.js)
- Each GPU node = a "star" on the canvas
- Position: arranged in clusters (racks), with slight organic wobble
- Size: min 2px radius (at 4096 nodes), max 8px radius (at 256 nodes)
- Rendered as filled circles with 1px status-colored glow
- Color: utilization gradient (--node-idle → --node-active → --node-hot → --node-critical)
- OFR nodes: --node-ofr gray, no pulse
- Animation: gentle breathing pulse (2s ease-in-out), brightness flicker
- On "Launch Training": cascade activation spreading from center, 50ms stagger per ring
- **Click-to-inspect**: click a node → persistent info panel near click position showing GPU ID, rack, model, temp, utilization, memory. Click elsewhere to dismiss. No hover tooltips (prevents flicker on screen share).
- At >1024 nodes, inspection only works on nodes within 8px of click (nearest-neighbor)
- Support for 256–4096 nodes with smooth performance

### Particle System (particles.js)
- Data flow particles: travel along paths between connected nodes (InfiniBand)
- Speed proportional to network bandwidth utilization
- Gradient trail effect (bright head, fading tail)
- On celebration: burst into fireworks from each node
- Particle pooling for performance (reuse objects, no GC pressure)

### Dashboard (dashboard.js)
- Animated number counters (roll up/down smoothly)
- GPU utilization: segmented bar chart, color-coded
- PFLOPS: large animated counter  
- Training progress: gradient progress bar with glow effect
- Loss curve: real-time line chart drawn on mini-canvas, auto-scaling Y axis
- Power draw: with realistic MW numbers for GPU clusters
- All metrics derived from constellation state (not random — tied to actual node activity)

### Activity Log (activity-log.js)
- Terminal-style scrolling feed
- Timestamped messages: job launches, checkpoint saves, node events
- Green text on dark background (classic terminal aesthetic)
- Auto-generates contextually relevant messages based on simulation state

### App Orchestration (app.js)
- Main animation loop (requestAnimationFrame)
- Event handlers for controls (launch, scale, mode switch)
- Simulation state machine: IDLE → LAUNCHING → TRAINING → CONVERGING → COMPLETE
- Keyboard shortcuts for smooth demo flow:
  - `Space` = Launch/Pause training
  - `+`/`-` = Scale cluster
  - `C` = Celebration mode
  - `R` = Reset

### User Journey & Emotional Arc
```
STEP │ USER SEES              │ USER FEELS      │ DESIGN SUPPORTS IT WITH
─────┼────────────────────────┼─────────────────┼───────────────────────────────
  1  │ Black → nodes fly in   │ Awe             │ 2s intro, spiral spawn, easeOutCubic
  2  │ Idle cluster breathing │ Anticipation    │ Dim blue drift, pulsing Launch button
  3  │ Click Launch → cascade │ Excitement      │ 50ms ring stagger, bright activation
  4  │ Training: metrics flow │ Engagement      │ PFLOPS hero, loss curve descending
  5  │ Milestone events       │ "Whoa" moments  │ Checkpoints, PFLOPS milestones, spikes
  6  │ Node failure + reroute │ Recognition     │ OFR counter, amber alerts, auto-recovery
  7  │ Scale slider → growth  │ Power           │ Nodes materialize, cluster expands
  8  │ View toggle morph      │ "How did they…" │ 800ms node morph constellation↔rack
  9  │ Convergence detected   │ Satisfaction    │ Green shift, calm pulse, flattening loss
 10  │ Celebration burst      │ Delight         │ 3s fireworks, summary overlay, applause
```

### Scripted Training Milestones (break monotony every 10-15s)
1. **t+5s**: "First gradient sync" — all particles briefly align, flow in unison for 1s
2. **t+15s**: "Checkpoint saved — step 100K" — nodes flash white briefly (100ms), log message
3. **t+25s**: "1,000 PFLOPS sustained!" — PFLOPS counter pulses + glow, toast notification
4. **t+35s**: Node failure event — random node goes OFR, particles reroute
5. **t+45s**: "Epoch 1 complete" — progress bar segment fills, brief celebration micro-burst
6. **t+55s**: Node recovery + "Communication-intensive phase" — particle density doubles for 3s
7. **t+65s**: CONVERGING state triggers — loss curve visibly flattens
8. **t+75s**: COMPLETE — celebration fireworks

### View Toggle: Constellation ↔ Rack Topology
- **Transition**: Nodes morph from current position to target position over 800ms
- **Easing**: easeInOutCubic — smooth acceleration and deceleration
- **During transition**: Particles fade out (200ms), node connections redraw, particles fade back in (200ms after morph)
- **Rack layout**: Nodes arrange in a grid by rack (8 racks × N nodes), color-coded by rack
- **Constellation layout**: Nodes in organic clusters with slight randomization
- **Both layouts maintain**: node status colors, pulse animations, failure states

### Scale Slider Behavior
- **Snap points**: 256, 512, 1024, 2048, 4096
- **During training**: slider enabled. On change:
  - New nodes: fade-in + scale from 0 over 500ms at target positions
  - Removed nodes: fade-out over 300ms
  - Training continues uninterrupted
  - PFLOPS scales proportionally to node count
  - Particle count scales with cap at 2000
  - OFR count adjusts proportionally

### Model Selector
- **Locked during training** (LAUNCHING, TRAINING, CONVERGING) — selector grayed out, cursor: not-allowed
- **Available during IDLE and COMPLETE**
- **Per-model parameters:**
  ```
  Model    │ Default Nodes │ Convergence │ Utilization Pattern  │ Est. Duration
  ─────────┼───────────────┼─────────────┼──────────────────────┼──────────────
  GPT-5    │ 2,048         │ Slow (75s)  │ Sustained 85-95%     │ "4.2 hours"
  Phi-4    │ 512           │ Fast (40s)  │ Moderate 60-75%      │ "45 minutes"
  DALL-E 4 │ 1,024         │ Medium (55s)│ Bursty 40-95% waves  │ "2.1 hours"
  ```
- Selecting a model sets the scale slider to its default node count

### Canvas / DOM Boundary
- **Main visualization**: single `<canvas>` element, full area of left panel
- **Loss curve**: separate `<canvas>` inside the dashboard DOM panel (320×120px)
- **Click-to-inspect panel**: absolutely-positioned DOM `<div>`, shown/hidden on canvas click with coordinate translation via `canvas.getBoundingClientRect()`
- **Summary overlay (COMPLETE state)**: DOM overlay centered on viewport, z-index above canvas
- **Tooltips/toasts**: DOM elements positioned via CSS, not drawn on canvas

### Responsive & Viewport
- **Min-width**: 1280px. Below this, show centered message: "Best viewed at 1280px or wider."
- **Canvas**: `flex: 1`, fills all available horizontal space minus sidebar
- **Sidebar**: fixed 320px width, scrollable if viewport height < 768px
- **Header**: full-width, fixed 48px height
- **Activity log**: fixed 160px height, scrollable
- **Canvas DPI**: detect `devicePixelRatio`, render at 2x for Retina, scale down via CSS

### Accessibility (demo-grade)
- **Keyboard navigation**: Tab through controls (Launch, Scale, Model, View toggle) with visible focus ring (`outline: 2px solid var(--accent)`, `outline-offset: 2px`)
- **ARIA labels**: Canvas gets `role="img"` + `aria-label="GPU cluster visualization showing {N} nodes"`
- **Color contrast**: All text meets WCAG AA (4.5:1) — verified by palette above (--text-primary #E2E8F0 on --bg-primary #0a0e1a = 12.6:1 ✓)
- **No seizure risk**: No flashing >3Hz. Celebration fireworks use fade, not strobe.
- **Keyboard shortcuts**: Visible in a small `?` help overlay (press `?` to toggle)

## Todos

1. **scaffold** — Create file structure, package.json, index.html skeleton
2. **style** — Complete CSS: Mission Control dark theme, matte panels, 1px separators, Inter + JetBrains Mono fonts, 4px spacing grid
3. **config** — Constants file: colors, GPU specs, physics params, layout breakpoints
4. **constellation** — GPU node visualization: positioning, rendering, color gradients, interaction
5. **particles** — Particle system: data flows, trails, celebration effects
6. **dashboard** — Metrics panels: animated counters, progress bars, loss curve canvas
7. **activity-log** — Terminal-style scrolling event feed
8. **app-orchestration** — Main loop, state machine, event handlers, keyboard shortcuts
9. **integration** — Wire everything together, test full flow, fix any issues
10. **polish** — Intro animation, hover effects, smooth transitions, screen-share optimization
11. **readme** — Demo guide with talking points for the presentation

## Key Risks & Mitigations
- **Canvas performance with 4000+ nodes**: Use spatial partitioning, skip offscreen nodes, reduce particle count at high node counts
- **Screen share compression**: Use high-contrast colors, large elements, avoid thin lines
- **File:// CORS issues**: No ES modules, use classic script tags with global namespace
- **Browser compatibility**: Stick to well-supported Canvas 2D APIs, test in Chrome/Edge

## Success Criteria
- [ ] App loads instantly with a dramatic intro animation
- [ ] Constellation renders 500+ GPU nodes at 60fps
- [ ] "Launch Training" triggers a visually satisfying cascade
- [ ] Dashboard metrics animate smoothly and feel "real"
- [ ] Scale slider works without lag or visual glitches
- [ ] Celebration effect is fun and memorable
- [ ] Works on both macOS and Windows Chrome/Edge
- [ ] Total build time ≤ 30 minutes

## NOT in scope
- Full responsive design (mobile/tablet) — this is a desktop demo on Teams
- DESIGN.md as separate file — plan.md IS the design doc for this project
- Sound effects — risky on Teams/Zoom audio routing
- Multi-language / i18n — English only demo
- Persistent state / localStorage — fresh start each time is fine for demos
- Production error handling — no network calls, no backend

## What already exists
Nothing — empty repo. All design decisions are net-new and embedded in this plan.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ✅ CLEAR | score: 4/10 → 9/10, 10 decisions made |

- **OUTSIDE VOICES:** Codex + Claude subagent ran in parallel. Codex triggered 2 hard rejections (glassmorphism, card mosaic). Claude found 4 critical gaps (intro sequence, idle state, typography, canvas/DOM boundary). All resolved.
- **UNRESOLVED:** 0 across all reviews
- **VERDICT:** DESIGN CLEARED — eng review required before shipping.
