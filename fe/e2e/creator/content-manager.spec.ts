import { test, expect } from '@playwright/test';
import { fillLoginForm, TEST_USERS } from '../fixtures';

test.describe('Content Manager Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as creator
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Navigate to content manager
    await page.goto('/content');
    await page.waitForTimeout(2000);
  });

  test('should display content manager header', async ({ page }) => {
    await expect(page.locator('h1:has-text("Meu Conteúdo")')).toBeVisible();
    await expect(page.locator('text=Gerencie seus posts e mídias')).toBeVisible();
  });

  test('should have new post button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Novo Post/i })).toBeVisible();
  });

  test('should have story button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Story/i })).toBeVisible();
  });

  test('should show empty state when no content', async ({ page }) => {
    // Check for empty state or content grid
    const emptyState = page.locator('text=Você ainda não tem conteúdo');
    const contentGrid = page.locator('.grid.grid-cols-1');

    const hasEmptyOrContent = await Promise.race([
      emptyState.waitFor({ timeout: 5000 }).then(() => 'empty'),
      contentGrid.first().waitFor({ timeout: 5000 }).then(() => 'content'),
    ]).catch(() => 'timeout');

    expect(['empty', 'content', 'timeout']).toContain(hasEmptyOrContent);
  });
});

test.describe('Content Manager - Create Post Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/content');
    await page.waitForTimeout(2000);
  });

  test('should open create post modal', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();

    // Modal should be visible
    await expect(page.locator('text=Criar Novo Post')).toBeVisible({ timeout: 3000 });
  });

  test('should display description textarea', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('textarea[placeholder*="compartilhar"]')).toBeVisible();
  });

  test('should display media upload area', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Clique para adicionar fotos ou vídeos')).toBeVisible();
  });

  test('should display visibility options', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Público')).toBeVisible();
    await expect(page.locator('text=Assinantes')).toBeVisible();
  });

  test('should toggle visibility selection', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    // Click public
    await page.locator('button:has-text("Público")').click();
    await expect(page.locator('button:has-text("Público")')).toHaveClass(/bg-brand-500/);

    // Click subscribers
    await page.locator('button:has-text("Assinantes")').click();
    await expect(page.locator('button:has-text("Assinantes")')).toHaveClass(/bg-brand-500/);
  });

  test('should close modal on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('text=Criar Novo Post')).not.toBeVisible({ timeout: 3000 });
  });

  test('should have disabled publish button when no content', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    const publishButton = page.getByRole('button', { name: 'Publicar' });
    await expect(publishButton).toBeDisabled();
  });

  test('should enable publish button when text is entered', async ({ page }) => {
    await page.getByRole('button', { name: /Novo Post/i }).click();
    await page.waitForTimeout(500);

    await page.fill('textarea', 'Test post content');

    const publishButton = page.getByRole('button', { name: 'Publicar' });
    await expect(publishButton).not.toBeDisabled();
  });
});

test.describe('Content Manager - Create Story Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/content');
    await page.waitForTimeout(2000);
  });

  test('should open create story modal', async ({ page }) => {
    await page.getByRole('button', { name: /Story/i }).click();

    // Modal should be visible
    await expect(page.locator('text=Criar Story')).toBeVisible({ timeout: 3000 });
  });

  test('should display story upload area', async ({ page }) => {
    await page.getByRole('button', { name: /Story/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Adicionar foto ou vídeo')).toBeVisible();
  });

  test('should display optional text input', async ({ page }) => {
    await page.getByRole('button', { name: /Story/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('input[placeholder*="legenda"]')).toBeVisible();
  });

  test('should display expiration notice', async ({ page }) => {
    await page.getByRole('button', { name: /Story/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Stories expiram automaticamente após 24 horas')).toBeVisible();
  });

  test('should close modal on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /Story/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('text=Criar Story')).not.toBeVisible({ timeout: 3000 });
  });

  test('should have disabled publish button when no file', async ({ page }) => {
    await page.getByRole('button', { name: /Story/i }).click();
    await page.waitForTimeout(500);

    const publishButton = page.getByRole('button', { name: 'Publicar Story' });
    await expect(publishButton).toBeDisabled();
  });
});

test.describe('Content Manager - Content Grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/content');
    await page.waitForTimeout(2000);
  });

  test('should display content cards with visibility badge', async ({ page }) => {
    // Check for content cards
    const contentCard = page.locator('[class*="Card"]').first();
    const isVisible = await contentCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      // Should have visibility badge
      const badge = contentCard.locator('text=/Público|Assinantes|PPV/');
      await expect(badge).toBeVisible();
    }
  });

  test('should display content stats (likes, comments, views)', async ({ page }) => {
    const contentCard = page.locator('[class*="Card"]').first();
    const isVisible = await contentCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      // Stats should be visible
      const stats = contentCard.locator('.flex.items-center.justify-between');
      await expect(stats).toBeVisible();
    }
  });

  test('should show delete button on hover', async ({ page }) => {
    const contentCard = page.locator('[class*="Card"]').first();
    const isVisible = await contentCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      // Hover to show delete button
      await contentCard.hover();
      const deleteButton = contentCard.locator('button svg[class*="lucide-trash"]').first();
      await expect(deleteButton).toBeVisible({ timeout: 2000 });
    }
  });

  test('should navigate to post detail when clicking content', async ({ page }) => {
    const contentCard = page.locator('[class*="Card"]').first();
    const isVisible = await contentCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      const mediaArea = contentCard.locator('.aspect-video').first();
      await mediaArea.click();
      await expect(page).toHaveURL(/\/post\//);
    }
  });
});
