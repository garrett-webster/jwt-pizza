import { test, expect } from 'playwright-test-coverage';
import { mockPizzaService } from './helpers/mockPizzaService.js';
import { accounts, login, submitLogin, submitRegistration } from './helpers/pizzaActions.js';

test.beforeEach(async ({ page }) => {
    await mockPizzaService(page);
    await page.goto('/');
});

async function openEditDialog(page, initials: string) {
    await page.getByRole('link', { name: initials, exact: true }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit user' })).toBeVisible();
}

async function submitUpdate(page, { name, email, password }: { name?: string; email?: string; password?: string }) {
    const dialog = page.getByRole('dialog');
    if (name !== undefined) await dialog.locator('input[type="text"]').first().fill(name);
    if (email !== undefined) await dialog.locator('input[type="email"]').fill(email);
    if (password !== undefined) await dialog.locator('#password').fill(password);
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('heading', { name: 'Edit user' })).toBeHidden();
}

async function logout(page) {
    await page.getByRole('link', { name: 'Logout' }).click();
    await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
}

test('updateUser', async ({ page }) => {
    await page.getByRole('link', { name: 'Register', exact: true }).click();
    await submitRegistration(page, { name: 'pizza diner', email: 'pd@jwt.com', password: 'diner' });

    await page.getByRole('link', { name: 'pd', exact: true }).click();

    await expect(page.getByRole('main')).toContainText('pizza diner');
});

test.describe('Updating a user', () => {
    test('updates the name of a diner', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');

        await submitUpdate(page, { name: 'Casey Jones' });

        await expect(page.getByRole('main')).toContainText('Casey Jones');
        await expect(page.getByRole('link', { name: 'CJ', exact: true })).toBeVisible();
    });

    test('updates the email address and signs in with the new one', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');

        await submitUpdate(page, { email: 'new@jwt.com' });
        await expect(page.getByRole('main')).toContainText('new@jwt.com');

        await logout(page);
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, { email: 'new@jwt.com', password: accounts.diner.password });
        await expect(page.getByRole('link', { name: 'KC', exact: true })).toBeVisible();
    });

    test('old email address no longer works after an update', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');
        await submitUpdate(page, { email: 'new@jwt.com' });

        await logout(page);
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, accounts.diner);

        await expect(page.getByRole('main')).toContainText('Unauthorized');
    });

    test('updates the password and signs in with the new one', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');

        await submitUpdate(page, { password: 'newpassword' });

        await logout(page);
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, { ...accounts.diner, password: accounts.diner.password });
        await expect(page.getByRole('main')).toContainText('Unauthorized');

        await submitLogin(page, { ...accounts.diner, password: 'newpassword' });
        await expect(page.getByRole('link', { name: 'KC', exact: true })).toBeVisible();
    });

    test('leaving the password blank keeps the existing password', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');

        await submitUpdate(page, { name: 'Kai Updated' });

        await logout(page);
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, accounts.diner);
        await expect(page.getByRole('link', { name: 'KU', exact: true })).toBeVisible();
    });

    test('rejects an email address that belongs to another user', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');

        await page.getByRole('dialog').locator('input[type="email"]').fill(accounts.admin.email);
        await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

        // The server rejects the change, so the profile must not show the other user's email.
        await expect(page.getByRole('main')).not.toContainText(accounts.admin.email);
    });

    test('persists updated details across a page reload', async ({ page }) => {
        await login(page, 'diner');
        await openEditDialog(page, 'KC');
        await submitUpdate(page, { name: 'Persisted Name' });

        await page.reload();

        await expect(page.getByRole('link', { name: 'PN', exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'PN', exact: true }).click();
        await expect(page.getByRole('main')).toContainText('Persisted Name');
    });
});

test.describe('Updating a user with different roles', () => {
    test('a franchisee can update their details and keeps the franchisee role', async ({ page }) => {
        await login(page, 'franchisee');
        await openEditDialog(page, 'FO');

        await submitUpdate(page, { name: 'Fran Chisee', email: 'fran@jwt.com' });

        await expect(page.getByRole('main')).toContainText('Fran Chisee');
        await expect(page.getByRole('main')).toContainText('fran@jwt.com');
        await expect(page.getByRole('main')).toContainText('Franchisee on 1');
    });

    test('a franchisee can sign in with an updated password', async ({ page }) => {
        await login(page, 'franchisee');
        await openEditDialog(page, 'FO');
        await submitUpdate(page, { password: 'franchisee2' });

        await logout(page);
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, { ...accounts.franchisee, password: 'franchisee2' });

        await expect(page.getByRole('link', { name: 'FO', exact: true })).toBeVisible();
    });

    test('an admin can update their details and keeps the admin role', async ({ page }) => {
        await login(page, 'admin');
        await openEditDialog(page, 'AU');

        await submitUpdate(page, { name: 'Super Admin', email: 'super@jwt.com' });

        await expect(page.getByRole('main')).toContainText('Super Admin');
        await expect(page.getByRole('main')).toContainText('super@jwt.com');
        await expect(page.getByRole('main')).toContainText('admin');
        await expect(page.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
    });

    test('a newly registered diner can update their details', async ({ page }) => {
        await page.getByRole('link', { name: 'Register', exact: true }).click();
        await submitRegistration(page, { name: 'New Diner', email: 'nd@jwt.com', password: 'secret' });
        await openEditDialog(page, 'ND');

        await submitUpdate(page, { name: 'Renamed Diner', password: 'secret2' });

        await expect(page.getByRole('main')).toContainText('Renamed Diner');
        await expect(page.getByRole('main')).toContainText('diner');
    });
});
