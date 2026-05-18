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
        d="M0,64 C240,16 480,112 720,64 C960,16 1200,112 1440,64 L1440,120 L0,120 Z"
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
