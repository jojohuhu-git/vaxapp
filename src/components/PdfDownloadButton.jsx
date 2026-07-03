/* eslint-disable react/prop-types */
// PdfDownloadButton — generates a @react-pdf/renderer PDF on click instead of
// eagerly on mount. @react-pdf/renderer (and the PDF template component) are
// dynamically imported here, so neither is in the main bundle and neither
// re-renders on every prop change while the page is just sitting there.
import { useState } from 'react';

export default function PdfDownloadButton({ buildDoc, fileName, style, className, children }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const doc = await buildDoc();
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} style={style} className={className} disabled={loading}>
      {typeof children === 'function' ? children({ loading }) : children}
    </button>
  );
}
