window.AzureAIConstellation = window.AzureAIConstellation || {};

(() => {
  const {
    ActivityLog,
    Config,
    Constellation,
    Dashboard,
    Particles
  } = window.AzureAIConstellation;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatNumber(value, digits) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  class AppController {
    constructor(doc = document) {
      this.doc = doc;
      this.appShell = doc.getElementById("app-shell");
      this.canvas = doc.getElementById("cluster-canvas");
      this.inspectCard = doc.getElementById("inspect-card");
      this.introOverlay = doc.getElementById("intro-overlay");
      this.toastStack = doc.getElementById("toast-stack");
      this.viewportWarning = doc.getElementById("viewport-warning");
      this.modelSelect = doc.getElementById("model-select");
      this.scaleSlider = doc.getElementById("scale-slider");
      this.scaleValue = doc.getElementById("scale-value");
      this.launchButton = doc.getElementById("launch-button");
      this.viewToggle = doc.getElementById("view-toggle");
      this.helpButton = doc.getElementById("help-button");
      this.infoButton = doc.getElementById("info-button");
      this.helpPanel = doc.getElementById("help-panel");
      this.infoPanel = doc.getElementById("info-panel");
      this.summaryOverlay = doc.getElementById("summary-overlay");
      this.summaryTitle = doc.getElementById("summary-title");
      this.summaryCopy = doc.getElementById("summary-copy");
      this.summaryDismiss = doc.getElementById("summary-dismiss");
      this.viewModeLabel = doc.getElementById("view-mode-label");
      this.fpsValue = doc.getElementById("fps-value");

      this.dashboard = new Dashboard(doc);
      this.activityLog = new ActivityLog(doc);
      this.particles = new Particles();
      this.renderer = new Constellation(this.canvas);

      this.modelKey = "gpt5";
      this.scaleIndex = Config.MODELS[this.modelKey].defaultScaleIndex;
      this.state = Config.STATES.booting;
      this.stateStartedAt = performance.now();
      this.trainingStartedAt = 0;
      this.bootStartedAt = this.stateStartedAt;
      this.lastFrameAt = this.stateStartedAt;
      this.lastProgress = 0;
      this.lastAutoLogAt = 0;
      this.averageFps = 60;
      this.triggeredMilestones = new Set();
      this.lossHistory = [];
      this.metrics = this.buildEmptyMetrics();
      this.peakPflops = 0;
      this.finalLoss = 0;
      this.heroDelta = "Standby";
      this.inspectSelection = null;
      this.completeOverlayShown = false;
      this.isPaused = false;
      this.pausedAt = 0;

      this.activityLog.seedInitial();
      this.modelSelect.value = this.modelKey;
      this.scaleSlider.value = String(this.scaleIndex);
      this.scaleValue.textContent = Config.formatScaleLabel(this.scaleIndex);
      this.renderer.setModel(this.modelKey);
      this.renderer.setNodeCount(Config.getScaleValue(this.scaleIndex), this.stateStartedAt, true);
      this.bindEvents();
      this.updateViewportGuard();
      window.addEventListener("resize", () => this.updateViewportGuard());
      requestAnimationFrame((timestamp) => this.frame(timestamp));
    }

    buildEmptyMetrics() {
      const nodeCount = Config.getScaleValue(this.scaleIndex);
      const baseOfr = Math.max(8, Math.round(nodeCount * Config.SIMULATION.baseOfrRatio));
      return {
        pflops: 0,
        loss: 0,
        nodesOnline: nodeCount,
        nodesTotal: nodeCount + baseOfr,
        ofr: baseOfr,
        baseOfr,
        uptime: 99.3,
        utilization: 0,
        memoryUsedTb: 0,
        memoryTotalTb: (nodeCount * 48) / 1024,
        powerMw: 0,
        ibTbps: 0
      };
    }

    bindEvents() {
      this.launchButton.addEventListener("click", () => this.toggleRun());
      this.viewToggle.addEventListener("click", () => this.toggleView());
      this.helpButton.addEventListener("click", () => this.toggleOverlay(this.helpPanel));
      this.infoButton.addEventListener("click", () => this.toggleOverlay(this.infoPanel));
      this.summaryDismiss.addEventListener("click", () => this.hideSummary());

      this.doc.getElementById("close-help").addEventListener("click", () => this.helpPanel.hidden = true);
      this.doc.getElementById("close-info").addEventListener("click", () => this.infoPanel.hidden = true);

      this.modelSelect.addEventListener("change", () => {
        if (this.modelSelect.disabled) {
          return;
        }

        this.modelKey = this.modelSelect.value;
        this.scaleIndex = Config.MODELS[this.modelKey].defaultScaleIndex;
        this.scaleSlider.value = String(this.scaleIndex);
        this.scaleValue.textContent = Config.formatScaleLabel(this.scaleIndex);
        this.resetToIdle(false);
        this.activityLog.append(
          `${Config.MODELS[this.modelKey].label} selected. Preparing ${Config.GPU_PROFILES[Config.MODELS[this.modelKey].gpuProfile].label} lanes.`,
          "info"
        );
      });

      this.scaleSlider.addEventListener("input", () => {
        this.scaleIndex = Number(this.scaleSlider.value);
        this.scaleValue.textContent = Config.formatScaleLabel(this.scaleIndex);
      });

      this.scaleSlider.addEventListener("change", () => {
        const now = performance.now();
        this.applyScaleChange(now);
      });

      this.canvas.addEventListener("click", (event) => this.handleCanvasClick(event));

      this.doc.addEventListener("click", (event) => {
        if (
          !event.target.closest(".overlay-panel__card") &&
          !event.target.closest("#help-button") &&
          !event.target.closest("#info-button")
        ) {
          if (event.target === this.helpPanel) {
            this.helpPanel.hidden = true;
          }
          if (event.target === this.infoPanel) {
            this.infoPanel.hidden = true;
          }
        }

        if (!event.target.closest("#cluster-canvas") && !event.target.closest("#inspect-card")) {
          this.hideInspectCard();
        }
      });

      window.addEventListener("keydown", (event) => this.handleKeydown(event));
    }

    handleKeydown(event) {
      if (event.target.matches("input, select")) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.key === " ") {
        event.preventDefault();
        this.toggleRun();
      } else if (key === "v") {
        this.toggleView();
      } else if (key === "c") {
        this.triggerCelebration(true);
      } else if (key === "r") {
        this.resetToIdle(false);
      } else if (event.key === "+" || event.key === "=") {
        this.bumpScale(1);
      } else if (event.key === "-") {
        this.bumpScale(-1);
      } else if (event.key === "?") {
        event.preventDefault();
        this.toggleOverlay(this.helpPanel);
      }
    }

    frame(timestamp) {
      const deltaMs = Math.min(48, timestamp - this.lastFrameAt || 16.67);
      this.lastFrameAt = timestamp;
      this.averageFps = this.averageFps * 0.9 + (1000 / Math.max(1, deltaMs)) * 0.1;
      this.updateSimulation(timestamp, deltaMs);
      requestAnimationFrame((next) => this.frame(next));
    }

    getSimulationNow(now) {
      return this.isPaused ? this.pausedAt : now;
    }

    updateSimulation(now, deltaMs) {
      this.updateViewportGuard();
      const simulationNow = this.getSimulationNow(now);

      if (this.state === Config.STATES.booting && simulationNow - this.bootStartedAt >= Config.TIMINGS.introMs) {
        this.state = Config.STATES.idle;
        this.stateStartedAt = simulationNow;
        this.introOverlay.classList.add("is-fading");
        window.setTimeout(() => {
          this.introOverlay.hidden = true;
          this.introOverlay.classList.remove("is-fading");
        }, 420);
        this.activityLog.append("Cluster online. 2,112 nodes ready for launch.", "success");
      }

      if (!this.isPaused) {
        this.advanceState(simulationNow);
      }

      const snapshot = this.buildSnapshot(simulationNow);
      this.renderer.update(simulationNow, snapshot);
      this.processRecoveryEvents();
      this.processMilestones(simulationNow);
      this.particles.update(deltaMs, snapshot, () => this.renderer.sampleFlowPair(snapshot));
      this.renderer.draw(snapshot, this.particles);
      this.dashboard.update(snapshot);
      this.renderInspectCard();
      this.refreshUi(snapshot);
      this.maybeAutoLog(simulationNow, snapshot);
    }

    advanceState(now) {
      if (this.state === Config.STATES.launching) {
        if (now - this.stateStartedAt >= Config.TIMINGS.launchingMs) {
          this.state = Config.STATES.training;
          this.stateStartedAt = now;
          this.trainingStartedAt = now;
          this.activityLog.setFocus("metrics");
          this.activityLog.append("Launch complete. Metrics rail taking primary focus.", "success");
        }
        return;
      }

      if (this.state === Config.STATES.training || this.state === Config.STATES.converging) {
        const progress = this.computeTrainingProgress(now);
        if (this.state === Config.STATES.training && progress >= Config.MODELS[this.modelKey].convergenceStart) {
          this.state = Config.STATES.converging;
          this.stateStartedAt = now;
        }
        if (progress >= 1) {
          this.completeRun(now);
        }
      }
    }

    computeTrainingProgress(now) {
      if (!this.trainingStartedAt) {
        return 0;
      }
      return clamp(
        (now - this.trainingStartedAt) /
          (Config.MODELS[this.modelKey].totalDurationSec * 1000),
        0,
        1
      );
    }

    buildSnapshot(now) {
      const model = Config.MODELS[this.modelKey];
      const gpu = Config.GPU_PROFILES[model.gpuProfile];
      const nodeCount = Config.getScaleValue(this.scaleIndex);
      const baseOfr = Math.max(8, Math.round(nodeCount * Config.SIMULATION.baseOfrRatio));
      const failedCount = this.renderer.getFailedCount(now);
      const stateElapsed = now - this.stateStartedAt;
      const progress = this.state === Config.STATES.launching ? 0 : this.computeTrainingProgress(now);
      const utilization = this.computeUtilization(now, progress, failedCount);
      const memoryTotalTb = (nodeCount * 48) / 1024;
      const memoryUsedTb = memoryTotalTb * clamp(model.memoryLoad + (utilization - 0.5) * 0.18, 0.05, 0.92);
      const pflops =
        (nodeCount - failedCount) *
        gpu.petaFlops *
        clamp(utilization * 1.08, 0, 1.25);
      const powerMw =
        ((nodeCount - failedCount) *
          gpu.tdpKw *
          clamp(utilization, 0, 1) *
          Config.SIMULATION.coolingOverheadRatio) /
        1000;
      const ibTbps =
        model.networkTbpsPer1024 *
        (nodeCount / 1024) *
        clamp(0.52 + utilization * 0.75, 0.18, 1.45);
      const uptime = clamp(
        99.92 - Config.SIMULATION.baseOfrRatio * 20 - failedCount * 0.18,
        97.3,
        99.99
      );
      const loss = this.computeLoss(progress, failedCount);

      if (this.state !== Config.STATES.idle && this.state !== Config.STATES.booting && !this.isPaused) {
        if (!this.lossHistory.length || Math.abs(loss - this.lossHistory[this.lossHistory.length - 1]) > 0.0001) {
          this.lossHistory.push(loss);
        }
      }
      while (this.lossHistory.length > Config.SIMULATION.maxTrackedLossPoints) {
        this.lossHistory.shift();
      }

      const metrics = {
        pflops,
        loss,
        nodesOnline: nodeCount - failedCount,
        nodesTotal: nodeCount + baseOfr,
        ofr: baseOfr + failedCount,
        baseOfr,
        uptime,
        utilization,
        memoryUsedTb,
        memoryTotalTb,
        powerMw,
        ibTbps
      };

      const stateDescriptionByState = {
        [Config.STATES.booting]: "Bringing the mission-control display online.",
        [Config.STATES.idle]: "Standing by for the next AI training launch window.",
        [Config.STATES.launching]: "Activating racks, warming up fabric, and scheduling the run.",
        [Config.STATES.training]: "Training is live. PFLOPS and loss are now the primary readouts.",
        [Config.STATES.converging]: "Loss is flattening and the cluster is entering the convergence envelope.",
        [Config.STATES.complete]: "Training complete. Summary overlay available and reset is armed."
      };

      const heroDelta =
        this.state === Config.STATES.idle || this.state === Config.STATES.booting
          ? "Standby"
          : `${pflops >= this.metrics.pflops ? "▲" : "▼"} ${formatNumber(
              Math.abs(((pflops - this.metrics.pflops) / Math.max(1, this.metrics.pflops)) * 100),
              1
            )}% from last step`;

      this.metrics = metrics;
      this.peakPflops = Math.max(this.peakPflops, metrics.pflops);
      this.finalLoss = metrics.loss;
      this.heroDelta = heroDelta;
      this.lastProgress = progress;

      return {
        now,
        state: this.isPaused ? Config.STATES.paused : this.state,
        phaseLabel: this.getPhaseLabel(),
        stateDescription: this.isPaused ? "Training paused. Press space to resume." : stateDescriptionByState[this.state],
        stateElapsed,
        progress,
        heroDelta,
        metrics,
        lossHistory: this.lossHistory.slice(),
        ofrBadge: metrics.ofr > metrics.baseOfr ? "OFR elevated" : "OFR nominal",
        focus: this.state === Config.STATES.launching ? "log" : "metrics",
        flowIntensity: this.computeFlowIntensity(utilization),
        motionPriority: this.viewToggle.dataset.transitioning === "true" ? 1 : this.state === Config.STATES.launching ? 1 : 4
      };
    }

    computeUtilization(now, progress, failedCount) {
      const model = Config.MODELS[this.modelKey];
      const wave = Math.sin(now * 0.0009) * model.utilizationSwing;
      const longWave = Math.sin(now * 0.00023 + 0.8) * (model.utilizationSwing * 0.45);
      const failurePenalty = failedCount * 0.018;

      if (this.state === Config.STATES.booting || this.state === Config.STATES.idle) {
        return 0;
      }
      if (this.state === Config.STATES.launching) {
        return clamp(
          (now - this.stateStartedAt) / Config.TIMINGS.launchingMs * (model.utilizationBase * 0.88),
          0,
          model.utilizationBase
        );
      }
      if (this.state === Config.STATES.converging) {
        return clamp(0.62 + wave * 0.35 - failurePenalty, 0.45, 0.88);
      }
      if (this.state === Config.STATES.complete) {
        return 0.14;
      }

      return clamp(model.utilizationBase + wave + longWave - failurePenalty + progress * 0.03, 0.38, 0.98);
    }

    computeLoss(progress, failedCount) {
      const lossFloorByModel = {
        gpt5: 0.031,
        phi4: 0.047,
        dalle4: 0.062
      };
      const startLossByModel = {
        gpt5: 5.8,
        phi4: 3.7,
        dalle4: 4.6
      };
      const floor = lossFloorByModel[this.modelKey];
      const startLoss = startLossByModel[this.modelKey];
      const stableProgress = clamp(progress, 0, 1);
      const failurePenalty = failedCount * 0.015;
      const oscillation = Math.sin(stableProgress * Math.PI * 9) * 0.02;
      return floor + (startLoss - floor) * Math.pow(1 - stableProgress, 3.4) + oscillation + failurePenalty;
    }

    computeFlowIntensity(utilization) {
      if (this.state === Config.STATES.launching) {
        return 0.55;
      }
      if (this.state === Config.STATES.converging) {
        return 0.72;
      }
      if (this.state === Config.STATES.complete || this.state === Config.STATES.idle || this.state === Config.STATES.booting) {
        return 0.12;
      }
      return clamp(utilization * 1.12, 0.3, 1.6);
    }

    getPhaseLabel() {
      if (this.isPaused) {
        return "Paused";
      }
      const labels = {
        [Config.STATES.booting]: "Booting",
        [Config.STATES.idle]: "Idle",
        [Config.STATES.launching]: "Launching",
        [Config.STATES.training]: "Training",
        [Config.STATES.converging]: "Converging",
        [Config.STATES.complete]: "Complete"
      };
      return labels[this.state];
    }

    processMilestones(now) {
      if (this.isPaused) {
        return;
      }

      if (this.state !== Config.STATES.training && this.state !== Config.STATES.converging) {
        return;
      }

      const progress = this.computeTrainingProgress(now);
      Config.MILESTONES.forEach((milestone) => {
        if (!this.triggeredMilestones.has(milestone.key) && progress >= milestone.progress) {
          this.triggeredMilestones.add(milestone.key);
          this.handleMilestone(milestone, now);
        }
      });
    }

    handleMilestone(milestone, now) {
      this.showToast(milestone.toast, milestone.emphasis);
      this.activityLog.append(milestone.log, milestone.emphasis === "alert" ? "warn" : "success");

      switch (milestone.effect) {
        case "flowSync":
          this.renderer.triggerGlobalFlash(now, Config.COLORS.accent);
          this.particles.setFlowBoost(now + 1200, 2.1);
          break;
        case "checkpoint":
          this.renderer.triggerGlobalFlash(now, Config.COLORS.accent);
          this.particles.triggerCheckpoint(this.renderer.getRenderableNodes());
          break;
        case "throughputBurst":
          this.particles.setFlowBoost(now + 1400, 1.75);
          break;
        case "failure": {
          const node = this.renderer.failRandomNode(now);
          if (node) {
            this.particles.triggerFailure(node);
            this.activityLog.append(`${node.id} transitioned to OFR. Traffic rerouted to healthy neighbors.`, "warn");
          }
          break;
        }
        case "epochComplete":
          this.renderer.triggerGlobalFlash(now, Config.COLORS.success);
          this.particles.triggerCheckpoint(this.renderer.getRenderableNodes().slice(0, 12));
          break;
        case "fabricSpike":
          this.particles.setFlowBoost(now + 3000, 2.4);
          break;
        case "converging":
          this.state = Config.STATES.converging;
          this.stateStartedAt = now;
          break;
        case "complete":
          this.completeRun(now);
          break;
        default:
          break;
      }
    }

    processRecoveryEvents() {
      const recovered = this.renderer.consumeRecoveredNodes();
      recovered.forEach((node) => {
        this.particles.triggerRecovery(node);
        this.activityLog.append(`${node.id} recovered and rejoined the training mesh.`, "success");
      });
    }

    refreshUi(snapshot) {
      this.appShell.dataset.state = this.isPaused ? Config.STATES.paused : this.state;
      this.appShell.dataset.focus = snapshot.focus;
      this.appShell.dataset.view = this.renderer.viewMode;
      this.scaleValue.textContent = Config.formatScaleLabel(this.scaleIndex);
      this.viewModeLabel.textContent =
        this.renderer.viewMode === Config.VIEW_MODES.rack ? "Rack topology" : "Constellation mode";
      this.viewToggle.textContent =
        this.renderer.viewMode === Config.VIEW_MODES.rack ? "Constellation mode" : "Rack topology";
      this.viewToggle.setAttribute(
        "aria-pressed",
        String(this.renderer.viewMode === Config.VIEW_MODES.rack)
      );
      this.viewToggle.dataset.transitioning = String(Boolean(this.renderer.viewTransition));

      this.fpsValue.textContent = `${Math.round(this.averageFps).toLocaleString()} FPS`;
      this.canvas.setAttribute(
        "aria-label",
        `GPU cluster visualization showing ${Config.getScaleValue(this.scaleIndex).toLocaleString()} nodes`
      );

      if (this.isPaused) {
        this.launchButton.textContent = "Resume training";
      } else if (this.state === Config.STATES.idle || this.state === Config.STATES.booting) {
        this.launchButton.textContent = "Launch training";
      } else if (this.state === Config.STATES.complete) {
        this.launchButton.textContent = "Reset run";
      } else {
        this.launchButton.textContent = "Pause run";
      }

      this.modelSelect.disabled = !(this.state === Config.STATES.idle || this.state === Config.STATES.complete);
      this.scaleSlider.disabled = this.state === Config.STATES.launching;
      this.viewToggle.disabled = this.state === Config.STATES.launching;

      this.activityLog.setFocus(snapshot.focus, this.state);

      if (this.state === Config.STATES.complete && !this.completeOverlayShown && performance.now() - this.stateStartedAt > 950) {
        this.showSummary();
      }
    }

    maybeAutoLog(now, snapshot) {
      if (this.isPaused) {
        return;
      }

      const throttle =
        snapshot.focus === "log" ? Config.TIMINGS.logThrottleLaunchingMs : Config.TIMINGS.logThrottleMs;
      if (now - this.lastAutoLogAt < throttle) {
        return;
      }

      this.lastAutoLogAt = now;

      if (this.state === Config.STATES.launching) {
        this.activityLog.appendLibraryEntry("launching", "info");
      } else if (this.state === Config.STATES.training) {
        this.activityLog.appendLibraryEntry("training", "info");
      } else if (this.state === Config.STATES.converging) {
        this.activityLog.appendLibraryEntry("converging", "success");
      } else if (this.state === Config.STATES.complete) {
        this.activityLog.appendLibraryEntry("complete", "success");
      }
    }

    toggleRun() {
      const now = performance.now();
      if (this.state === Config.STATES.booting) {
        return;
      }

      if (this.state === Config.STATES.complete) {
        this.resetToIdle(false);
        return;
      }

      if (this.isPaused) {
        this.resume(now);
        return;
      }

      if (this.state === Config.STATES.idle) {
        this.startLaunch(now);
        return;
      }

      this.pause(now);
    }

    startLaunch(now) {
      this.hideSummary();
      this.hideInspectCard();
      this.triggeredMilestones.clear();
      this.lossHistory = [];
      this.state = Config.STATES.launching;
      this.stateStartedAt = now;
      this.trainingStartedAt = 0;
      this.lastAutoLogAt = 0;
      this.completeOverlayShown = false;
      this.activityLog.setFocus("log", this.state);
      this.activityLog.append(`Launching ${Config.MODELS[this.modelKey].label} across ${Config.formatScaleLabel(this.scaleIndex)}.`, "success");
      this.activityLog.append("InfiniBand mesh connected. Waiting for the cascade to reach full brightness.", "info");
    }

    pause(now) {
      this.isPaused = true;
      this.pausedAt = now;
      this.activityLog.append("Training paused. Operator requested a brief hold.", "warn");
    }

    resume(now) {
      const pauseDuration = now - this.pausedAt;
      this.isPaused = false;
      this.stateStartedAt += pauseDuration;
      if (this.trainingStartedAt) {
        this.trainingStartedAt += pauseDuration;
      }
      this.activityLog.append("Training resumed. Mission control returning to the live path.", "success");
    }

    completeRun(now) {
      if (this.state === Config.STATES.complete) {
        return;
      }
      this.hideInspectCard();
      this.state = Config.STATES.complete;
      this.stateStartedAt = now;
      this.triggerCelebration(false);
      this.activityLog.append("Final checkpoint sealed. Summary overlay armed.", "success");
    }

    triggerCelebration(manual) {
      this.particles.triggerCelebration(this.renderer.getRenderableNodes());
      this.renderer.triggerGlobalFlash(performance.now(), Config.COLORS.success);
      if (manual) {
        this.activityLog.append("Celebration pulse triggered manually from mission control.", "success");
      }
    }

    toggleView() {
      if (this.viewToggle.disabled) {
        return;
      }
      const now = performance.now();
      const nextView =
        this.renderer.viewMode === Config.VIEW_MODES.constellation
          ? Config.VIEW_MODES.rack
          : Config.VIEW_MODES.constellation;
      this.renderer.setViewMode(nextView, now);
      this.activityLog.append(
        nextView === Config.VIEW_MODES.rack
          ? "Morphing into rack topology for operational inspection."
          : "Returning to constellation mode for the high-level cluster story.",
        "info"
      );
    }

    bumpScale(direction) {
      if (this.scaleSlider.disabled) {
        return;
      }
      const next = clamp(this.scaleIndex + direction, 0, Config.SCALE_STEPS.length - 1);
      if (next === this.scaleIndex) {
        return;
      }
      this.scaleIndex = next;
      this.scaleSlider.value = String(next);
      this.applyScaleChange(performance.now());
    }

    applyScaleChange(now) {
      const nodeCount = Config.getScaleValue(this.scaleIndex);
      this.renderer.setNodeCount(nodeCount, now);
      this.hideInspectCard();
      this.activityLog.append(
        `Cluster scale adjusted to ${nodeCount.toLocaleString()} GPUs while preserving run state.`,
        "info"
      );
      if (this.state === Config.STATES.training || this.state === Config.STATES.converging) {
        this.particles.setFlowBoost(now + 900, 1.6);
      }
    }

    resetToIdle(replayIntro) {
      const now = performance.now();
      this.isPaused = false;
      this.pausedAt = 0;
      this.modelSelect.value = this.modelKey;
      this.renderer.setModel(this.modelKey);
      this.renderer.setNodeCount(Config.getScaleValue(this.scaleIndex), now, true);
      this.renderer.setViewMode(Config.VIEW_MODES.constellation, now);
      this.lossHistory = [];
      this.triggeredMilestones.clear();
      this.completeOverlayShown = false;
      this.hideSummary();
      this.hideInspectCard();
      this.state = replayIntro ? Config.STATES.booting : Config.STATES.idle;
      this.stateStartedAt = now;
      this.bootStartedAt = now;
      this.trainingStartedAt = 0;
      this.lastAutoLogAt = 0;
      this.metrics = this.buildEmptyMetrics();
      this.peakPflops = 0;
      this.finalLoss = 0;
      this.dashboard.update(this.buildSnapshot(now));
      this.activityLog.append("Run reset. Mission control returned to idle glow.", "info");
      if (replayIntro) {
        this.introOverlay.hidden = false;
      }
    }

    handleCanvasClick(event) {
      const hit = this.renderer.pickNode(event.clientX, event.clientY);
      if (!hit) {
        this.hideInspectCard();
        return;
      }

      const model = Config.MODELS[this.modelKey];
      const gpu = Config.GPU_PROFILES[model.gpuProfile];
      const temperature = Math.round(58 + hit.node.renderUtilization * 31 + hit.node.thermalBias * 25);
      this.inspectSelection = {
        x: hit.x,
        y: hit.y,
        title: hit.node.id,
        details: [
          `Rack R${hit.node.rackIndex + 1}`,
          gpu.label,
          `${gpu.memoryGb} GB HBM`,
          `Util ${Math.round(hit.node.renderUtilization * 100)}%`,
          `Temp ${temperature}°C`,
          hit.node.failureUntil > performance.now() ? "Status OFR" : "Status healthy"
        ]
      };
    }

    renderInspectCard() {
      if (!this.inspectSelection) {
        this.hideInspectCard();
        return;
      }

      this.inspectCard.hidden = false;
      this.inspectCard.innerHTML = `
        <strong>${this.inspectSelection.title}</strong>
        ${this.inspectSelection.details.map((detail) => `<div>${detail}</div>`).join("")}
      `;

      const frameRect = this.canvas.getBoundingClientRect();
      const cardWidth = 240;
      const cardHeight = 148;
      const left = clamp(this.inspectSelection.x + 18, 12, frameRect.width - cardWidth - 12);
      const top = clamp(this.inspectSelection.y + 18, 12, frameRect.height - cardHeight - 12);
      this.inspectCard.style.left = `${left}px`;
      this.inspectCard.style.top = `${top}px`;
    }

    hideInspectCard() {
      this.inspectSelection = null;
      this.inspectCard.hidden = true;
    }

    showToast(message, emphasis = "accent") {
      const toast = this.doc.createElement("div");
      toast.className = "toast";
      toast.dataset.emphasis = emphasis;
      toast.textContent = message;
      this.toastStack.appendChild(toast);
      window.setTimeout(() => {
        toast.classList.add("is-fading");
        window.setTimeout(() => toast.remove(), 220);
      }, Config.TIMINGS.toastMs);
    }

    showSummary() {
      const model = Config.MODELS[this.modelKey];
      this.summaryTitle.textContent = `${model.label} training complete`;
      this.summaryCopy.textContent =
        `${Config.getScaleValue(this.scaleIndex).toLocaleString()} ${Config.GPU_PROFILES[model.gpuProfile].label}s • ` +
        `${formatNumber(this.peakPflops, 1)} PFLOPS peak • ` +
        `final loss ${formatNumber(this.finalLoss, 4)} • ${model.displayDuration} simulated wall clock.`;
      this.summaryOverlay.hidden = false;
      this.completeOverlayShown = true;
      window.setTimeout(() => {
        if (this.state === Config.STATES.complete) {
          this.summaryOverlay.hidden = true;
        }
      }, Config.TIMINGS.summaryDismissMs);
    }

    hideSummary() {
      this.summaryOverlay.hidden = true;
    }

    toggleOverlay(panel) {
      panel.hidden = !panel.hidden;
    }

    updateViewportGuard() {
      const tooSmall = window.innerWidth < Config.LAYOUT.minViewportWidth;
      this.viewportWarning.hidden = !tooSmall;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.AzureAIConstellation.app = new AppController();
  });
})();
