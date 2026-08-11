/** Turns the diagram SVG into files the user can reuse elsewhere. */

const PNG_SCALE = 4;

const svgObjectUrl = (svg) =>
  URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

export const svgToPngDataUrl = (svg, width, height, scale = PNG_SCALE) =>
  new Promise((resolve, reject) => {
    const url = svgObjectUrl(svg);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Le rendu PNG a échoué.'));
    };

    image.src = url;
  });

/** Keeps only characters that are safe in a file name on Windows and macOS. */
export const toFileName = (name, extension, fallback = 'accord') => {
  const cleaned = (name ?? '').replace(/[\\/:*?"<>|#]/g, '_').trim();
  return `${cleaned === '' ? fallback : cleaned}.${extension}`;
};
