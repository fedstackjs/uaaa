type Timeout = ReturnType<typeof setTimeout>

export interface IUseTimerOptions {
  onTimeout?: () => void
}

export const useTimer = (options?: IUseTimerOptions) => {
  const rest = ref(0)
  const running = ref(false)
  let timeout: Timeout | null = null
  function tick() {
    if (rest.value > 0) {
      rest.value--
      timeout = setTimeout(tick, 1000)
    } else {
      reset()
      options?.onTimeout?.()
    }
  }
  function start(seconds: number) {
    reset()
    rest.value = seconds
    running.value = true
    timeout = setTimeout(tick, 1000)
  }
  function reset() {
    timeout && clearTimeout(timeout)
    rest.value = 0
    running.value = false
  }
  onBeforeUnmount(reset)
  return { rest, running, start, reset }
}
