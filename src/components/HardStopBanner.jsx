// HardStopBanner.jsx — shown wherever a hard-stopped patient would otherwise
// see forward-looking vaccine recommendations. See src/logic/hardStop.js for the
// single source of truth this mirrors, and
// docs/archive/handoff-2026-09-13-vaxapp-hct-hardstop-design-v2.md for the design.
//
// HSCT is a hard stop with a plan attached: the forward-looking surfaces are
// still off, but instead of a dead end the patient gets the sourced
// re-vaccination plan in HctRecipe (added 2026-09-13, backlog B-9). CAR-T,
// B-cell malignancy and B-cell-depleting therapy remain a bare stop.
import { HARD_STOP_MESSAGE } from '../logic/hardStop';
import { hctRecipeApplies, HCT_STOP_MESSAGE, HCT_STOP_TITLE } from '../logic/hctRecipe';
import HctRecipe from './HctRecipe';
import { REFS } from '../data/refs';

export default function HardStopBanner({ risks }) {
  const withRecipe = hctRecipeApplies(risks);

  return (
    <>
      <div className="hard-stop-banner">
        <div className="hard-stop-banner-title">
          {withRecipe ? HCT_STOP_TITLE : 'This tool does not apply to this patient'}
        </div>
        <p className="hard-stop-banner-message">
          {withRecipe ? HCT_STOP_MESSAGE : HARD_STOP_MESSAGE}
        </p>
        {/* ASCO/NCCN/IDSA support the CAR-T / B-cell stop specifically. The
            transplant plan carries its own per-vaccine citations, so the HSCT
            variant shows only the CDC page that governs post-HCT timing. */}
        <div className="hard-stop-banner-refs">
          <a href={REFS.alteredImmunocompetence.url} target="_blank" rel="noreferrer">{REFS.alteredImmunocompetence.label}</a>
          {!withRecipe && (
            <>
              {' · '}
              <a href={REFS.asco.url} target="_blank" rel="noreferrer">{REFS.asco.label}</a>
              {' · '}
              <a href={REFS.nccn.url} target="_blank" rel="noreferrer">{REFS.nccn.label}</a>
              {' · '}
              <a href={REFS.idsa.url} target="_blank" rel="noreferrer">{REFS.idsa.label}</a>
            </>
          )}
        </div>
      </div>
      {withRecipe && <HctRecipe />}
    </>
  );
}
