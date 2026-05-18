<script setup lang="ts">
import AppHeader from '@widgets/AppHeader.vue'
import AppFooter from '@widgets/AppFooter.vue'
import HeroSection from '@widgets/HeroSection.vue'
import HowItWorksSection from '@widgets/HowItWorksSection.vue'
import QuizCarousel from '@widgets/QuizCarousel.vue'
import PricingTeaserSection from '@widgets/PricingTeaserSection.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <HeroSection />
    <HowItWorksSection />
    <QuizCarousel />
    <PricingTeaserSection />
    <AppFooter />
  </div>
</template>
