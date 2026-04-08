import { useApp } from '../context/AppContext';
import { genRecs } from '../logic/recommendations';
import StatusBar from './StatusBar';
import TabBar from './TabBar';
import RecTab from './RecTab';
import RegTab from './RegTab';
import ForecastTab from './ForecastTab';
import CatchUpTab from './CatchUpTab';

export default function MainPanel() {
  const { state } = useApp();

  if (state.am < 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="ei">&#x1F489;</div>
          <h2>Select Patient Age to Begin</h2>
          <p>Choose an age from the sidebar to generate vaccine recommendations based on the 2025 CDC/ACIP schedule.</p>
        </div>
      </div>
    );
  }

  const recs = genRecs(state.am, state.hist, state.risks, state.dob);

  return (
    <div className="card">
      <div className="ctitle">
        <span>&#x1F4CA;</span> Recommendations
      </div>
      <StatusBar recs={recs} />
      <TabBar />

      {state.tab === "recs" && <RecTab recs={recs} />}
      {state.tab === "regimen" && <RegTab recs={recs} />}
      {state.tab === "forecast" && <ForecastTab recs={recs} />}
      {state.tab === "catchup" && <CatchUpTab />}
    </div>
  );
}
