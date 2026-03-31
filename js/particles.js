window.AzureAIConstellation = window.AzureAIConstellation || {};

window.AzureAIConstellation.Particles = (() => {
  const { Config } = window.AzureAIConstellation;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class ParticleSystem {
    constructor() {
      this.pool = Array.from({ length: Config.SIMULATION.maxParticlePool }, () => ({
        active: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        size: 0,
        alpha: 0,
        color: Config.COLORS.accent
      }));
      this.spawnCarry = 0;
      this.flowBoostUntil = 0;
      this.flowBoostMultiplier = 1;
    }

    setFlowBoost(until, multiplier) {
      this.flowBoostUntil = until;
      this.flowBoostMultiplier = multiplier;
    }

    allocateParticle() {
      return this.pool.find((particle) => !particle.active) || null;
    }

    spawnFlowParticle(pair, speedScale = 1) {
      const particle = this.allocateParticle();
      if (!particle || !pair) {
        return;
      }

      const dx = pair.to.x - pair.from.x;
      const dy = pair.to.y - pair.from.y;
      const distance = Math.max(24, Math.hypot(dx, dy));
      const velocity = 140 + pair.flow * 220 * speedScale;

      particle.active = true;
      particle.x = pair.from.x;
      particle.y = pair.from.y;
      particle.prevX = pair.from.x;
      particle.prevY = pair.from.y;
      particle.vx = (dx / distance) * velocity;
      particle.vy = (dy / distance) * velocity;
      particle.life = 0;
      particle.maxLife = distance / velocity;
      particle.size = 1 + pair.flow * 2.1;
      particle.alpha = clamp(0.35 + pair.flow * 0.65, 0, 1);
      particle.color = pair.color;
    }

    spawnBurst(x, y, color, count, speedRange) {
      for (let index = 0; index < count; index += 1) {
        const particle = this.allocateParticle();
        if (!particle) {
          return;
        }

        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
        const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);

        particle.active = true;
        particle.x = x;
        particle.y = y;
        particle.prevX = x;
        particle.prevY = y;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed;
        particle.life = 0;
        particle.maxLife = 0.8 + Math.random() * 1.4;
        particle.size = 1.4 + Math.random() * 2.3;
        particle.alpha = 0.85;
        particle.color = color;
      }
    }

    triggerFailure(node) {
      if (!node) {
        return;
      }

      this.spawnBurst(node.renderX, node.renderY, Config.COLORS.alert, 14, [26, 92]);
    }

    triggerRecovery(node) {
      if (!node) {
        return;
      }

      this.spawnBurst(node.renderX, node.renderY, Config.COLORS.success, 18, [18, 72]);
    }

    triggerCheckpoint(nodes) {
      nodes.slice(0, 18).forEach((node) => {
        this.spawnBurst(node.renderX, node.renderY, Config.COLORS.accent, 5, [10, 24]);
      });
    }

    triggerCelebration(nodes) {
      const burstTargets = nodes.filter((_, index) => index % Math.max(1, Math.floor(nodes.length / 36)) === 0);
      burstTargets.slice(0, Config.SIMULATION.maxCelebrationBursts).forEach((node, index) => {
        const colors = [Config.COLORS.accent, Config.COLORS.success, Config.COLORS.alert];
        this.spawnBurst(node.renderX, node.renderY, colors[index % colors.length], 18, [28, 120]);
      });
    }

    update(deltaMs, snapshot, pairProvider) {
      const deltaSeconds = deltaMs / 1000;
      const stateAllowsFlow =
        snapshot.state === Config.STATES.launching ||
        snapshot.state === Config.STATES.training ||
        snapshot.state === Config.STATES.converging;

      if (stateAllowsFlow && pairProvider) {
        const boost =
          snapshot.now < this.flowBoostUntil ? this.flowBoostMultiplier : 1;
        this.spawnCarry += snapshot.flowIntensity * boost * deltaSeconds * 28;

        while (this.spawnCarry >= 1) {
          const pair = pairProvider();
          if (!pair) {
            break;
          }

          this.spawnFlowParticle(pair, boost);
          this.spawnCarry -= 1;
        }
      }

      this.pool.forEach((particle) => {
        if (!particle.active) {
          return;
        }

        particle.life += deltaSeconds;
        if (particle.life >= particle.maxLife) {
          particle.active = false;
          return;
        }

        particle.prevX = particle.x;
        particle.prevY = particle.y;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vx *= 0.996;
        particle.vy *= 0.996;
      });
    }

    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      this.pool.forEach((particle) => {
        if (!particle.active) {
          return;
        }

        const lifeRatio = 1 - particle.life / particle.maxLife;
        ctx.globalAlpha = particle.alpha * clamp(lifeRatio, 0, 1);
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = particle.size;
        ctx.beginPath();
        ctx.moveTo(particle.prevX, particle.prevY);
        ctx.lineTo(particle.x, particle.y);
        ctx.stroke();

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  return ParticleSystem;
})();
