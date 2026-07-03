import { useApp } from '../context/AppContext';
import { encState, RESET_SNAPSHOT_KEY } from '../logic/urlState';

export default function Header({ onShare }) {
  const { state, dispatch } = useApp();

  function handleReset() {
    if (window.confirm("Clear all patient data and start over?")) {
      if (state.am >= 0 || state.dob) {
        try {
          localStorage.setItem(RESET_SNAPSHOT_KEY, encState(state));
        } catch {
          // localStorage unavailable (private browsing, quota) — Reset still proceeds.
        }
      }
      dispatch({ type: "CLEAR_ALL" });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  return (
    <header className="hdr">
      <div className="hdr-in">
        <div className="logo">
          <div className="logo-ico">
            <img src={`${import.meta.env.BASE_URL}pedivax-logo.svg`} alt="" />
          </div>
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
