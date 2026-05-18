<script setup lang="ts">
// WaveDivider — decorative wavy seam placed at the top or bottom edge of a
// tinted section so the transition between landing screens reads as a wave
// instead of a straight line. The fill matches `bg-neutral-900/50`.
// FSD: 6-shared/ui — generic decorative UI, no domain knowledge.
defineProps<{
  /** Which edge of the parent section this divider sits on. */
  position: 'top' | 'bottom'
}>()
</script>

<template>
  <div
    class="wave-divider"
    :class="position === 'top' ? 'wave-divider--top' : 'wave-divider--bottom'"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
    >
      <path
        d="M0,64 C40,32 80,32 120,64 C160,96 200,96 240,64 C280,32 320,32 360,64 C400,96 440,96 480,64 C520,32 560,32 600,64 C640,96 680,96 720,64 C760,32 800,32 840,64 C880,96 920,96 960,64 C1000,32 1040,32 1080,64 C1120,96 1160,96 1200,64 C1240,32 1280,32 1320,64 C1360,96 1400,96 1440,64 L1440,120 L0,120 Z"
        fill="rgb(23 23 23 / 0.5)"
      />
    </svg>
  </div>
</template>

<style scoped>
.wave-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: clamp(48px, 7vw, 110px);
  line-height: 0;
}

.wave-divider svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* Top edge: flat side merges with the section, crest points up into the
   section above. */
.wave-divider--top {
  top: 0;
  transform: translateY(-100%);
}

/* Bottom edge: flipped so the flat side merges with the section and the
   crest points down into the section below. */
.wave-divider--bottom {
  bottom: 0;
  transform: translateY(100%) scaleY(-1);
}
</style>
