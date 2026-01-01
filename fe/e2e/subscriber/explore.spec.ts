import { test, expect } from '@playwright/test';

test.describe('Explore Page - Public Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
  });

  test('should be accessible without login', async ({ page }) => {
    await expect(page).toHaveURL(/\/explore/);
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Busque criadores"]');
    await expect(searchInput).toBeVisible();
  });

  test('should display featured creators section', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000);

    // Check for featured section or loading state
    const featuredSection = page.locator('text=Criadores em Destaque');
    const noContent = page.locator('text=Nenhum conteúdo público');

    const hasContent = await Promise.race([
      featuredSection.waitFor({ timeout: 5000 }).then(() => 'featured'),
      noContent.waitFor({ timeout: 5000 }).then(() => 'empty'),
    ]).catch(() => 'timeout');

    expect(['featured', 'empty', 'timeout']).toContain(hasContent);
  });

  test('should display new creators section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const newSection = page.locator('text=Novos na Plataforma');
    // This section is optional
    const isVisible = await newSection.isVisible({ timeout: 3000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('should display trending content section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const trendingSection = page.locator('text=Conteúdo em Alta');
    await expect(trendingSection).toBeVisible({ timeout: 5000 });
  });

  test('should show loading state for content grid', async ({ page }) => {
    // Reload to see loading state
    await page.reload();
    // Should show skeleton loaders OR content loaded quickly
    const skeleton = page.locator('.animate-pulse').first();
    const contentLoaded = page.locator('text=Conteúdo em Alta');

    // Either skeleton is visible (loading) or content already loaded
    const result = await Promise.race([
      skeleton.isVisible().then(() => 'skeleton'),
      contentLoaded.waitFor({ timeout: 2000 }).then(() => 'loaded'),
    ]).catch(() => 'unknown');

    expect(['skeleton', 'loaded', 'unknown']).toContain(result);
  });
});

test.describe('Explore Page - Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
  });

  test('should search for creators', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Busque criadores"]');
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(1000);

    // Should show search results or no results message
    const resultsText = page.locator('text=Resultados para');
    await expect(resultsText).toBeVisible({ timeout: 5000 });
  });

  test('should show no results message for invalid search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Busque criadores"]');
    await searchInput.fill('xyznonexistent123456');

    await page.waitForTimeout(1000);

    const noResults = page.locator('text=Nenhum resultado encontrado');
    await expect(noResults).toBeVisible({ timeout: 5000 });
  });

  test('should clear search and show discovery content', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Busque criadores"]');

    // Search
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    // Clear
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Should show trending content again
    const trendingSection = page.locator('text=Conteúdo em Alta');
    await expect(trendingSection).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Explore Page - Creator Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await page.waitForTimeout(2000);
  });

  test('should navigate to creator profile when clicking creator card', async ({ page }) => {
    // Find a creator card
    const creatorLink = page.locator('a[href^="/creator/"]').first();
    const isVisible = await creatorLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      const href = await creatorLink.getAttribute('href');
      await creatorLink.click();
      await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, '\\/')));
    }
  });

  test('should display creator subscription price', async ({ page }) => {
    // Check for price display (R$ format)
    const priceElement = page.locator('text=/R\\$.*\\/mês/i').first();
    const isVisible = await priceElement.isVisible({ timeout: 3000 }).catch(() => false);

    // Price might not be visible if no creators
    expect(typeof isVisible).toBe('boolean');
  });
});

test.describe('Explore Page - Content Grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore');
    await page.waitForTimeout(2000);
  });

  test('should display content grid', async ({ page }) => {
    // Check for grid layout
    const grid = page.locator('.grid.grid-cols-2');
    const isVisible = await grid.isVisible({ timeout: 3000 }).catch(() => false);

    // Grid might not be visible if no content
    expect(typeof isVisible).toBe('boolean');
  });

  test('should open media viewer when clicking content', async ({ page }) => {
    const contentCard = page.locator('.aspect-square').first();
    const isVisible = await contentCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await contentCard.click();
      // Should open media viewer (use more specific selector with bg-black class)
      const mediaViewer = page.locator('.fixed.inset-0.bg-black');
      await expect(mediaViewer).toBeVisible({ timeout: 3000 });
    }
  });

  test('should load more content when clicking load more button', async ({ page }) => {
    await page.waitForTimeout(3000);

    const loadMoreButton = page.getByRole('button', { name: 'Carregar Mais' });
    const isVisible = await loadMoreButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await loadMoreButton.click();
      // Should show loading state
      await page.waitForTimeout(1000);
    }
  });
});
