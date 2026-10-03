import { decryptFile } from '@dm-hero/seal'

// Encrypted image -> object URL. Each file is fetched + decrypted once per page
// session; reloads hit the browser cache (the relay marks files immutable).
const cache = new Map<string, Promise<string>>()

function load(gameId: string, file: SharedFileRef) {
  let url = cache.get(file.fileId)
  if (!url) {
    url = fetch(`/api/v1/games/${gameId}/files/${file.fileId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`File ${res.status}`)
        return res.arrayBuffer()
      })
      .then(data => decryptFile(data, file))
      .then(bytes => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: file.mime })))
    cache.set(file.fileId, url)
    url.catch(() => cache.delete(file.fileId))
  }
  return url
}

export function useSharedImage(file: () => SharedFileRef | undefined) {
  const gameId = String(useRoute().params.gameId)
  const src = ref<string | null>(null)
  watch(file, async (value) => {
    src.value = null
    if (!value) return
    try {
      src.value = await load(gameId, value)
    }
    catch (error) {
      // Missing or tampered file - just no picture
      console.error('[E2E] Image failed:', error)
    }
  }, { immediate: true })
  return src
}
