import { useToast } from 'vue-toastification'

export { useToast }

export const useErrorToast = () => {
  const toast = useToast()
  const { t, te } = useI18n()
  const notify = (err: unknown) => {
    if (err instanceof APIError) {
      if (te(`errors.api.${err.code}`)) {
        toast.error(t(`errors.api.${err.code}`, err.data))
        if (te(`errors.api-hint.${err.code}`)) {
          toast.info(t(`errors.api-hint.${err.code}`, err.data))
        }
      } else {
        toast.error(t('errors.api.unknown', err as { code: string }))
      }
      return
    }
    if (err instanceof Error) {
      toast.error(t('errors.error', err as { message: string }))
      return
    }
    toast.error(t('errors.unknown', { value: `${err}` }))
    console.error(err)
  }
  const trap = async <T>(fn: () => Promise<T>): Promise<[T, null] | [null, unknown]> => {
    try {
      return [await fn(), null]
    } catch (err) {
      notify(err)
      return [null, err]
    }
  }
  return { notify, trap }
}
