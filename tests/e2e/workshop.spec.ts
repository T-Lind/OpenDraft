import { expect, test, type Page } from '@playwright/test';

function captureBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(message.text());
  });
  return failures;
}

async function registerWriter(page: Page, email: string, penName: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join OpenDraft' }).click();
  await page.getByRole('button', { name: 'Create an email account' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill('CI browser password 2026!');
  await page.getByLabel('Confirm password').fill('CI browser password 2026!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('link', { name: 'Open the development-only email link' }).click();
  await page.getByLabel('Pen name').fill(penName);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/I am at least 13/).check();
  await page.getByRole('button', { name: /Go to my dashboard/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('landing, policies, and mobile layout render without browser failures', async ({ page }) => {
  const failures = captureBrowserFailures(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Write. Read. Help someone’s next draft.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Critique inline' })).toBeVisible();

  await page.getByRole('button', { name: 'Join OpenDraft' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel(/^Password/)).toBeVisible();
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Join OpenDraft' }).click();
  await page.getByRole('button', { name: 'Create an email account' }).click();
  await expect(page.getByRole('heading', { name: 'Join the workshop.' })).toBeVisible();
  await page.getByLabel('Email').fill('ci-writer@example.test');
  await page.getByLabel(/^Password/).fill('CI browser password 2026!');
  await page.getByLabel('Confirm password').fill('CI browser password 2026!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('link', { name: 'Open the development-only email link' }).click();

  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible();
  await page.getByLabel('Pen name').fill('CI Writer');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What do you love to write?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Your next draft starts here.' })).toBeVisible();
  await page.getByLabel(/I am at least 13/).check();
  await page.getByRole('button', { name: /Go to my dashboard/ }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

  await page.getByRole('button', { name: 'Share your writing' }).click();
  await expect(page.getByRole('heading', { name: 'A new draft' })).toBeVisible();
  await page.getByLabel('A title for your work').fill('The CI Lantern');
  await page.getByRole('textbox', { name: 'Your writing' }).fill('The lantern stayed lit through the rain, waiting for a traveler who knew its name.');
  await page.getByLabel('What would you like feedback on?').fill('Does the opening create a clear mood?');
  await page.getByText('Submission settings', { exact: false }).click();
  await page.getByLabel(/^Writing process/).selectOption('mostly-ai');
  await expect(page.getByText('Generative AI produced most of the draft', { exact: false })).toBeVisible();
  await expect(page.getByText('Saved privately', { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.getByRole('heading', { name: 'Your writing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The CI Lantern' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The CI Lantern' })).toBeVisible();
  expect(failures).toEqual([]);
});

test('a line comment appears as an inline chip and the manuscript continues after it', async ({ page }, testInfo) => {
  const failures = captureBrowserFailures(page);
  await registerWriter(page, `ci-commenter-${Date.now()}-${testInfo.retry}@example.test`, 'CI Commenter');

  await page.getByRole('button', { name: 'Critique now' }).first().click();
  await page.locator('.work-title').filter({ hasText: 'The last light in the house' }).click();
  await page.locator('.story-cta .primary-button').click();
  await expect(page.getByRole('heading', { name: 'Write a critique' })).toBeVisible();
  await page.getByRole('button', { name: 'Start critique · hold a spot' }).click();
  await expect(page.getByText('Your critique spot is held', { exact: true })).toBeVisible();

  const firstParagraph = page.locator('.reader-manuscript .reader-text p').first();
  await firstParagraph.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node?.textContent) throw new Error('Expected manuscript text');
    const phrase = 'The light';
    const start = node.textContent.indexOf(phrase);
    if (start < 0) throw new Error(`Expected phrase: ${phrase}`);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + phrase.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  await page.locator('.annotate-rail-btn.cm').click();
  await page.getByLabel('Comment text').fill('This opening image lands.');
  await page.getByRole('button', { name: 'Add comment' }).click();

  const chip = firstParagraph.locator('.annotation-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText('This opening image lands.');
  await page.reload();
  await expect(chip).toHaveText('This opening image lands.');
  await expect(page.getByText('Your critique spot is held', { exact: true })).toBeVisible();
  expect(await page.locator('.annotation-margin, .annotation-margin-card').count()).toBe(0);
  expect(await chip.evaluate(element => ({
    livesInsideParagraph: element.parentElement?.matches('p[data-para="0"]') ?? false,
    followsCommentHighlight: !!element.previousElementSibling?.querySelector('.anno-comment'),
    manuscriptContinues: element.nextElementSibling !== null,
  }))).toEqual({ livesInsideParagraph: true, followsCommentHighlight: true, manuscriptContinues: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWidths = await page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>('.mobile-nav');
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      navigation: navigation?.scrollWidth ?? 0,
      navigationViewport: navigation?.clientWidth ?? 0,
    };
  });
  expect(mobileWidths.document).toBeLessThanOrEqual(mobileWidths.viewport);
  expect(mobileWidths.body).toBeLessThanOrEqual(mobileWidths.viewport);
  expect(mobileWidths.navigation).toBeLessThanOrEqual(mobileWidths.navigationViewport);
  await page.getByRole('button', { name: 'Release spot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start critique · hold a spot' })).toBeVisible();
  await expect(chip).toHaveText('This opening image lands.');
  expect(failures).toEqual([]);
});

test('phone navigation, reading preferences, and circle workshops work end to end', async ({ page }, testInfo) => {
  const failures = captureBrowserFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await registerWriter(page, `ci-mobile-${Date.now()}-${testInfo.retry}@example.test`, 'CI Mobile Writer');
  await expect(page.locator('.mobile-nav > button')).toHaveCount(5);
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.locator('.site-footer').getByRole('link', { name: 'Source code', exact: true })).toHaveAttribute('href', 'https://github.com/T-Lind/OpenDraft');
  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const footer = page.locator('.site-footer');
    expect(await footer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.topbar-actions').getByRole('button', { name: 'Reading and accessibility settings' }).click();
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const atBottom of [false, true]) {
      await page.locator('.preferences-fields').evaluate((element, bottom) => { element.scrollTop = bottom ? element.scrollHeight : 0; }, atBottom);
      const footer = await page.getByRole('button', { name: 'Done', exact: true }).evaluate(element => {
        const button = element.getBoundingClientRect();
        const navigation = document.querySelector('.mobile-nav')?.getBoundingClientRect();
        const topmost = document.elementFromPoint(button.x + button.width / 2, button.bottom - 2);
        return { bottom: button.bottom, navigationTop: navigation?.top ?? 0, unobscured: element.contains(topmost) };
      });
      expect(footer.bottom).toBeLessThan(footer.navigationTop);
      expect(footer.unobscured).toBe(true);
    }
  }
  await page.getByLabel('Manuscript font').selectOption('sans');
  await page.getByLabel('Reading text size').selectOption('extra-large');
  await page.getByLabel('Text spacing').selectOption('wide');
  await page.getByLabel('Line length').selectOption('narrow');
  await page.getByLabel('Higher contrast').check();
  await page.getByLabel('Reduce motion').check();
  await page.getByLabel('Underline text links').check();
  await page.getByLabel('Appearance').selectOption('dark');
  await expect(page.locator('.reading-preview')).toHaveCSS('font-size', '24px');
  await page.keyboard.press('Escape');
  await expect(page.locator('.topbar-actions').getByRole('button', { name: 'Reading and accessibility settings' })).toBeFocused();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-reading-size', 'extra-large');
  await expect(page.locator('html')).toHaveAttribute('data-reading-spacing', 'wide');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.locator('.mobile-nav').getByRole('button', { name: 'More destinations' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-nav').getByRole('button', { name: 'More destinations' })).toBeFocused();
  await page.locator('.mobile-nav').getByRole('button', { name: 'More destinations' }).click();
  await page.getByRole('button', { name: 'Your groups', exact: true }).click();
  await page.getByRole('button', { name: 'Start a circle' }).click();
  const circleName = `A CI Mobile Table ${Date.now()}`;
  await page.getByLabel('Circle name').fill(circleName);
  await page.getByLabel('What brings you together?').fill('An isolated browser-test workshop for close reading and revision.');
  await page.getByRole('button', { name: 'Create your circle' }).click();
  await page.locator('.circle-card').filter({ hasText: circleName }).getByRole('button', { name: 'Your circle' }).click();
  await page.getByRole('button', { name: 'Edit workshop brief' }).click();
  await page.getByLabel('Current workshop prompt').fill('Look closely at opening images and changes in narrative distance.');
  await page.getByLabel('Session agenda').fill('Check in, discuss the opening, then share a revision plan.');
  await page.getByLabel('Workshop meeting', { exact: true }).fill('2026-10-10T18:00');
  await page.getByLabel('Feedback due by').fill('2026-10-09T18:00');
  await page.getByLabel('Meeting place or call details').fill('Campus writing table');
  await page.getByRole('button', { name: 'Save workshop brief' }).click();
  await expect(page.getByText('Look closely at opening images and changes in narrative distance.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add a reading' }).click();
  await page.getByLabel('Find published writing').fill('The last light');
  await expect(page.getByLabel('Choose a reading').locator('option[value="the-last-light"]')).toHaveCount(1);
  await page.getByLabel('Choose a reading').selectOption('the-last-light');
  await page.getByRole('button', { name: 'Add to reading list' }).click();
  await expect(page.locator('.workshop-reading').filter({ hasText: 'The last light in the house' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Campus writing table', { exact: true })).toBeVisible();
  await expect(page.locator('.workshop-reading')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit workshop brief' }).click();
  await expect(page.getByLabel('Workshop meeting', { exact: true })).toHaveValue('2026-10-10T18:00');
  await expect(page.getByLabel('Feedback due by')).toHaveValue('2026-10-09T18:00');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Read & critique', exact: true }).click();
  await expect(page.locator('.story-read')).toHaveCSS('font-size', '24px');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Write', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your writing' })).toBeVisible();
  expect(failures).toEqual([]);
});
