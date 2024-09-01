function getClient() {
  localStorage.setItem('authRedirect', 'false')
  const win = window.open('/auth/redirect', 'iaaa', 'width=800,height=600')
  const client = win?.window
  if (client) return { client, close: () => win?.close() }
  const iframe = document.createElement('iframe')
  iframe.style.background = 'white'
  iframe.style.zIndex = '9999'
  iframe.style.border = 'none'
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.src = '/auth/redirect'
  document.body.appendChild(iframe)
  return { client: iframe.contentWindow, close: () => iframe.remove() }
}

export async function getIAAAToken() {
  const resp = await fetch('/.well-known/iaaa-configuration')
  const { appID, appName, authorizeUrl, redirectUrl } = await resp.json()
  const html = `
  <form action="${authorizeUrl}" method=post name=iaaa style="display: none">
    <input type=hidden name=appID value="${appID}" />
    <input type=hidden name=appName value="${appName}" />
    <input type=hidden name=redirectUrl value="${redirectUrl}" />
  </form>
  `
  const { client, close } = getClient()
  if (!client) throw new Error('Failed to open IAAA window')
  client.document.write(html)
  client.document.forms[0].submit()
  for (;;) {
    try {
      const params = new URLSearchParams(client.document.location.search)
      const token = params.get('token') || params.get('code')
      if (token) {
        close()
        return token
      }
    } catch (err) {
      //
    }
    await sleep(200)
  }
}
