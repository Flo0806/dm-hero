export function useImageDownload() {
  function downloadImage(imageUrl: string, fileName: string) {
    // Create a temporary link element
    const link = document.createElement('a')
    link.href = imageUrl
    // Sanitize filename: remove special chars, replace spaces with underscores, lowercase
    const sanitizedName = fileName
      .replace(/[^a-z0-9\s]/gi, '')
      .replace(/\s+/g, '_')
      .toLowerCase()
    link.download = `${sanitizedName}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return {
    downloadImage,
  }
}
