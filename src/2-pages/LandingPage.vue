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
    <div class="relative flex min-h-dvh flex-col justify-center bg-neutral-900/50">
      <WaveDivider position="top" />
      <HowItWorksSection />
      <LatestQuizzes />
      <WaveDivider position="bottom" />
    </div>
    <PricingTeaserSection />
    <AppFooter />
  </div>
</template>
