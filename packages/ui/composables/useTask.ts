export interface IUseTaskOptions {
  //
}

export const symNoToast = Symbol('noToast')

export const useTask = <T extends any[], R>(
  task: (...args: T) => Promise<R | typeof symNoToast>,
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
      const result = await task(...args)
      if (result !== symNoToast) {
        toast.success(t('msg.task-succeeded'))
      }
      return result
    } catch (e) {
      error.value = e
      errToast.notify(e)
    } finally {
      running.value = false
    }
  }
  return { running, error, run }
}
