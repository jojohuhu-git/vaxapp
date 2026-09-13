// HardStopBanner.jsx — shown wherever a CAR-T/B-cell-malignancy/B-cell-
// depleting-therapy patient would otherwise see forward-looking vaccine
// recommendations. See src/logic/hardStop.js for the single source of truth
// this mirrors, and docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md
// for the design this implements.
import { HARD_STOP_MESSAGE } from '../logic/hardStop';
import { REFS } from '../data/refs';

export default function HardStopBanner() {
  return (
    <div className="hard-stop-banner">
      <div className="hard-stop-banner-title">This tool does not apply to this patient</div>
      <p className="hard-stop-banner-message">{HARD_STOP_MESSAGE}</p>
      <div className="hard-stop-banner-refs">
        <a href={REFS.alteredImmunocompetence.url} target="_blank" rel="noreferrer">{REFS.alteredImmunocompetence.label}</a>
        {' · '}
        <a href={REFS.asco.url} target="_blank" rel="noreferrer">{REFS.asco.label}</a>
        {' · '}
        <a href={REFS.nccn.url} target="_blank" rel="noreferrer">{REFS.nccn.label}</a>
        {' · '}
        <a href={REFS.idsa.url} target="_blank" rel="noreferrer">{REFS.idsa.label}</a>
      </div>
    </div>
  );
}
