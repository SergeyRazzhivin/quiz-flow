<script setup lang="ts">
// ProStatusBanner — shown above the plan cards when the owner's effective plan
// is Pro and period_end is in the future. Displays the active-until date and a
// "Продлить подписку" renew CTA. FSD: 4-features/payment.
import { computed } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import Button from '@shared/ui/Button.vue'
import { usePaymentStore, type UsageData } from '../model/usePaymentStore'

const props = defineProps<{
  usage: UsageData | null
}>()

const store = usePaymentStore()

// D-17: format as DD.MM.YYYY via the ru-RU locale.
const activeUntil = computed(() =>
  props.usage?.period_end
    ? new Date(props.usage.period_end).toLocaleDateString('ru-RU')
    : '',
)

function handleRenew(): void {
  // Renewal reuses the monthly period; the user can adjust on the YooKassa page.
  void store.createPayment('monthly')
}
</script>

<template>
  <div class="flex items-center justify-between rounded-xl border border-violet-600/30 bg-violet-600/10 px-6 py-4">
    <div class="flex items-center gap-3">
      <Sparkles class="h-5 w-5 text-violet-400" />
      <div>
        <p class="text-sm font-semibold text-neutral-50">Pro активен</p>
        <p class="text-sm text-neutral-400">Действует до {{ activeUntil }}</p>
      </div>
    </div>
    <Button
      variant="outline"
      size="sm"
      @click="handleRenew"
    >
      Продлить подписку
    </Button>
  </div>
</template>
