window.AzureAIConstellation = window.AzureAIConstellation || {};

window.AzureAIConstellation.Config = (() => {
  const SCALE_STEPS = [256, 512, 1024, 2048, 4096];

  const COLORS = {
    bgVoid: "#060a14",
    bgPrimary: "#0a0e1a",
    bgElevated: "#0f1629",
    bgOverlay: "rgba(6, 10, 20, 0.92)",
    accent: "#0078D4",
    accentGlow: "rgba(0, 120, 212, 0.25)",
    alert: "#F59E0B",
    success: "#10B981",
    danger: "#EF4444",
    textPrimary: "#E2E8F0",
    textMuted: "#64748B",
    textBright: "#FFFFFF",
    nodeIdle: "#1E3A5F",
    nodeActive: "#0078D4",
    nodeHot: "#F97316",
    nodeCritical: "#EF4444",
    nodeConverged: "#10B981",
    nodeOfr: "#374151",
    border: "rgba(255, 255, 255, 0.06)",
    borderFocus: "rgba(0, 120, 212, 0.4)",
    grid: "rgba(255, 255, 255, 0.05)",
    gridStrong: "rgba(255, 255, 255, 0.12)"
  };

  const FONTS = {
    ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', 'Roboto Mono', monospace"
  };

  const TIMINGS = {
    introMs: 2000,
    launchingMs: 5000,
    morphMs: 800,
    focusFadeMs: 400,
    nodePulseMs: 2000,
    summaryDismissMs: 8000,
    toastMs: 2800,
    inspectFadeMs: 160,
    logThrottleMs: 5000,
    logThrottleLaunchingMs: 900,
    failureFlashMs: 220,
    failureRecoveryMinMs: 10000,
    failureRecoveryMaxMs: 15000,
    celebrationMs: 3000
  };

  const GPU_PROFILES = {
    b200: {
      label: "NVIDIA B200",
      memoryGb: 192,
      tdpKw: 1.82,
      petaFlops: 0.62,
      glowRadius: 12
    },
    h100: {
      label: "NVIDIA H100",
      memoryGb: 120,
      tdpKw: 1.34,
      petaFlops: 0.36,
      glowRadius: 10
    }
  };

  const MODELS = {
    gpt5: {
      key: "gpt5",
      label: "GPT-5",
      gpuProfile: "b200",
      defaultScaleIndex: 3,
      totalDurationSec: 75,
      convergenceStart: 0.86,
      utilizationBase: 0.9,
      utilizationSwing: 0.08,
      memoryLoad: 0.82,
      networkTbpsPer1024: 9.2,
      displayDuration: "4.2 hours",
      trainingObjective: "Next-token pretraining",
      modelSize: "8T active parameters"
    },
    phi4: {
      key: "phi4",
      label: "Phi-4",
      gpuProfile: "h100",
      defaultScaleIndex: 1,
      totalDurationSec: 40,
      convergenceStart: 0.8,
      utilizationBase: 0.69,
      utilizationSwing: 0.1,
      memoryLoad: 0.58,
      networkTbpsPer1024: 5.1,
      displayDuration: "45 minutes",
      trainingObjective: "Fine-tuning and evaluation",
      modelSize: "14B dense parameters"
    },
    dalle4: {
      key: "dalle4",
      label: "DALL-E 4",
      gpuProfile: "h100",
      defaultScaleIndex: 2,
      totalDurationSec: 55,
      convergenceStart: 0.83,
      utilizationBase: 0.76,
      utilizationSwing: 0.16,
      memoryLoad: 0.66,
      networkTbpsPer1024: 6.7,
      displayDuration: "2.1 hours",
      trainingObjective: "Diffusion multimodal training",
      modelSize: "3.2B multimodal parameters"
    }
  };

  const MILESTONES = [
    {
      key: "gradient-sync",
      progress: 0.07,
      toast: "First gradient sync",
      log: "Gradient all-reduce synchronized across the spine network.",
      emphasis: "accent",
      effect: "flowSync"
    },
    {
      key: "checkpoint-100k",
      progress: 0.2,
      toast: "Checkpoint saved — step 100K",
      log: "Checkpoint persisted to Azure Blob scratch for rapid restore.",
      emphasis: "success",
      effect: "checkpoint"
    },
    {
      key: "pflops-threshold",
      progress: 0.33,
      toast: "1,000 PFLOPS sustained",
      log: "Sustained PFLOPS milestone reached without saturating IB fabric.",
      emphasis: "accent",
      effect: "throughputBurst"
    },
    {
      key: "planned-failure",
      progress: 0.46,
      toast: "Node health event detected",
      log: "Telemetry anomaly detected. Rerouting gradients around an OFR rack slot.",
      emphasis: "alert",
      effect: "failure"
    },
    {
      key: "epoch-complete",
      progress: 0.6,
      toast: "Epoch 1 complete",
      log: "Epoch boundary crossed. Optimizer state snapped for rollback safety.",
      emphasis: "success",
      effect: "epochComplete"
    },
    {
      key: "fabric-spike",
      progress: 0.73,
      toast: "Communication-heavy phase",
      log: "Collective communication density doubled for parameter sharding alignment.",
      emphasis: "accent",
      effect: "fabricSpike"
    },
    {
      key: "convergence",
      progress: 0.88,
      toast: "Convergence detected",
      log: "Loss slope flattened into the target convergence envelope.",
      emphasis: "success",
      effect: "converging"
    },
    {
      key: "complete",
      progress: 1,
      toast: "Training complete",
      log: "Final checkpoint sealed. Mission control returning the cluster to idle glow.",
      emphasis: "success",
      effect: "complete"
    }
  ];

  const LOG_LIBRARY = {
    idle: [
      "Cluster ready. Mission control is holding 60 FPS headroom in reserve.",
      "2,112 physical slots discovered. Spare capacity standing by for recovery.",
      "Telemetry streams green across the Azure HPC fabric."
    ],
    launching: [
      "Allocating GPU partitions across the active racks.",
      "Warming up NVLink domains and InfiniBand routes.",
      "Pinning data shards to local memory for a hot start.",
      "Locking scheduler lanes for an uninterrupted launch window."
    ],
    training: [
      "Gradient synchronization clean across all participating nodes.",
      "Dataset shards rotating without starving the pipeline.",
      "Thermal headroom stable. No throttling observed.",
      "Checkpoint delta flushed. Recovery path remains green.",
      "Fabric utilization elevated but within the golden envelope."
    ],
    converging: [
      "Optimizer noise tapering. Cluster entering a calm, high-confidence loop.",
      "PFLOPS settling as the loss surface flattens.",
      "Validation deltas holding inside the desired band."
    ],
    complete: [
      "Run archived. Operators can relaunch immediately or inspect the completed pass."
    ],
    failure: [
      "OFR event registered. Neighboring nodes absorbing the redistributed load.",
      "Failure domain isolated. Fabric route recomputed in milliseconds."
    ],
    recovery: [
      "Recovered node rejoined the mesh and resumed steady-state participation.",
      "Repair window closed. Capacity restored with no operator intervention."
    ]
  };

  const TOAST_ACCENTS = {
    accent: COLORS.accent,
    success: COLORS.success,
    alert: COLORS.alert
  };

  const LAYOUT = {
    sidebarWidth: 320,
    activityHeight: 160,
    minViewportWidth: 1280,
    minCanvasHeight: 420,
    rackColumns: 8,
    constellationRadiusFactor: 0.34
  };

  const SIMULATION = {
    baseOfrRatio: 0.03125,
    maxParticlePool: 2600,
    maxCelebrationBursts: 48,
    maxTrackedLossPoints: 180,
    recoveryLoadBoost: 0.03,
    baseUptime: 99.96,
    failureUptimePenalty: 0.24,
    memoryHeadroomRatio: 0.92,
    coolingOverheadRatio: 1.12
  };

  const VIEW_MODES = {
    constellation: "constellation",
    rack: "rack"
  };

  const STATES = {
    booting: "booting",
    idle: "idle",
    launching: "launching",
    training: "training",
    converging: "converging",
    complete: "complete",
    paused: "paused"
  };

  function getScaleValue(scaleIndex) {
    return SCALE_STEPS[Math.max(0, Math.min(SCALE_STEPS.length - 1, Number(scaleIndex) || 0))];
  }

  function formatScaleLabel(scaleIndex) {
    return `${getScaleValue(scaleIndex).toLocaleString()} GPUs`;
  }

  return {
    COLORS,
    FONTS,
    GPU_PROFILES,
    LAYOUT,
    LOG_LIBRARY,
    MILESTONES,
    MODELS,
    SCALE_STEPS,
    SIMULATION,
    STATES,
    TIMINGS,
    TOAST_ACCENTS,
    VIEW_MODES,
    formatScaleLabel,
    getScaleValue
  };
})();
