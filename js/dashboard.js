window.AzureAIConstellation = window.AzureAIConstellation || {};

window.AzureAIConstellation.Dashboard = (() => {
  const { Config } = window.AzureAIConstellation;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function formatNumber(value, digits) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  class DashboardController {
    constructor(doc = document) {
      this.doc = doc;
      this.lossCanvas = doc.getElementById("loss-canvas");
      this.lossContext = this.lossCanvas.getContext("2d");
      this.heroValue = doc.getElementById("pflops-value");
      this.heroDelta = doc.getElementById("pflops-delta");
      this.trainingPhase = doc.getElementById("training-phase");
      this.progressFill = doc.getElementById("progress-fill");
      this.progressValue = doc.getElementById("progress-value");
      this.lossValue = doc.getElementById("loss-value");
      this.nodesValue = doc.getElementById("nodes-value");
      this.ofrValue = doc.getElementById("ofr-value");
      this.ofrBadge = doc.getElementById("ofr-badge");
      this.uptimeValue = doc.getElementById("uptime-value");
      this.utilizationValue = doc.getElementById("utilization-value");
      this.memoryValue = doc.getElementById("memory-value");
      this.powerValue = doc.getElementById("power-value");
      this.ibValue = doc.getElementById("ib-value");
      this.statePill = doc.getElementById("state-pill");
      this.stateDescription = doc.getElementById("state-description");

      this.displayed = {
        pflops: 0,
        progress: 0,
        loss: 0,
        nodesOnline: 0,
        nodesTotal: 0,
        ofr: 0,
        uptime: Config.SIMULATION.baseUptime,
        utilization: 0,
        memoryUsedTb: 0,
        memoryTotalTb: 0,
        powerMw: 0,
        ibTbps: 0
      };

      this.resizeLossCanvas();
      window.addEventListener("resize", () => this.resizeLossCanvas());
    }

    resizeLossCanvas() {
      const rect = this.lossCanvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      this.lossCanvas.width = Math.max(320, Math.round(rect.width * ratio));
      this.lossCanvas.height = Math.max(120, Math.round(rect.height * ratio));
      this.lossContext.setTransform(1, 0, 0, 1, 0, 0);
      this.lossContext.scale(ratio, ratio);
    }

    update(snapshot) {
      const smoothing = snapshot.state === Config.STATES.launching ? 0.18 : 0.12;
      this.displayed.pflops = lerp(this.displayed.pflops, snapshot.metrics.pflops, smoothing);
      this.displayed.progress = lerp(this.displayed.progress, snapshot.progress, 0.18);
      this.displayed.loss = lerp(this.displayed.loss, snapshot.metrics.loss, 0.14);
      this.displayed.nodesOnline = lerp(this.displayed.nodesOnline, snapshot.metrics.nodesOnline, 0.18);
      this.displayed.nodesTotal = lerp(this.displayed.nodesTotal, snapshot.metrics.nodesTotal, 0.18);
      this.displayed.ofr = lerp(this.displayed.ofr, snapshot.metrics.ofr, 0.18);
      this.displayed.uptime = lerp(this.displayed.uptime, snapshot.metrics.uptime, 0.12);
      this.displayed.utilization = lerp(this.displayed.utilization, snapshot.metrics.utilization, 0.12);
      this.displayed.memoryUsedTb = lerp(this.displayed.memoryUsedTb, snapshot.metrics.memoryUsedTb, 0.12);
      this.displayed.memoryTotalTb = lerp(this.displayed.memoryTotalTb, snapshot.metrics.memoryTotalTb, 0.12);
      this.displayed.powerMw = lerp(this.displayed.powerMw, snapshot.metrics.powerMw, 0.12);
      this.displayed.ibTbps = lerp(this.displayed.ibTbps, snapshot.metrics.ibTbps, 0.12);

      this.heroValue.textContent = formatNumber(this.displayed.pflops, 1);
      this.heroDelta.textContent = snapshot.heroDelta;
      this.trainingPhase.textContent = snapshot.phaseLabel;
      this.progressFill.style.width = `${clamp(this.displayed.progress * 100, 0, 100)}%`;
      this.progressValue.textContent = `${formatNumber(this.displayed.progress * 100, 1)}%`;
      this.lossValue.textContent =
        snapshot.state === Config.STATES.idle ? "Loss —" : `Loss ${formatNumber(this.displayed.loss, 4)}`;
      this.nodesValue.textContent =
        `${Math.round(this.displayed.nodesOnline).toLocaleString()} / ${Math.round(this.displayed.nodesTotal).toLocaleString()}`;
      this.ofrValue.textContent = Math.round(this.displayed.ofr).toLocaleString();
      this.uptimeValue.textContent = `${formatNumber(this.displayed.uptime, 2)}%`;
      this.utilizationValue.textContent = `${formatNumber(this.displayed.utilization * 100, 0)}%`;
      this.memoryValue.textContent =
        `${formatNumber(this.displayed.memoryUsedTb, 1)} / ${formatNumber(this.displayed.memoryTotalTb, 1)} TB`;
      this.powerValue.textContent = `${formatNumber(this.displayed.powerMw, 1)} MW`;
      this.ibValue.textContent = `${formatNumber(this.displayed.ibTbps, 1)} Tb/s`;
      this.ofrBadge.textContent = snapshot.ofrBadge;
      this.ofrBadge.classList.toggle("panel__badge--alert", snapshot.metrics.ofr > snapshot.metrics.baseOfr);

      this.statePill.textContent = snapshot.state.toUpperCase();
      this.stateDescription.textContent = snapshot.stateDescription;

      this.drawLossCurve(snapshot.lossHistory, snapshot.state);
    }

    drawLossCurve(lossHistory, state) {
      const ctx = this.lossContext;
      const rect = this.lossCanvas.getBoundingClientRect();
      const width = rect.width || 320;
      const height = rect.height || 120;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255,255,255,0.015)";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = Config.COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let line = 1; line < 4; line += 1) {
        const y = (height / 4) * line;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      if (!lossHistory.length) {
        ctx.fillStyle = Config.COLORS.textMuted;
        ctx.font = `12px ${Config.FONTS.mono}`;
        ctx.fillText("Awaiting training telemetry…", 14, height / 2);
        return;
      }

      const minLoss = Math.min(...lossHistory);
      const maxLoss = Math.max(...lossHistory);
      const paddedMin = minLoss * 0.94;
      const paddedMax = maxLoss * 1.06;
      const range = Math.max(0.0001, paddedMax - paddedMin);

      ctx.strokeStyle =
        state === Config.STATES.converging || state === Config.STATES.complete
          ? Config.COLORS.success
          : Config.COLORS.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      lossHistory.forEach((value, index) => {
        const x = (index / Math.max(1, lossHistory.length - 1)) * width;
        const normalized = (value - paddedMin) / range;
        const y = height - normalized * (height - 16) - 8;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      ctx.fillStyle = Config.COLORS.textMuted;
      ctx.font = `11px ${Config.FONTS.mono}`;
      ctx.fillText(`High ${formatNumber(paddedMax, 4)}`, 10, 14);
      ctx.fillText(`Low ${formatNumber(paddedMin, 4)}`, 10, height - 8);
    }
  }

  return DashboardController;
})();
