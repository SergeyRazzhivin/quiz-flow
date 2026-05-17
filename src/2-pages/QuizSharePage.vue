<script setup lang="ts">
// Public quiz-taking entry page — renders the QuizTakingWidget for guests.
// No AppHeader — guest-only focused exam surface (D-01, D-19).
// Route: /q/:token — access independent of is_published (D-19).
import QuizTakingWidget from '@widgets/QuizTakingWidget.vue'
</script>

<template>
  <QuizTakingWidget />
</template>
