<script setup lang="ts">
import AppHeader from '@widgets/AppHeader.vue'
import AppFooter from '@widgets/AppFooter.vue'
import HeroSection from '@widgets/HeroSection.vue'
import HowItWorksSection from '@widgets/HowItWorksSection.vue'
import LatestQuizzes from '@widgets/LatestQuizzes.vue'
import PricingTeaserSection from '@widgets/PricingTeaserSection.vue'
import WaveDivider from '@shared/ui/WaveDivider.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <HeroSection />
    <div class="relative flex min-h-dvh flex-col justify-center bg-linear-to-b from-violet-950/45 via-neutral-900/55 to-indigo-950/45">
      <WaveDivider
        position="top"
        fill="rgb(46 16 101 / 0.45)"
      />
      <HowItWorksSection />
      <LatestQuizzes />
      <WaveDivider
        position="bottom"
        fill="rgb(30 27 75 / 0.45)"
      />
    </div>
    <PricingTeaserSection />
    <AppFooter />
  </div>
</template>
