import { test, expect } from '@playwright/test';

test.describe('camera snapshot visibility', () => {
  test('renders at least one visible snapshot image in CCTV feed cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const cctvRegion = page.getByRole('region', { name: /cctv camera feeds/i });
    await expect(cctvRegion).toBeVisible();
    const cameraCard = cctvRegion.getByRole('heading', { level: 3 }).first();
    await expect(cameraCard).toBeVisible({ timeout: 15000 });
    await cameraCard.click();

    const firstSnapshotImage = cctvRegion.locator('img[alt$="snapshot"]').first();
    await expect(firstSnapshotImage).toBeVisible({ timeout: 15000 });

    const dimensions = await firstSnapshotImage.evaluate(img => ({
      naturalWidth: (img as HTMLImageElement).naturalWidth,
      naturalHeight: (img as HTMLImageElement).naturalHeight,
      currentSrc: (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src,
    }));

    expect(dimensions.naturalWidth).toBeGreaterThan(0);
    expect(dimensions.naturalHeight).toBeGreaterThan(0);
    expect(dimensions.currentSrc.length).toBeGreaterThan(0);
  });
});
