import { toPng, toBlob } from 'html-to-image';

export interface ExportOptions {
  mode?: 'download' | 'copy';
  backgroundColor?: string;
  scale?: number;
  onNotify?: (msg: string) => void;
  onBeforeExport?: () => Promise<void> | void;
  onAfterExport?: () => Promise<void> | void;
}

/**
 * Exports a given HTML element as a PNG image.
 * Supports both downloading the file and copying it to the clipboard.
 */
export async function exportElementAsImage(
  element: HTMLElement,
  filename: string,
  options: ExportOptions = {}
) {
  const { 
    mode = 'download', 
    backgroundColor = '#ffffff', 
    scale = 2, 
    onNotify,
    onBeforeExport,
    onAfterExport
  } = options;

  try {
    onNotify?.(mode === 'download' ? '⏳ Generando imagen...' : '⏳ Copiando imagen...');

    // Execute setup (e.g., switch to light theme)
    if (onBeforeExport) await onBeforeExport();

    // Small delay to ensure any pending UI updates are rendered
    await new Promise(resolve => setTimeout(resolve, 150));

    const config = {
      backgroundColor,
      pixelRatio: scale,
      skipAutoScale: true,
      cacheBust: true,
      style: {
        transform: 'scale(1)',
      }
    };

    if (mode === 'download') {
      const dataUrl = await toPng(element, config);
      const link = document.createElement('a');
      link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      link.href = dataUrl;
      link.click();
      onNotify?.('✓ Imagen descargada');
    } else {
      const blob = await toBlob(element, config);
      if (!blob) throw new Error('No se pudo generar el blob de la imagen');

      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      onNotify?.('✓ Imagen copiada al portapapeles');
    }
  } catch (error) {
    console.error('Error in exportElementAsImage:', error);
    onNotify?.('❌ Error al exportar imagen');
  } finally {
    // Restore original state
    if (onAfterExport) await onAfterExport();
  }
}
