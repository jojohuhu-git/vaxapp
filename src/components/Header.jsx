import { useApp } from '../context/AppContext';

export default function Header({ onShare }) {
  const { dispatch } = useApp();

  function handleReset() {
    if (window.confirm("Clear all patient data and start over?")) {
      dispatch({ type: "CLEAR_ALL" });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  return (
    <header className="hdr">
      <div className="hdr-in">
        <div className="logo">
          <div>
            <h1>PediVax</h1>
            <p>Pediatric Vaccine Clinical Planner</p>
          </div>
        </div>
        <div className="hdr-btns">
          <button className="hdr-btn" onClick={onShare}>
            Share
          </button>
          <button className="hdr-btn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
