import { expect } from 'playwright-test-coverage';

export const accounts = {
    diner: { email: 'd@jwt.com', password: 'a', initials: 'KC' },
    franchisee: { email: 'f@jwt.com', password: 'franchisee', initials: 'FO' },
    admin: { email: 'a@jwt.com', password: 'admin', initials: 'AU' },
};

export async function submitLogin(page, { email, password }) {
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
}

export async function login(page, account = 'diner') {
    await page.getByRole('link', { name: 'Login', exact: true }).click();
    await submitLogin(page, accounts[account]);
    await expect(page.getByRole('link', { name: accounts[account].initials, exact: true })).toBeVisible();
}

export async function submitRegistration(page, { name, email, password }) {
    await page.getByRole('textbox', { name: 'Full name' }).fill(name);
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Register', exact: true }).click();
}

export async function selectVeggie(page) {
    await page.getByRole('button', { name: 'Order now' }).click();
    await page.getByRole('combobox').selectOption('1');
    await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
}

export async function checkoutVeggie(page) {
    await selectVeggie(page);
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page.getByRole('heading', { name: 'So worth it', exact: true })).toBeVisible();
}

export async function purchaseVeggie(page) {
    await checkoutVeggie(page);
    await page.getByRole('button', { name: 'Pay now' }).click();
    await expect(page.getByRole('heading', { name: 'Here is your JWT Pizza!', exact: true })).toBeVisible();
}
