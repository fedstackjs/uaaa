function getWindow(redirectUrl: string) {
  const url = new URL(redirectUrl)
  url.searchParams.set('stub', '1')
  redirectUrl = url.toString()

  // TODO: detech desktop browser and use window.open
  const win = window.open(redirectUrl, 'iaaa', 'width=800,height=600')
  if (win) return { client: win, close: () => win?.close() }
  const iframe = document.createElement('iframe')
  iframe.style.background = 'white'
  iframe.style.zIndex = '9999'
  iframe.style.border = 'none'
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.src = redirectUrl
  document.body.appendChild(iframe)
  return { client: iframe.contentWindow, close: () => iframe.remove() }
}

const timeout = 60 * 1000 // 1 minute

export async function getIAAAToken(nonInteractive = false) {
  const resp = await fetch('/.well-known/iaaa-configuration')
  const { appID, appName, authorizeUrl, redirectUrl, crossOrigin } = await resp.json()
  const html = `
  <form action="${authorizeUrl}" method=post name=iaaa style="display: none">
    <input type=hidden name=appID value="${appID}" />
    <input type=hidden name=appName value="${appName}" />
    <input type=hidden name=redirectUrl value="${redirectUrl}" />
  </form>
  `
  const { client, close } = getWindow(redirectUrl)
  if (!client) throw new Error('Failed to open IAAA window')
  let sameOrigin =
    typeof crossOrigin === 'boolean'
      ? !crossOrigin
      : new URL(redirectUrl).origin === window.location.origin
  if (sameOrigin) {
    client.document.write(html)
    client.document.forms[0].submit()
    const start = Date.now()
    for (; !client.closed && Date.now() - start < timeout; ) {
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
    close()
  } else {
    const { origin } = new URL(redirectUrl)
    console.log(`[IAAA] Using stub: ${origin}`)
    let token = ''
    let ready = false
    const listener = (e: MessageEvent) => {
      console.log(e)
      if (e.origin !== origin) return
      token ||= e.data.token
      ready ||= e.data.ready
    }
    window.addEventListener('message', listener)
    const cleanup = () => {
      window.removeEventListener('message', listener)
      close()
    }

    const start = Date.now()
    for (; !client.closed && Date.now() - start < timeout; ) {
      client.postMessage({ actions: [{ action: 'init' }] }, origin)
      if (ready) break
      await sleep(200)
    }
    console.log(`[IAAA] Stub ready`)
    client.postMessage({ actions: [{ action: 'write', html }] }, origin)
    console.log(`[IAAA] Sent message to stub`)
    for (; Date.now() - start < timeout; ) {
      client.postMessage({ actions: [{ action: 'getToken' }] }, origin)
      if (token) {
        cleanup()
        return token
      }
      await sleep(200)
    }
    cleanup()
  }
  if (nonInteractive) {
    history.go(1 - history.length)
    await sleep(2000)
    return ''
  }
  throw new Error('IAAA timeout')
}
