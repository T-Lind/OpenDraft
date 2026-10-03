import { expect, test, type Page } from '@playwright/test';

function captureBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(message.text());
  });
  return failures;
}

test('landing, policies, and mobile layout render without browser failures', async ({ page }) => {
  const failures = captureBrowserFailures(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Write. Read. Help someone’s next draft.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Critique inline' })).toBeVisible();

  await page.getByRole('button', { name: 'Join OpenDraft' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);

  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Human writing, critique, and AI disclosure' })).toBeVisible();
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  expect(failures).toEqual([]);
});

test('a new writer can onboard and persist a private draft', async ({ page }) => {
  const failures = captureBrowserFailures(page);
  await page.goto('/signin-with-chatgpt?return_to=%2F%23Dashboard');

  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible();
  await page.getByLabel('Pen name').fill('CI Writer');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What do you love to write?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Your next draft starts here.' })).toBeVisible();
  await page.getByLabel(/I am at least 13/).check();
  await page.getByRole('button', { name: /Go to my dashboard/ }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Share your writing' }).click();
  await expect(page.getByRole('heading', { name: 'A new draft' })).toBeVisible();
  await page.getByLabel('A title for your work').fill('The CI Lantern');
  await page.getByRole('textbox', { name: 'Your writing' }).fill('The lantern stayed lit through the rain, waiting for a traveler who knew its name.');
  await page.getByLabel('What would you like feedback on?').fill('Does the opening create a clear mood?');
  await expect(page.getByText('Saved privately', { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.getByRole('heading', { name: 'Your writing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The CI Lantern' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The CI Lantern' })).toBeVisible();
  expect(failures).toEqual([]);
});
