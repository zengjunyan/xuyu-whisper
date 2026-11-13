import { ref } from 'vue'
import { defineStore } from 'pinia'

export const TOAST_DURATION = 2200

export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  const visible = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function hide(): void {
    clearTimer()
    visible.value = false
  }

  function show(text: string, duration: number = TOAST_DURATION): void {
    message.value = text
    visible.value = true

    clearTimer()
    timer = setTimeout(() => {
      visible.value = false
      timer = null
    }, duration)
  }

  return { message, visible, show, hide }
})
