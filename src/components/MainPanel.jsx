import { useApp } from '../context/AppContext';
import { genRecs } from '../logic/recommendations';
import { validatedHistory } from '../logic/validation';
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
          <h2>Select Patient Age to Begin</h2>
          <p>Choose an age from the sidebar to generate vaccine recommendations based on the 2025 CDC/ACIP schedule.</p>
        </div>
      </div>
    );
  }

  // Use a history filtered to only valid/countable doses. Doses that must be
  // repeated (interval/age violations, non-countable off-label administrations
  // like Kinrix IPV <4y) are excluded so the rec engine correctly advances the
  // series instead of treating an invalid dose as complete.
  const validHist = validatedHistory(state.hist, state.dob);
  const recs = genRecs(state.am, validHist, state.risks, state.dob);

  return (
    <div className="card">
      <div className="ctitle">
        Recommendations
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
