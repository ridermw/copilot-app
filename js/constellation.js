window.AzureAIConstellation = window.AzureAIConstellation || {};

window.AzureAIConstellation.Constellation = (() => {
  const { Config } = window.AzureAIConstellation;
  const rgbCache = new Map();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
  }

  function easeInOutCubic(value) {
    const input = clamp(value, 0, 1);
    return input < 0.5 ? 4 * input * input * input : 1 - Math.pow(-2 * input + 2, 3) / 2;
  }

  function seedUnit(seed) {
    const raw = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function toRgb(hex) {
    if (!rgbCache.has(hex)) {
      const normalized = hex.replace("#", "");
      rgbCache.set(hex, {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16)
      });
    }

    return rgbCache.get(hex);
  }

  function mixColor(from, to, amount, alpha) {
    const start = toRgb(from);
    const end = toRgb(to);
    const weight = clamp(amount, 0, 1);
    const r = Math.round(lerp(start.r, end.r, weight));
    const g = Math.round(lerp(start.g, end.g, weight));
    const b = Math.round(lerp(start.b, end.b, weight));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  class ConstellationRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.center = { x: 0, y: 0 };
      this.viewMode = Config.VIEW_MODES.constellation;
      this.viewBlend = 0;
      this.viewTransition = null;
      this.model = Config.MODELS.gpt5;
      this.state = Config.STATES.booting;
      this.nodes = [];
      this.retiringNodes = [];
      this.recoveredNodes = [];
      this.globalFlashUntil = 0;
      this.globalFlashColor = Config.COLORS.accent;
      this.starfield = [];

      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = Math.max(760, Math.round(rect.width || 760));
      this.height = Math.max(Config.LAYOUT.minCanvasHeight, Math.round(rect.height || 560));
      this.dpr = Math.max(1, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
      this.center = { x: this.width / 2, y: this.height / 2 };
      this.generateStarfield();
      this.recalculateLayout();
    }

    generateStarfield() {
      this.starfield = Array.from({ length: 90 }, (_, index) => ({
        x: seedUnit(index + 4) * this.width,
        y: seedUnit(index + 9) * this.height,
        size: 0.5 + seedUnit(index + 12) * 1.8,
        alpha: 0.18 + seedUnit(index + 16) * 0.4,
        phase: seedUnit(index + 24) * Math.PI * 2
      }));
    }

    setModel(modelKey) {
      this.model = Config.MODELS[modelKey] || Config.MODELS.gpt5;
      this.recalculateLayout();
    }

    setState(state) {
      this.state = state;
    }

    setViewMode(viewMode, now) {
      if (viewMode === this.viewMode) {
        return;
      }

      this.viewTransition = {
        from: this.viewBlend,
        to: viewMode === Config.VIEW_MODES.rack ? 1 : 0,
        startedAt: now
      };
      this.viewMode = viewMode;
    }

    triggerGlobalFlash(now, color) {
      this.globalFlashUntil = now + 180;
      this.globalFlashColor = color;
    }

    setNodeCount(nodeCount, now, force = false) {
      if (!force && nodeCount === this.nodes.length) {
        return;
      }

      const previous = this.nodes.slice();
      const next = [];
      for (let index = 0; index < nodeCount; index += 1) {
        const existing = previous[index];
        if (existing) {
          existing.rackIndex = index % Config.LAYOUT.rackColumns;
          existing.slotIndex = Math.floor(index / Config.LAYOUT.rackColumns);
          next.push(existing);
        } else {
          next.push(this.createNode(index, now));
        }
      }

      previous.slice(nodeCount).forEach((node) => {
        node.removingAt = now;
        this.retiringNodes.push(node);
      });

      this.nodes = next;
      this.recalculateLayout();
    }

    createNode(index, now) {
      const rackIndex = index % Config.LAYOUT.rackColumns;
      const slotIndex = Math.floor(index / Config.LAYOUT.rackColumns);
      const seed = index + 1;
      return {
        index,
        rackIndex,
        slotIndex,
        id: `r${String(rackIndex + 1).padStart(2, "0")}-g${String(slotIndex + 1).padStart(3, "0")}`,
        spawnDelay: index * 2,
        spawnedAt: now,
        failureUntil: 0,
        failureFlashUntil: 0,
        recoveryPulseUntil: 0,
        phase: seedUnit(seed + 1) * Math.PI * 2,
        wobbleRadius: 2 + seedUnit(seed + 3) * 4,
        thermalBias: seedUnit(seed + 7) * 0.18 - 0.08,
        baseRadius: 3,
        constellationTarget: { x: this.center.x, y: this.center.y },
        rackTarget: { x: this.center.x, y: this.center.y },
        renderX: this.center.x,
        renderY: this.center.y,
        renderRadius: 0,
        renderAlpha: 0,
        removingAt: 0
      };
    }

    recalculateLayout() {
      if (!this.nodes.length && !this.retiringNodes.length) {
        return;
      }

      const paddingX = 40;
      const paddingTop = 54;
      const paddingBottom = 44;
      const rackWidth = (this.width - paddingX * 2) / Config.LAYOUT.rackColumns;
      const rackHeights = Array(Config.LAYOUT.rackColumns).fill(0);
      const rackTotals = Array(Config.LAYOUT.rackColumns).fill(0);
      this.nodes.forEach((node) => {
        rackTotals[node.rackIndex] += 1;
      });

      const radiusByCount = clamp(8 - Math.log2(Math.max(1, this.nodes.length / 256 || 1)) * 1.5, 2, 8);
      this.nodes.forEach((node) => {
        rackHeights[node.rackIndex] += 1;
        const clusterAngle = (node.rackIndex / Config.LAYOUT.rackColumns) * Math.PI * 2 - Math.PI / 2;
        const clusterX = this.center.x + Math.cos(clusterAngle) * this.width * 0.28;
        const clusterY = this.center.y + Math.sin(clusterAngle) * this.height * 0.22;
        const localAngle = seedUnit(node.index * 13 + 5) * Math.PI * 2;
        const localRadius = Math.sqrt(seedUnit(node.index * 17 + 3)) * Math.min(this.width, this.height) * 0.11;

        node.constellationTarget = {
          x: clamp(clusterX + Math.cos(localAngle) * localRadius, paddingX, this.width - paddingX),
          y: clamp(clusterY + Math.sin(localAngle) * localRadius, paddingTop, this.height - paddingBottom)
        };

        const nodesInRack = Math.max(1, rackTotals[node.rackIndex]);
        const rackLocalIndex = rackHeights[node.rackIndex] - 1;
        const rackColumns = clamp(Math.round(Math.sqrt(nodesInRack) * 0.75), 5, 12);
        const rackRows = Math.ceil(nodesInRack / rackColumns);
        const rackInnerWidth = rackWidth - 12;
        const rackInnerHeight = this.height - paddingTop - paddingBottom;
        const localColumn = rackLocalIndex % rackColumns;
        const localRow = Math.floor(rackLocalIndex / rackColumns);

        node.rackTarget = {
          x:
            paddingX +
            node.rackIndex * rackWidth +
            ((localColumn + 0.5) / rackColumns) * rackInnerWidth +
            6,
          y:
            paddingTop +
            ((localRow + 0.5) / Math.max(1, rackRows)) * rackInnerHeight
        };

        node.baseRadius = radiusByCount;
      });
    }

    failRandomNode(now) {
      const candidates = this.nodes.filter(
        (node) => !node.failureUntil && node.renderAlpha > 0.8 && node.renderRadius > 1.6
      );
      if (!candidates.length) {
        return null;
      }

      const node = candidates[Math.floor(Math.random() * candidates.length)];
      node.failureUntil =
        now +
        Config.TIMINGS.failureRecoveryMinMs +
        Math.random() * (Config.TIMINGS.failureRecoveryMaxMs - Config.TIMINGS.failureRecoveryMinMs);
      node.failureFlashUntil = now + Config.TIMINGS.failureFlashMs;
      return node;
    }

    consumeRecoveredNodes() {
      const recovered = this.recoveredNodes.slice();
      this.recoveredNodes = [];
      return recovered;
    }

    getFailedCount(now) {
      return this.nodes.reduce((total, node) => total + Number(node.failureUntil > now), 0);
    }

    getRenderableNodes() {
      return this.nodes.filter((node) => node.renderAlpha > 0.12 && node.renderRadius > 0.4);
    }

    pickNode(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const threshold = this.nodes.length > 1024 ? 8 : 12;
      let bestNode = null;
      let bestDistance = Infinity;

      this.nodes.forEach((node) => {
        if (!node.renderAlpha || node.renderRadius <= 0.4) {
          return;
        }

        const distance = Math.hypot(node.renderX - x, node.renderY - y);
        if (distance <= node.renderRadius + threshold && distance < bestDistance) {
          bestNode = node;
          bestDistance = distance;
        }
      });

      if (!bestNode) {
        return null;
      }

      return {
        node: bestNode,
        x,
        y
      };
    }

    sampleFlowPair(snapshot) {
      const active = this.nodes.filter((node) => node.renderAlpha > 0.6 && node.failureUntil <= snapshot.now);
      if (active.length < 2) {
        return null;
      }

      const source = active[Math.floor(Math.random() * active.length)];
      let target = active[(source.index + 8) % active.length];
      if (Math.random() > 0.65) {
        target = active[Math.floor(Math.random() * active.length)];
      }

      if (!target || target === source) {
        return null;
      }

      return {
        from: { x: source.renderX, y: source.renderY },
        to: { x: target.renderX, y: target.renderY },
        flow: clamp(snapshot.metrics.utilization * 0.75 + 0.12, 0.18, 1),
        color:
          snapshot.state === Config.STATES.converging
            ? Config.COLORS.success
            : Config.COLORS.accent
      };
    }

    update(now, snapshot) {
      this.setState(snapshot.state);
      if (this.viewTransition) {
        const progress = clamp((now - this.viewTransition.startedAt) / Config.TIMINGS.morphMs, 0, 1);
        this.viewBlend = lerp(
          this.viewTransition.from,
          this.viewTransition.to,
          easeInOutCubic(progress)
        );
        if (progress >= 1) {
          this.viewTransition = null;
        }
      }

      this.recoveredNodes = [];
      this.nodes.forEach((node) => {
        if (node.failureUntil && now >= node.failureUntil) {
          node.failureUntil = 0;
          node.failureFlashUntil = 0;
          node.recoveryPulseUntil = now + 900;
          this.recoveredNodes.push(node);
        }

        this.updateNodeRenderState(node, now, snapshot);
      });

      this.retiringNodes = this.retiringNodes.filter((node) => {
        this.updateNodeRenderState(node, now, snapshot, true);
        return node.renderAlpha > 0.01;
      });
    }

    updateNodeRenderState(node, now, snapshot, removing = false) {
      const baseX = lerp(node.constellationTarget.x, node.rackTarget.x, this.viewBlend);
      const baseY = lerp(node.constellationTarget.y, node.rackTarget.y, this.viewBlend);
      const wobbleScale =
        snapshot.motionPriority <= 2 ? 0.2 : snapshot.state === Config.STATES.idle ? 1 : 0.55;
      const wobbleX = Math.cos(now * 0.001 + node.phase) * node.wobbleRadius * wobbleScale;
      const wobbleY = Math.sin(now * 0.0012 + node.phase) * node.wobbleRadius * wobbleScale;
      const entryProgress = easeOutCubic(
        clamp((now - node.spawnedAt - node.spawnDelay) / 900, 0, 1)
      );
      const exitProgress = removing
        ? 1 - clamp((now - node.removingAt) / 320, 0, 1)
        : 1;

      let activation = 0.22 + 0.06 * Math.sin(now * 0.001 + node.phase);
      if (snapshot.state === Config.STATES.launching) {
        activation = clamp((snapshot.stateElapsed - node.spawnDelay * 3) / 850, 0, 1);
      } else if (
        snapshot.state === Config.STATES.training ||
        snapshot.state === Config.STATES.converging ||
        snapshot.state === Config.STATES.complete
      ) {
        activation = 0.8 + 0.18 * Math.sin(now * 0.0016 + node.phase);
      }

      if (snapshot.state === Config.STATES.converging) {
        activation *= 0.82;
      }

      if (snapshot.state === Config.STATES.complete) {
        activation *= 0.68;
      }

      if (node.failureUntil > now) {
        activation = 0.16;
      }

      node.renderX = lerp(this.center.x, baseX + wobbleX, entryProgress);
      node.renderY = lerp(this.center.y, baseY + wobbleY, entryProgress);
      node.renderRadius = node.baseRadius * entryProgress * exitProgress * (0.92 + activation * 0.32);
      node.renderAlpha = entryProgress * exitProgress;
      node.renderUtilization = clamp(
        snapshot.metrics.utilization + node.thermalBias + 0.07 * Math.sin(now * 0.0014 + node.phase),
        0.08,
        1
      );
    }

    draw(snapshot, particles) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawBackground(snapshot);
      if (this.viewBlend > 0.12) {
        this.drawRackGuides();
      }
      particles.draw(ctx);
      this.drawNodes(ctx, this.retiringNodes, snapshot);
      this.drawNodes(ctx, this.nodes, snapshot);
    }

    drawBackground(snapshot) {
      const ctx = this.ctx;
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "rgba(6, 10, 20, 0.18)");
      gradient.addColorStop(1, "rgba(6, 10, 20, 0.62)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.strokeStyle = Config.COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < this.width; x += 72) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, this.height);
      }
      for (let y = 0; y < this.height; y += 72) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(this.width, y + 0.5);
      }
      ctx.stroke();

      this.starfield.forEach((star, index) => {
        const alpha = star.alpha + Math.sin(snapshot.now * 0.001 + star.phase + index) * 0.08;
        ctx.fillStyle = `rgba(255, 255, 255, ${clamp(alpha, 0.05, 0.65)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    drawRackGuides() {
      const ctx = this.ctx;
      const paddingX = 40;
      const rackWidth = (this.width - paddingX * 2) / Config.LAYOUT.rackColumns;
      ctx.save();
      ctx.globalAlpha = this.viewBlend * 0.32;
      ctx.strokeStyle = Config.COLORS.gridStrong;
      ctx.lineWidth = 1;
      for (let rack = 0; rack < Config.LAYOUT.rackColumns; rack += 1) {
        const x = paddingX + rack * rackWidth;
        ctx.strokeRect(x, 48, rackWidth - 8, this.height - 96);
        ctx.fillStyle = `rgba(255,255,255,${0.22 * this.viewBlend})`;
        ctx.font = `11px ${Config.FONTS.mono}`;
        ctx.fillText(`R${rack + 1}`, x + 10, 64);
      }
      ctx.restore();
    }

    drawNodes(ctx, nodes, snapshot) {
      nodes.forEach((node) => {
        if (node.renderAlpha <= 0.02 || node.renderRadius <= 0.12) {
          return;
        }

        const colors = this.getNodeColors(node, snapshot);
        ctx.fillStyle = colors.outer;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, node.renderRadius * 2.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors.inner;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, node.renderRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    getNodeColors(node, snapshot) {
      let color = Config.COLORS.nodeActive;
      if (node.failureUntil > snapshot.now) {
        color =
          snapshot.now < node.failureFlashUntil && Math.floor(snapshot.now / 120) % 2 === 0
            ? Config.COLORS.danger
            : Config.COLORS.nodeOfr;
      } else if (node.recoveryPulseUntil > snapshot.now) {
        color = mixColor(Config.COLORS.success, Config.COLORS.accent, 0.35, 1);
      } else if (snapshot.state === Config.STATES.converging || snapshot.state === Config.STATES.complete) {
        color =
          node.renderUtilization > 0.72
            ? mixColor(Config.COLORS.nodeActive, Config.COLORS.success, 0.75, 1)
            : Config.COLORS.success;
      } else if (node.renderUtilization < 0.45) {
        color = mixColor(Config.COLORS.nodeIdle, Config.COLORS.nodeActive, node.renderUtilization / 0.45, 1);
      } else if (node.renderUtilization < 0.78) {
        color = mixColor(
          Config.COLORS.nodeActive,
          Config.COLORS.nodeHot,
          (node.renderUtilization - 0.45) / 0.33,
          1
        );
      } else {
        color = mixColor(
          Config.COLORS.nodeHot,
          Config.COLORS.nodeCritical,
          (node.renderUtilization - 0.78) / 0.22,
          1
        );
      }

      if (snapshot.now < this.globalFlashUntil) {
        const flashOuter = mixColor(
          this.globalFlashColor,
          "#ffffff",
          0.55,
          clamp(node.renderAlpha * 0.26, 0.08, 0.4)
        );
        const flashInner = mixColor(
          this.globalFlashColor,
          "#ffffff",
          0.16,
          clamp(node.renderAlpha * 0.98, 0.1, 1)
        );
        return { inner: flashInner, outer: flashOuter };
      }

      const outer = color.startsWith("rgba")
        ? color.replace(/,\s*1\)$/, `, ${clamp(node.renderAlpha * 0.18, 0.05, 0.28)})`)
        : mixColor(color, "#ffffff", 0.25, clamp(node.renderAlpha * 0.18, 0.05, 0.28));

      const inner = color.startsWith("rgba")
        ? color.replace(/,\s*1\)$/, `, ${clamp(node.renderAlpha * 0.95, 0.08, 0.95)})`)
        : mixColor(color, "#ffffff", 0.05, clamp(node.renderAlpha * 0.95, 0.08, 0.95));

      return { inner, outer };
    }
  }

  return ConstellationRenderer;
})();
