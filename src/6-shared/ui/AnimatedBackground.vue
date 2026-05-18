<script setup lang="ts">
// AnimatedBackground — decorative full-viewport backdrop with soft glowing
// orbs that slowly drift across the screen. Pure CSS, no dependency.
// FSD: 6-shared/ui — generic decorative UI, no domain knowledge.
</script>

<template>
  <div
    class="glow-bg"
    aria-hidden="true"
  >
    <span class="orb orb-1" />
    <span class="orb orb-2" />
    <span class="orb orb-3" />
    <span class="orb orb-4" />
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

.orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(90px);
  opacity: 0.35;
  will-change: transform;
}

/* violet — drifts from top-left across to the lower-right */
.orb-1 {
  width: 34rem;
  height: 34rem;
  top: -10rem;
  left: -8rem;
  background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
  animation: drift-1 32s ease-in-out infinite;
}

/* indigo — sweeps from the bottom-left up to the top-right */
.orb-2 {
  width: 28rem;
  height: 28rem;
  bottom: -8rem;
  left: 10%;
  background: radial-gradient(circle, #4f46e5 0%, transparent 70%);
  animation: drift-2 38s ease-in-out infinite;
  animation-delay: -6s;
}

/* orange — a smaller, faster glow flying right-to-left */
.orb-3 {
  width: 20rem;
  height: 20rem;
  top: 18%;
  right: -6rem;
  background: radial-gradient(circle, #f97316 0%, transparent 70%);
  opacity: 0.28;
  animation: drift-3 26s ease-in-out infinite;
  animation-delay: -12s;
}

/* fuchsia — slow wandering glow near the lower-right */
.orb-4 {
  width: 26rem;
  height: 26rem;
  bottom: 8%;
  right: 6%;
  background: radial-gradient(circle, #c026d3 0%, transparent 70%);
  opacity: 0.25;
  animation: drift-4 44s ease-in-out infinite;
  animation-delay: -20s;
}

@keyframes drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(46vw, 22vh) scale(1.15); }
  66% { transform: translate(18vw, 58vh) scale(0.9); }
}

@keyframes drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  40% { transform: translate(38vw, -42vh) scale(1.2); }
  70% { transform: translate(62vw, -14vh) scale(0.95); }
}

@keyframes drift-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-66vw, 30vh) scale(1.25); }
}

@keyframes drift-4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  35% { transform: translate(-30vw, -18vh) scale(1.1); }
  68% { transform: translate(-52vw, 24vh) scale(0.85); }
}

/* Respect users who prefer reduced motion — keep the glow, drop the drift. */
@media (prefers-reduced-motion: reduce) {
  .orb {
    animation: none;
  }
}
</style>
