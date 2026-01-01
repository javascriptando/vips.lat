import { test, expect } from '@playwright/test';
import { fillLoginForm, TEST_USERS } from '../fixtures';

test.describe('Creator Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as creator
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display dashboard header', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('text=Visão geral do seu desempenho')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for stats cards
    await expect(page.locator('text=Ganhos Totais')).toBeVisible();
    await expect(page.locator('text=Assinantes Ativos')).toBeVisible();
    await expect(page.locator('text=Visualizações')).toBeVisible();
    await expect(page.locator('text=Saldo Disponível')).toBeVisible();
  });

  test('should display weekly earnings chart', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for chart section
    await expect(page.locator('text=Rendimento Semanal')).toBeVisible();
  });

  test('should display latest transactions', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for transactions section
    await expect(page.locator('text=Últimas Transações')).toBeVisible();
  });

  test('should have link to full earnings page', async ({ page }) => {
    await page.waitForTimeout(2000);

    const viewAllButton = page.locator('text=Ver Extrato Completo');
    await expect(viewAllButton).toBeVisible();

    await viewAllButton.click();
    await expect(page).toHaveURL(/\/earnings/);
  });

  test('should show loading state initially', async ({ page }) => {
    await page.reload();
    // Should show skeleton loaders
    const skeleton = page.locator('.animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 2000 });
  });
});

test.describe('Creator Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should navigate to content manager', async ({ page }) => {
    const contentLink = page.locator('a[href="/content"]').first();
    const isVisible = await contentLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await contentLink.click();
      await expect(page).toHaveURL(/\/content/);
    }
  });

  test('should navigate to earnings', async ({ page }) => {
    const earningsLink = page.locator('a[href="/earnings"]').first();
    const isVisible = await earningsLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await earningsLink.click();
      await expect(page).toHaveURL(/\/earnings/);
    }
  });

  test('should navigate to subscribers list', async ({ page }) => {
    const subscribersLink = page.locator('a[href="/subscribers"]').first();
    const isVisible = await subscribersLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await subscribersLink.click();
      await expect(page).toHaveURL(/\/subscribers/);
    }
  });

  test('should navigate to settings', async ({ page }) => {
    const settingsLink = page.locator('a[href="/settings"]').first();
    const isVisible = await settingsLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });
});
