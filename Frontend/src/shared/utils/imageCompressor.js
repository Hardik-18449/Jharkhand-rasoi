/**
 * High-performance client-side image compression and validation utility.
 * Guarantees that compressed images are <= 2MB and optimized for mobile uploads.
 */

export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_UPLOAD_SIZE_MB = 2;

/**
 * Validates raw file size and format before processing
 */
export const validateImageFile = (file, { maxInputMb = 20 } = {}) => {
  if (!file) return 'Please select an image file.';
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();

  const isImage = type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif|bmp)$/i.test(name);
  if (!isImage) {
    return 'Invalid file type. Please select a valid photo (JPG, PNG, WebP).';
  }

  if (file.size > maxInputMb * 1024 * 1024) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please select a photo under ${maxInputMb}MB.`;
  }

  return null;
};

/**
 * Helper to convert data URL to a Blob
 */
export const dataUrlToBlob = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL');
  }
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
};

/**
 * Helper to convert data URL to a File
 */
export const dataUrlToFile = (dataUrl, filename = 'image.webp') => {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type || 'image/webp' });
};

/**
 * Compresses an image (File, Blob, or DataURL string) to WebP format.
 * - Resizes longest dimension to maxDimension (default 1280px)
 * - Quality default 0.8
 * - Guarantees output size <= targetMaxBytes (default 2MB)
 * - Returns { file: File, blob: Blob, dataUrl: string, size: number, sizeKb: number }
 */
export const compressImage = async (
  fileOrBlob,
  {
    maxDimension = 1280,
    quality = 0.8,
    targetMaxBytes = MAX_UPLOAD_SIZE_BYTES,
    outputFormat = 'image/webp',
    filenamePrefix = 'photo'
  } = {}
) => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();

      const processLoadedImage = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return reject(new Error('Unable to read image dimensions'));
          }

          // Constrain longest dimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Smooth scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const tryEncode = (format, q, attempt = 1) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  if (format !== 'image/jpeg') {
                    // Fallback to JPEG if WebP encoding not supported
                    return tryEncode('image/jpeg', q, attempt);
                  }
                  return reject(new Error('Image encoding failed'));
                }

                // If output still > 2MB and we haven't downscaled too much, reduce quality/scale
                if (blob.size > targetMaxBytes && attempt < 3) {
                  const scale = 0.8;
                  const smallerCanvas = document.createElement('canvas');
                  smallerCanvas.width = Math.round(width * scale);
                  smallerCanvas.height = Math.round(height * scale);
                  const sCtx = smallerCanvas.getContext('2d');
                  sCtx.imageSmoothingEnabled = true;
                  sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);

                  smallerCanvas.toBlob(
                    (smallerBlob) => {
                      if (smallerBlob && smallerBlob.size <= targetMaxBytes) {
                        return finalize(smallerBlob, format, smallerCanvas);
                      }
                      finalize(smallerBlob || blob, format, smallerCanvas);
                    },
                    format,
                    Math.max(0.5, q - 0.15)
                  );
                  return;
                }

                finalize(blob, format, canvas);
              },
              format,
              q
            );
          };

          const finalize = (finalBlob, format, finalCanvas) => {
            const ext = format.includes('webp') ? 'webp' : 'jpg';
            const originalName = typeof fileOrBlob?.name === 'string' ? fileOrBlob.name : '';
            const baseName = originalName
              ? originalName.replace(/\.[^/.]+$/, '')
              : `${filenamePrefix}-${Date.now()}`;
            const fileName = `${baseName}.${ext}`;

            const finalFile = new File([finalBlob], fileName, { type: format });
            const dataUrl = finalCanvas.toDataURL(format, 0.7);

            resolve({
              file: finalFile,
              blob: finalBlob,
              dataUrl,
              size: finalBlob.size,
              sizeKb: Math.round(finalBlob.size / 1024),
              width: finalCanvas.width,
              height: finalCanvas.height,
              format
            });
          };

          tryEncode(outputFormat, quality);
        } catch (canvasErr) {
          reject(canvasErr);
        }
      };

      img.onload = processLoadedImage;
      img.onerror = () => reject(new Error('Failed to load image for compression'));

      if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
        img.src = fileOrBlob;
      } else if (fileOrBlob instanceof Blob || fileOrBlob instanceof File) {
        const objectUrl = URL.createObjectURL(fileOrBlob);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          processLoadedImage();
        };
        img.src = objectUrl;
      } else {
        reject(new Error('Invalid image input: expected File, Blob, or data URL string'));
      }
    } catch (err) {
      reject(err);
    }
  });
};
