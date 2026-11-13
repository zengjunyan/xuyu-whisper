<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div id="toast" class="toast" :class="{ 'is-visible': toast.visible }" role="status" aria-live="polite">
    {{ toast.message }}
  </div>
</template>
