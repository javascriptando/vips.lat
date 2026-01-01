import { test as base, expect, Page } from '@playwright/test';

// Test user credentials (must match seed data from be/src/db/seed.ts)
export const TEST_USERS = {
  subscriber: {
    email: 'subscriber@vips.lat',
    password: 'subscriber123456',
    name: 'Subscriber Test',
    username: 'subscribertest',
  },
  creator: {
    email: 'creator@vips.lat',
    password: 'creator123456',
    name: 'Creator Test',
    username: 'creatortest',
  },
};

// API base URL - uses environment variable or defaults to localhost
export const API_URL = process.env.API_URL || 'http://localhost:7777';

// Custom fixtures
interface AuthFixtures {
  authenticatedPage: Page;
  creatorPage: Page;
}

// Helper to login via API and set session
async function loginViaAPI(page: Page, email: string, password: string) {
  const response = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  // The session cookie should be set automatically
  return response.json();
}

// Extended test with auth fixtures
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await loginViaAPI(page, TEST_USERS.subscriber.email, TEST_USERS.subscriber.password);
    await page.goto('/feed');
    await use(page);
  },
  creatorPage: async ({ page }, use) => {
    await loginViaAPI(page, TEST_USERS.creator.email, TEST_USERS.creator.password);
    await page.goto('/dashboard');
    await use(page);
  },
});

export { expect };

// Helper functions
export async function waitForToast(page: Page, message?: string) {
  const toast = page.locator('[data-sonner-toast]');
  await expect(toast).toBeVisible();
  if (message) {
    await expect(toast).toContainText(message);
  }
}

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
}

export async function fillRegisterForm(
  page: Page,
  data: { name: string; username: string; email: string; password: string }
) {
  await page.fill('input[placeholder="Seu Nome"]', data.name);
  await page.fill('input[placeholder="seu_username"]', data.username);
  await page.fill('input[type="email"]', data.email);
  await page.fill('input[type="password"]', data.password);
}

export async function selectAccountType(page: Page, type: 'creator' | 'subscriber') {
  const buttonText = type === 'creator' ? 'Sou Criador' : 'Sou Assinante';
  await page.getByRole('button', { name: buttonText }).click();
}
