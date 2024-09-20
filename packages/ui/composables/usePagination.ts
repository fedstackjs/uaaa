export const usePagination = <T>(
  executor: (
    skip: number,
    limit: number,
    count: boolean
  ) => Promise<{
    items: T[]
    count: number
  }>
) => {
  const page = useRouteQuery('page', '1', { transform: Number })
  const perPage = useRouteQuery('perPage', '10', { transform: Number })
  const cachedCount = ref(0)
  let countLoaded = false
  const { data, error, execute, status } = useAsyncData(async () => {
    const skip = (page.value - 1) * perPage.value
    const { items, count } = await executor(skip, perPage.value, !countLoaded)
    if (!countLoaded) {
      countLoaded = true
      cachedCount.value = count
    }
    return items
  })
  watch([page, perPage], (cur, old) => {
    console.log(cur, old)
    execute()
  })
  return { page, perPage, data, error, cachedCount, execute, status }
}
