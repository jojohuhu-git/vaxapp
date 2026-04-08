export default function Disclaimer() {
  return (
    <div className="disc">
      <strong>Clinical Disclaimer:</strong> PediVax is an educational decision-support tool.
      It does NOT replace clinical judgment or official CDC/ACIP guidelines.
      Always verify recommendations against the current{' '}
      <a href="https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html" target="_blank" rel="noopener noreferrer">
        CDC Immunization Schedule
      </a>{' '}
      and consult{' '}
      <a href="https://www.immunize.org/ask-experts/" target="_blank" rel="noopener noreferrer">
        immunize.org Ask the Experts
      </a>{' '}
      for complex scenarios. The developers assume no liability for clinical decisions made using this tool.
    </div>
  );
}
