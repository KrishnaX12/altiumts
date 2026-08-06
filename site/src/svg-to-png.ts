export async function rasterizeSvgToPng(svg: string): Promise<Uint8Array> {
  const image = new Image()
  image.decoding = "sync"
  const canvas = document.createElement("canvas")
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  )

  try {
    image.src = url
    try {
      await image.decode()
    } catch (error) {
      throw new Error(
        `Could not decode rendered SVG: ${getErrorMessage(error)}`,
      )
    }
    const width = Math.ceil(image.naturalWidth)
    const height = Math.ceil(image.naturalHeight)
    if (width <= 0 || height <= 0) {
      throw new Error(
        `Rendered SVG has invalid intrinsic dimensions (${width} × ${height})`,
      )
    }

    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Could not create a canvas for PNG export")
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result: Blob | null) => {
        if (result) resolve(result)
        else reject(new Error("Could not encode the rendered view as PNG"))
      }, "image/png")
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength === 0) {
      throw new Error("PNG encoding produced an empty image")
    }
    return bytes
  } finally {
    URL.revokeObjectURL(url)
    image.removeAttribute("src")
    canvas.width = 0
    canvas.height = 0
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
