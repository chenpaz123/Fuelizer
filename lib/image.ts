const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 0.82;

/**
 * Downscales an image file to at most `maxDimension` on its long edge and
 * re-encodes it as JPEG — a phone photo can be 4000px/5MB+, which is far
 * more than a vision model needs and slow to upload. Returns both the
 * re-encoded Blob (for Storage) and a data: URL (for the OCR call), so the
 * work only happens once.
 */
export async function resizeImageToJpeg(
  file: File,
  {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_JPEG_QUALITY,
  }: { maxDimension?: number; quality?: number } = {}
): Promise<{ blob: Blob; base64: string }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) throw new Error("Failed to encode image as JPEG");

    const base64 = canvas.toDataURL("image/jpeg", quality);
    return { blob, base64 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
