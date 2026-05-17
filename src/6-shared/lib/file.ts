// Generic file helpers — no domain knowledge.

/**
 * Read a File and resolve with its base64 payload only — the
 * `data:<mime>;base64,` prefix is stripped. Rejects on a FileReader error.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}
