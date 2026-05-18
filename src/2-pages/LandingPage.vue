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
    <div class="relative flex min-h-dvh flex-col justify-center bg-linear-to-b from-violet-950/30 to-indigo-950/30">
      <WaveDivider
        position="top"
        fill="rgb(46 16 101 / 0.30)"
      />
      <HowItWorksSection />
      <LatestQuizzes />
      <WaveDivider
        position="bottom"
        fill="rgb(30 27 75 / 0.30)"
      />
    </div>
    <PricingTeaserSection />
    <AppFooter />
  </div>
</template>
