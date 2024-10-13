import { useToast } from 'vue-toastification'

export { useToast }

export const useErrorToast = () => {
  const toast = useToast()
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n()
  const notify = (err: unknown) => {
    if (isAPIError(err)) {
      if (t(`errors.api.${err.code}`) !== `errors.api.${err.code}`) {
        toast.error(t(`errors.api.${err.code}`, err.data))
        if (t(`errors.api-hint.${err.code}`) !== `errors.api-hint.${err.code}`) {
          toast.info(t(`errors.api-hint.${err.code}`, err.data))
        }
      } else {
        toast.error(t('errors.api.unknown', err as { code: string }))
      }
      switch (err.code) {
        case 'INSUFFICIENT_SECURITY_LEVEL': {
          router.replace({
            path: '/auth/verify',
            query: { redirect: route.fullPath, targetLevel: err.data.required }
          })
          break
        }
        case 'INVALID_TOKEN': {
          api.dropEffectiveToken()
        }
      }
      return
    }
    if (err instanceof Error) {
      toast.error(t('errors.error', { message: err.message }))
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
