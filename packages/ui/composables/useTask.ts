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
  const errToast = useErrorToast()
  const { t } = useI18n()
  const run = async (...args: T) => {
    running.value = true
    error.value = null
    try {
      await task(...args)
      toast.success(t('msg.task-succeeded'))
    } catch (e) {
      error.value = e
      errToast.notify(e)
    } finally {
      running.value = false
    }
  }
  return { running, error, run }
}
