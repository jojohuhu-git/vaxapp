// HctRecipe.jsx — the post-transplant re-vaccination plan, shown under the hard
// stop when HSCT is the reason for the stop. Advisory only: it never produces
// dates, never touches Today's Visit, the forecast or the PDF.
// See src/logic/hctRecipe.js for the plan itself and its sourcing.
import {
  HCT_RECIPE_TITLE,
  HCT_RECIPE_RESTART,
  HCT_RECIPE_NO_DATES,
  HCT_DEFER_TO_TEAM,
  HCT_RECIPE_TRANSPLANT_TYPE,
  HCT_RECIPE_GROUPS,
} from '../logic/hctRecipe';
import { REFS } from '../data/refs';

export default function HctRecipe() {
  return (
    <section className="hct-recipe" aria-label={HCT_RECIPE_TITLE}>
      <h3 className="hct-recipe-title">{HCT_RECIPE_TITLE}</h3>

      <p className="hct-recipe-coordinate">{HCT_DEFER_TO_TEAM}</p>

      <p className="hct-recipe-restart">{HCT_RECIPE_RESTART}</p>
      <p className="hct-recipe-note">{HCT_RECIPE_NO_DATES}</p>
      <p className="hct-recipe-note">{HCT_RECIPE_TRANSPLANT_TYPE}</p>

      {HCT_RECIPE_GROUPS.map(group => (
        <div className="hct-recipe-group" key={group.when}>
          <h4 className="hct-recipe-when">{group.when}</h4>
          <dl className="hct-recipe-list">
            {group.items.map(item => (
              <div className="hct-recipe-row" key={item.vax}>
                <dt className="hct-recipe-vax">{item.label}</dt>
                <dd className="hct-recipe-plan">
                  {item.plan}
                  {item.refs.length > 0 && (
                    <span className="hct-recipe-refs">
                      {item.refs.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ' · '}
                          <a
                            href={REFS[id].url}
                            target="_blank"
                            rel="noreferrer"
                            title={REFS[id].label}
                          >
                            {REFS[id].short || REFS[id].label}
                          </a>
                        </span>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
