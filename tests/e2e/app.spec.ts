import { test, expect } from '@playwright/test';

test.describe('Godseye Holborn - E2E shell smoke', () => {
  test('loads the application shell and header content', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Godseye/i);
    await expect(page.getByText('Godseye')).toBeVisible();
    if (!testInfo.project.name.toLowerCase().includes('mobile')) {
      await expect(page.locator('header').getByText('Holborn, London')).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /skip to main content/i })).toBeAttached();
  });

  test('shows desktop side panels and map container', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const leftPanel = page.locator('aside').first();
    const rightPanel = page.locator('aside').nth(1);

    await expect(leftPanel.getByText('Live Monitoring').first()).toBeVisible();
    await expect(rightPanel.getByRole('heading', { name: 'CCTV Feeds' })).toBeVisible();
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('shows mobile bottom navigation and switches sections', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const mobileNav = page.getByTestId('mobile-bottom-nav');
    const appHeader = page.getByTestId('app-header');

    await expect(mobileNav).toBeVisible();
    await expect(appHeader).toBeVisible();
    await expect(page.getByTestId('mobile-nav-map')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-crime')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-cctv')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-settings')).toBeVisible();

    await page.getByTestId('mobile-nav-crime').click();
    await expect(page.getByTestId('mobile-crime-sheet')).toBeVisible();
    await expect(appHeader).toBeVisible();
    await expect(mobileNav).toBeVisible();
    await expect(page.getByText('Crime Incidents').first()).toBeVisible();

    await page.getByTestId('mobile-nav-cctv').click();
    await expect(page.getByTestId('mobile-cctv-sheet')).toBeVisible();
    await expect(appHeader).toBeVisible();
    await expect(mobileNav).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CCTV Feeds' }).first()).toBeVisible();
  });
});
