'use client';

/**
 * Robust isolated iframe-based printing utility.
 * Eliminates all blank pages, modal style leaks, and zero-dimension layout bugs.
 */
export function printInvoiceElement({
  element,
  title = 'Invoice',
  isPos = false,
}: {
  element: HTMLElement | null;
  title?: string;
  isPos?: boolean;
}) {
  if (!element || typeof window === 'undefined') return;

  // 1. Clone element and strip any inner <style> or <script> tags
  // that might contain modal-hiding or conflicting @media print rules.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style, script').forEach((el) => el.remove());
  const contentHtml = clone.innerHTML;

  // 2. Remove any previously created print iframe
  const existingFrame = document.getElementById('wacrm-print-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  // 3. Create iframe with REAL viewport dimensions so Chromium & WebKit
  // can properly rasterize and calculate layout (avoids 0x0 blank page bug).
  const iframe = document.createElement('iframe');
  iframe.id = 'wacrm-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-99999';
  iframe.title = title;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // 4. Safely extract parent stylesheets without hostile portal-hiding CSS
  const headElements: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    headElements.push(link.outerHTML);
  });
  document.querySelectorAll('style').forEach((style) => {
    const text = style.textContent || '';
    // Skip any styles that target dialog portals or contain body hiding rules
    if (
      !text.includes('dialog-portal') &&
      !text.includes('dialog-overlay') &&
      !text.includes('body > *:not')
    ) {
      headElements.push(style.outerHTML);
    }
  });

  const parentStyles = headElements.join('\n');

  // 5. Write isolated printable HTML document
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="bn">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${parentStyles}
        <style>
          @page {
            size: ${isPos ? '80mm auto' : 'A4 portrait'};
            margin: ${isPos ? '2mm' : '8mm'};
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          /* Ensure all content inside iframe body is visible and never hidden */
          body, body * {
            visibility: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-page-break {
            page-break-after: always !important;
            break-after: page !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .invoice-page-break:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }
          ${
            isPos
              ? `
            .pos-slip-container, .bulk-pos-container {
              width: 76mm !important;
              max-width: 76mm !important;
              margin: 0 auto !important;
              padding: 2mm !important;
              border: 1px dashed #4b5563 !important;
              box-shadow: none !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
          `
              : `
            .a4-invoice-container, .bulk-a4-container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 6mm !important;
              border: 1px solid #d1d5db !important;
              box-shadow: none !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
          `
          }
        </style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  doc.close();

  // 6. Execute print once layout and fonts settle
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.remove();
        }
      }, 1500);
    }
  };

  // Wait for fonts to be ready if supported, otherwise slight delay
  if (iframe.contentWindow?.document?.fonts?.ready) {
    iframe.contentWindow.document.fonts.ready
      .then(() => {
        setTimeout(triggerPrint, 150);
      })
      .catch(() => {
        setTimeout(triggerPrint, 250);
      });
  } else {
    setTimeout(triggerPrint, 250);
  }
}
