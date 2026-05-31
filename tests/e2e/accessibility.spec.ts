import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility smoke', () => {
  test('main shell exposes core accessibility affordances', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: /skip to main content/i })).toBeAttached();
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByTestId('header-settings')).toBeVisible();
    await expect(page.getByTestId('header-notifications')).toBeVisible();
  });

  test('mobile shell exposes deterministic action selectors for navigation and header controls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('header-settings')).toBeVisible();
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-map')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-crime')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-cctv')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-settings')).toBeVisible();
  });

  test('main shell has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
});
