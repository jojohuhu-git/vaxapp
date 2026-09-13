// @vitest-environment happy-dom
/**
 * HctRecipe.test.jsx — the post-transplant re-vaccination plan component.
 * Covers a rendering-only bug found while adding a second citation to the
 * MenACWY/MenB rows: multiple refs on one item rendered with no separator,
 * gluing consecutive link labels together.
 */
import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import HctRecipe from '../HctRecipe';

test('renders a visible separator between multiple citations on one row', () => {
  const { container } = render(<HctRecipe />);
  const menAcwyRow = [...container.querySelectorAll('.hct-recipe-row')]
    .find(row => row.querySelector('.hct-recipe-vax').textContent === 'MenACWY');
  const links = menAcwyRow.querySelectorAll('.hct-recipe-refs a');
  expect(links.length).toBe(2);
  expect(menAcwyRow.querySelector('.hct-recipe-refs').textContent).toMatch(/\S · \S/);
});

test('a single-citation row renders with no stray separator', () => {
  const { container } = render(<HctRecipe />);
  const pcvRow = [...container.querySelectorAll('.hct-recipe-row')]
    .find(row => row.querySelector('.hct-recipe-vax').textContent === 'Pneumococcal (PCV)');
  const links = pcvRow.querySelectorAll('.hct-recipe-refs a');
  expect(links.length).toBe(1);
  expect(pcvRow.querySelector('.hct-recipe-refs').textContent).not.toMatch(/·/);
});
