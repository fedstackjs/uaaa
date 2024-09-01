export interface IUseTaskOptions {
  //
}

export const useTask = <T extends any[]>(
  task: (...args: T) => Promise<void>,
  options?: IUseTaskOptions
) => {
  const running = ref(false)
  const error = ref<unknown>(null)
  const toast = useToast()
  const run = async (...args: T) => {
    running.value = true
    error.value = null
    try {
      await task(...args)
      toast.success('Task completed')
    } catch (e) {
      error.value = e
      toast.error('Task failed')
    } finally {
      running.value = false
    }
  }
  return { running, error, run }
}
