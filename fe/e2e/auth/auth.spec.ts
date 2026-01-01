import { test, expect } from '@playwright/test';
import { fillLoginForm, fillRegisterForm, selectAccountType, TEST_USERS } from '../fixtures';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display landing page with branding', async ({ page }) => {
    await expect(page.locator('text=VIPS')).toBeVisible();
    await expect(page.locator('text=.lat')).toBeVisible();
    await expect(page.locator('text=Monetize sua')).toBeVisible();
  });

  test('should have login and register buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar Conta' })).toBeVisible();
  });

  test('should navigate to login form', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Bem-vindo de volta')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should navigate to register form', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await expect(page.locator('text=Crie sua conta')).toBeVisible();
  });
});

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
  });

  test('should display login form elements', async ({ page }) => {
    await expect(page.locator('text=Bem-vindo de volta')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Email inválido')).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Email inválido')).toBeVisible();
  });

  test('should show error for wrong credentials', async ({ page }) => {
    await fillLoginForm(page, 'wrong@email.com', 'wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Wait for API response
    await expect(page.locator('.bg-red-500\\/10')).toBeVisible({ timeout: 5000 });
  });

  test('should allow switching to register form', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.locator('text=Crie sua conta')).toBeVisible();
  });

  test('should allow going back to landing', async ({ page }) => {
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await expect(page.locator('text=Monetize sua')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await fillLoginForm(page, TEST_USERS.subscriber.email, TEST_USERS.subscriber.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Should redirect to feed for subscriber
    await expect(page).toHaveURL(/\/(feed|dashboard)/, { timeout: 10000 });
  });
});

test.describe('Register Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar Conta' }).click();
  });

  test('should display register form elements', async ({ page }) => {
    await expect(page.locator('text=Crie sua conta')).toBeVisible();
    await expect(page.locator('input[placeholder="Seu Nome"]')).toBeVisible();
    await expect(page.locator('input[placeholder="seu_username"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should display account type selection', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sou Criador' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sou Assinante' })).toBeVisible();
  });

  test('should toggle account type selection', async ({ page }) => {
    // Default should be subscriber
    const subscriberBtn = page.getByRole('button', { name: 'Sou Assinante' });
    const creatorBtn = page.getByRole('button', { name: 'Sou Criador' });

    // Click creator
    await creatorBtn.click();
    await expect(creatorBtn).toHaveClass(/border-brand-500/);

    // Click subscriber
    await subscriberBtn.click();
    await expect(subscriberBtn).toHaveClass(/border-brand-500/);
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Cadastrar Gratuitamente' }).click();
    await expect(page.locator('text=Nome deve ter pelo menos 2 caracteres')).toBeVisible();
  });

  test('should validate username format', async ({ page }) => {
    await page.fill('input[placeholder="Seu Nome"]', 'Test User');
    await page.fill('input[placeholder="seu_username"]', 'invalid username!');
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: 'Cadastrar Gratuitamente' }).click();
    await expect(page.locator('text=Apenas letras, números e _')).toBeVisible();
  });

  test('should validate password length', async ({ page }) => {
    await page.fill('input[placeholder="Seu Nome"]', 'Test User');
    await page.fill('input[placeholder="seu_username"]', 'test_user');
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'short');
    await page.getByRole('button', { name: 'Cadastrar Gratuitamente' }).click();
    await expect(page.locator('text=Senha deve ter pelo menos 8 caracteres')).toBeVisible();
  });

  test('should allow switching to login form', async ({ page }) => {
    await page.getByRole('button', { name: 'Fazer login' }).click();
    await expect(page.locator('text=Bem-vindo de volta')).toBeVisible();
  });

  test('should change button text based on account type', async ({ page }) => {
    // Default is subscriber
    await expect(page.getByRole('button', { name: 'Cadastrar Gratuitamente' })).toBeVisible();

    // Switch to creator
    await page.getByRole('button', { name: 'Sou Criador' }).click();
    await expect(page.getByRole('button', { name: 'Criar Conta de Criador' })).toBeVisible();
  });
});

test.describe('Authenticated Redirect', () => {
  test('should redirect authenticated subscriber to feed', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.subscriber.email, TEST_USERS.subscriber.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Should be on feed
    await expect(page).toHaveURL(/\/feed/, { timeout: 10000 });

    // Try to access landing page
    await page.goto('/');
    // Should redirect back to feed
    await expect(page).toHaveURL(/\/feed/, { timeout: 5000 });
  });

  test('should redirect authenticated creator to dashboard', async ({ page }) => {
    // Login as creator
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await fillLoginForm(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
