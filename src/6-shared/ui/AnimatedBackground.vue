<script setup lang="ts">
// AnimatedBackground — decorative full-viewport backdrop: a field of small
// glowing particles that drift and twinkle, plus brand-coloured "comet"
// streaks that periodically fly across the screen. Small crisp elements
// instead of large soft gradients — no gradient banding. Pure CSS, no deps.
// FSD: 6-shared/ui — generic decorative UI, no domain knowledge.

const COLORS = ['#a78bfa', '#818cf8', '#fb923c', '#e879f9'] as const

interface Decoration {
  id: number
  style: Record<string, string>
}

const particles: Decoration[] = Array.from({ length: 44 }, (_, i) => {
  const size = 2 + Math.random() * 3.5
  const color = COLORS[i % COLORS.length]
  return {
    id: i,
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: `${size}px`,
      height: `${size}px`,
      background: color,
      boxShadow: `0 0 ${size * 3}px ${size * 0.8}px ${color}`,
      '--dx': `${(Math.random() * 2 - 1) * 90}px`,
      '--dy': `${(Math.random() * 2 - 1) * 90}px`,
      animationDuration: `${14 + Math.random() * 22}s`,
      animationDelay: `${-Math.random() * 36}s`,
    },
  }
})

const comets: Decoration[] = Array.from({ length: 5 }, (_, i) => {
  const color = COLORS[i % COLORS.length]
  return {
    id: i,
    style: {
      top: `${6 + Math.random() * 62}%`,
      '--comet-color': color,
      animationDuration: `${7 + Math.random() * 6}s`,
      animationDelay: `${-Math.random() * 22 - i * 3}s`,
    },
  }
})
</script>

<template>
  <div
    class="glow-bg"
    aria-hidden="true"
  >
    <span
      v-for="p in particles"
      :key="`p${p.id}`"
      class="particle"
      :style="p.style"
    />
    <span
      v-for="c in comets"
      :key="`c${c.id}`"
      class="comet"
      :style="c.style"
    />
  </div>
</template>

<style scoped>
.glow-bg {
  position: fixed;
  inset: 0;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;
}

/* --- Drifting, twinkling particles ------------------------------------ */
.particle {
  position: absolute;
  border-radius: 9999px;
  opacity: 0;
  will-change: transform, opacity;
  animation-name: float;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@keyframes float {
  0% {
    opacity: 0;
    transform: translate(0, 0);
  }
  20% {
    opacity: 0.7;
  }
  50% {
    opacity: 0.45;
    transform: translate(var(--dx), var(--dy));
  }
  80% {
    opacity: 0.7;
  }
  100% {
    opacity: 0;
    transform: translate(0, 0);
  }
}

/* --- Comet streaks flying across -------------------------------------- */
.comet {
  position: absolute;
  left: -16rem;
  height: 2px;
  width: 14rem;
  border-radius: 9999px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0), var(--comet-color));
  filter: drop-shadow(0 0 6px var(--comet-color));
  opacity: 0;
  will-change: transform, opacity;
  animation-name: fly;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes fly {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(16deg);
  }
  4% {
    opacity: 0.85;
  }
  34% {
    opacity: 0.85;
  }
  46% {
    opacity: 0;
    transform: translate(135vw, 40vh) rotate(16deg);
  }
  100% {
    opacity: 0;
    transform: translate(135vw, 40vh) rotate(16deg);
  }
}

/* Respect users who prefer reduced motion — static dots, no comets. */
@media (prefers-reduced-motion: reduce) {
  .particle {
    animation: none;
    opacity: 0.5;
  }
  .comet {
    display: none;
  }
}
</style>
