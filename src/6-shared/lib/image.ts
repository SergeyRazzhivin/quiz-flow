export async function resizeImageToMaxWidth(file: File, maxWidth = 1280): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth  * scale
      canvas.height = img.naturalHeight * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob!), file.type)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
