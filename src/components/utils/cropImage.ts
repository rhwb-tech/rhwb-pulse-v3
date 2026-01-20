/**
 * Utility function to crop an image using canvas
 * Returns a JPEG blob ready for upload
 */

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Crops an image to the specified area and returns a JPEG blob
 * @param imageSrc - Base64 or URL of the source image
 * @param pixelCrop - The crop area in pixels { x, y, width, height }
 * @param outputSize - Output image size in pixels (default 200x200)
 * @returns Promise<Blob> - JPEG blob of the cropped image
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: number = 200
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set output dimensions
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped image onto the canvas, scaled to output size
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  // Return as JPEG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      },
      'image/jpeg',
      0.9 // Quality 90%
    );
  });
}
