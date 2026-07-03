// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { VisitCardShell, DoseRow, ComboDoseRow } from '../VisitCard';

describe('VisitCardShell', () => {
  afterEach(() => { cleanup(); });

  it('renders label, date, and count', () => {
    const { getByText } = render(
      <VisitCardShell label="Visit 1 — Aug 15, 2026" dateLabel="Aug 15, 2026" countLabel="2 injections">
        <div>body content</div>
      </VisitCardShell>,
    );
    expect(getByText('Visit 1 — Aug 15, 2026')).toBeTruthy();
    expect(getByText('2 injections')).toBeTruthy();
    expect(getByText('body content')).toBeTruthy();
  });

  it('applies the curr modifier class when isCurr is true', () => {
    const { container } = render(
      <VisitCardShell label="Today" isCurr>
        <div />
      </VisitCardShell>,
    );
    expect(container.querySelector('.vcard.curr')).toBeTruthy();
  });

  it('applies the past modifier class when isPast is true', () => {
    const { container } = render(
      <VisitCardShell label="6 months" isPast>
        <div />
      </VisitCardShell>,
    );
    expect(container.querySelector('.vcard.past')).toBeTruthy();
  });

  it('shows a catch-up tag when isCatchup is true', () => {
    const { getByText } = render(
      <VisitCardShell label="4 years" isCatchup>
        <div />
      </VisitCardShell>,
    );
    expect(getByText('catch-up')).toBeTruthy();
  });

  it('shows an earliest tag when isScheduledEarly is true', () => {
    const { getByText } = render(
      <VisitCardShell label="4 years" isScheduledEarly>
        <div />
      </VisitCardShell>,
    );
    expect(getByText('earliest')).toBeTruthy();
  });

  it('omits the date span when dateLabel is not provided', () => {
    const { container } = render(
      <VisitCardShell label="Today">
        <div />
      </VisitCardShell>,
    );
    expect(container.querySelector('.vcard-date')).toBeNull();
  });
});

describe('DoseRow', () => {
  afterEach(() => { cleanup(); });

  it('renders vaccine key and dose chip text', () => {
    const { getByText } = render(<DoseRow vk="DTaP" chipText="D1/5" />);
    expect(getByText('DTaP')).toBeTruthy();
    expect(getByText('D1/5')).toBeTruthy();
  });

  it('renders brand text in parentheses when provided', () => {
    const { getByText } = render(<DoseRow vk="DTaP" chipText="D1/5" brandText="Pentacel" />);
    expect(getByText('(Pentacel)')).toBeTruthy();
  });

  it('omits brand text when not provided', () => {
    const { container } = render(<DoseRow vk="DTaP" chipText="D1/5" />);
    expect(container.querySelector('.vcard-dose-brand')).toBeNull();
  });

  it('renders passed-through right-slot content and fires its click handler', () => {
    let clicked = false;
    const { getByText } = render(
      <DoseRow vk="DTaP" chipText="D1/5" right={<button onClick={() => { clicked = true; }}>Why?</button>} />,
    );
    fireEvent.click(getByText('Why?'));
    expect(clicked).toBe(true);
  });
});

describe('ComboDoseRow', () => {
  afterEach(() => { cleanup(); });

  it('renders combo name and covered-dose text', () => {
    const { getByText } = render(<ComboDoseRow comboName="Pediarix" coveredText="DTaP D1, IPV D1, HepB D1" />);
    expect(getByText('Pediarix')).toBeTruthy();
    expect(getByText('DTaP D1, IPV D1, HepB D1')).toBeTruthy();
  });

  it('renders passed-through right-slot content', () => {
    const { getByText } = render(
      <ComboDoseRow comboName="Pediarix" coveredText="DTaP D1" right={<span>Why?</span>} />,
    );
    expect(getByText('Why?')).toBeTruthy();
  });
});
