import { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { encState } from '../logic/urlState';

export default function ShareModal({ onClose }) {
  const { state } = useApp();
  const textRef = useRef(null);

  const enc = encState(state);
  const shareUrl = `${window.location.origin}${window.location.pathname}?s=${enc}`;

  function handleCopy() {
    if (textRef.current) {
      textRef.current.select();
      navigator.clipboard.writeText(shareUrl).catch(() => {
        document.execCommand("copy");
      });
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Share Patient Scenario</h3>
        <p>
          Copy the URL below to share this patient&apos;s vaccination data. The link encodes the current age, DOB, risk factors, and vaccination history.
        </p>
        <textarea
          ref={textRef}
          className="surl"
          readOnly
          value={shareUrl}
          rows={3}
          onClick={e => e.target.select()}
        />
        <div className="note-box">
          <strong>Note:</strong> This URL contains encoded patient data. Share only with authorized healthcare providers. Data is stored entirely in the URL &mdash; nothing is sent to any server.
        </div>
        <div className="mbtns">
          <button className="mbtn p" onClick={handleCopy}>Copy URL</button>
          <button className="mbtn s" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
