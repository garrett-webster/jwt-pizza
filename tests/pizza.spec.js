import { test, expect } from 'playwright-test-coverage';
import { mockPizzaService } from './helpers/mockPizzaService.js';
import { accounts, login, submitLogin, submitRegistration, selectVeggie, checkoutVeggie, purchaseVeggie } from './helpers/pizzaActions.js';

test.beforeEach(async ({ page }) => {
    await mockPizzaService(page);
    await page.goto('/');
});

test('home page displays the JWT Pizza title', async ({ page }) => {
    await expect(page).toHaveTitle('JWT Pizza');
});

test.describe('Authentication', () => {
    test('rejects an incorrect password without signing in', async ({ page }) => {
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, { ...accounts.diner, password: 'wrong-password' });

        await expect(page.getByRole('main')).toContainText('Unauthorized');
        await expect(page.getByRole('link', { name: 'Logout' })).toHaveCount(0);
    });

    test('allows login after correcting an incorrect password', async ({ page }) => {
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await submitLogin(page, { ...accounts.diner, password: 'wrong-password' });
        await expect(page.getByRole('main')).toContainText('Unauthorized');

        await submitLogin(page, accounts.diner);

        await expect(page.getByRole('link', { name: 'KC', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
    });

    test('keeps the user signed in after a page reload', async ({ page }) => {
        await login(page);

        await page.reload();

        await expect(page.getByRole('link', { name: 'KC', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
    });

    test('logout clears the session across page reloads', async ({ page }) => {
        await login(page);

        await page.getByRole('link', { name: 'Logout' }).click();
        await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
        await page.reload();

        await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'KC', exact: true })).toHaveCount(0);
    });

    test('registers a new diner and signs them in', async ({ page }) => {
        await page.getByRole('link', { name: 'Register', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Welcome to the party', exact: true })).toBeVisible();

        await submitRegistration(page, { name: 'Testing', email: 'McTestFace@testing.com', password: 'testing' });

        await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
        await page.getByRole('link', { name: 'T', exact: true }).click();
        await expect(page.getByRole('main')).toContainText('Testing');
        await expect(page.getByRole('main')).toContainText('McTestFace@testing.com');
    });

    test('rejects registration with an existing email address', async ({ page }) => {
        await page.getByRole('link', { name: 'Register', exact: true }).click();

        await submitRegistration(page, { name: 'Another Diner', email: 'd@jwt.com', password: 'password' });

        await expect(page.getByRole('main')).toContainText('Email already registered');
        await expect(page.getByRole('link', { name: 'Logout' })).toHaveCount(0);
    });
});

test.describe('Checkout', () => {
    test('preserves the selected pizza when a guest logs in at checkout', async ({ page }) => {
        await selectVeggie(page);
        await page.getByRole('button', { name: 'Checkout' }).click();
        await expect(page).toHaveURL(/\/payment\/login$/);

        await submitLogin(page, accounts.franchisee);

        await expect(page).toHaveURL(/\/payment$/);
        await expect(page.locator('tbody')).toContainText('Veggie');
        await expect(page.locator('tfoot')).toContainText('1 pie');
    });

    test('shows the selected pizza, quantity, and total before payment', async ({ page }) => {
        await login(page, 'franchisee');

        await checkoutVeggie(page);

        await expect(page.locator('tbody')).toContainText('Veggie');
        await expect(page.locator('tfoot')).toContainText('1 pie');
        await expect(page.locator('tfoot')).toContainText('0.004 ₿');
        await expect(page.getByRole('button', { name: 'Pay now' })).toBeVisible();
    });

    test('submits the selected store and pizza and displays the order confirmation', async ({ page }) => {
        await login(page, 'franchisee');
        await checkoutVeggie(page);

        const [orderRequest] = await Promise.all([
            page.waitForRequest((request) => new URL(request.url()).pathname === '/api/order' && request.method() === 'POST'),
            page.getByRole('button', { name: 'Pay now' }).click(),
        ]);

        expect(orderRequest.postDataJSON()).toEqual({
            items: [{ menuId: 1, description: 'Veggie', price: 0.0038 }],
            storeId: '1',
            franchiseId: 1,
        });
        await expect(page.getByRole('heading', { name: 'Here is your JWT Pizza!', exact: true })).toBeVisible();
        await expect(page.getByRole('main')).toContainText('mock-pizza-jwt');
    });
});

test.describe('Pizza verification', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, 'franchisee');
        await purchaseVeggie(page);
    });

    test('shows a valid result for the delivered pizza JWT', async ({ page }) => {
        await page.getByRole('button', { name: 'Verify' }).click();

        await expect(page.getByRole('heading', { name: 'JWT Pizza - valid', exact: true })).toBeVisible();
        await expect(page.locator('#hs-jwt-modal pre')).toContainText('Veggie');
    });

    test('closes the verification dialog', async ({ page }) => {
        await page.getByRole('button', { name: 'Verify' }).click();
        // Preline must finish opening before its close action can run.
        await expect(page.locator('#hs-jwt-modal')).toHaveClass(/opened/);
        await expect(page.locator('#hs-jwt-modal > div')).toHaveCSS('opacity', '1');

        await page.getByRole('button', { name: 'Close', exact: true }).click();

        await expect(page.locator('#hs-jwt-modal')).toBeHidden();
    });
});

test.describe('Diner dashboard', () => {
    test('displays the signed-in user profile and franchise role', async ({ page }) => {
        await login(page, 'franchisee');

        await page.getByRole('link', { name: 'FO', exact: true }).click();

        await expect(page.getByRole('main')).toContainText('Franchise Owner');
        await expect(page.getByRole('main')).toContainText('f@jwt.com');
        await expect(page.getByRole('main')).toContainText('Franchisee on 1');
    });

    test('links diners with no orders to the menu', async ({ page }) => {
        await login(page);
        await page.getByRole('link', { name: 'KC', exact: true }).click();
        await expect(page.getByRole('main')).toContainText('How have you lived this long without having a pizza?');

        await page.getByRole('link', { name: 'Buy one' }).click();

        await expect(page.getByRole('heading', { name: 'Awesome is a click away', exact: true })).toBeVisible();
    });

    test('lists a purchased pizza in order history', async ({ page }) => {
        await login(page, 'franchisee');
        await purchaseVeggie(page);

        await page.getByRole('link', { name: 'FO', exact: true }).click();

        await expect(page.locator('tbody tr')).toHaveCount(1);
        await expect(page.locator('tbody')).toContainText('23');
        await expect(page.locator('tbody')).toContainText('0.004 ₿');
    });
});

test.describe('Franchise stores', () => {
    test.beforeEach(async ({ page }) => {
        await page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Franchise' }).click();
        await page.getByRole('link', { name: 'login', exact: true }).click();
        await submitLogin(page, accounts.franchisee);
        await expect(page.getByRole('heading', { name: 'pizzaPocket', exact: true })).toBeVisible();
    });

    test('adds a newly created store to the franchise dashboard', async ({ page }) => {
        await page.getByRole('button', { name: 'Create store' }).click();
        await page.getByRole('textbox', { name: 'store name' }).fill('New Store For Sure');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'pizzaPocket', exact: true })).toBeVisible();
        await expect(page.getByRole('row', { name: 'New Store For Sure 0 ₿ Close' })).toBeVisible();
        await expect(page.getByRole('row', { name: 'SLC 0.004 ₿ Close' })).toBeVisible();
    });

    test('removes a store after confirming its closure', async ({ page }) => {
        await page.getByRole('row', { name: 'SLC 0.004 ₿ Close' }).getByRole('button', { name: 'Close' }).click();
        await expect(page.getByRole('heading', { name: 'Sorry to see you go', exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Close', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'pizzaPocket', exact: true })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'SLC', exact: true })).toHaveCount(0);
        await expect(page.locator('tbody tr')).toHaveCount(0);
    });
});

test.describe('Admin franchises', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, 'admin');
        await page.getByRole('link', { name: 'Admin', exact: true }).click();
        await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen", exact: true })).toBeVisible();
    });

    test('displays existing franchises in the admin dashboard', async ({ page }) => {
        await expect(page.getByRole('cell', { name: 'pizzaPocket', exact: true })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'SLC', exact: true })).toBeVisible();
    });

    test('adds a newly created franchise to the admin dashboard', async ({ page }) => {
        await page.getByRole('button', { name: 'Add Franchise' }).click();
        await expect(page.getByRole('heading', { name: 'Create franchise', exact: true })).toBeVisible();
        await page.getByPlaceholder('franchise name').fill('Test Pizza');
        await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');

        await page.getByRole('button', { name: 'Create', exact: true }).click();

        await expect(page.getByRole('cell', { name: 'Test Pizza', exact: true })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'pizzaPocket', exact: true })).toBeVisible();
    });

    test('filters franchises by name', async ({ page }) => {
        await page.getByPlaceholder('Filter franchises').fill('unknown');
        await page.getByRole('button', { name: 'Submit' }).click();
        await expect(page.locator('tbody')).toHaveCount(0);

        await page.getByPlaceholder('Filter franchises').fill('pocket');
        await page.getByRole('button', { name: 'Submit' }).click();

        await expect(page.locator('tbody')).toHaveCount(1);
        await expect(page.getByRole('cell', { name: 'pizzaPocket', exact: true })).toBeVisible();
    });

    test('removes a franchise after confirming its closure', async ({ page }) => {
        await page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'pizzaPocket', exact: true }) }).getByRole('button', { name: 'Close' }).click();
        await expect(page.getByRole('heading', { name: 'Sorry to see you go', exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Close', exact: true }).click();

        await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen", exact: true })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'pizzaPocket', exact: true })).toHaveCount(0);
        await expect(page.getByRole('cell', { name: 'SLC', exact: true })).toHaveCount(0);
    });
});

test.describe('API documentation', () => {
    for (const service of ['service', 'factory']) {
        test('displays ' + service + ' endpoint descriptions and examples', async ({ page }) => {
            await page.goto('/docs/' + service);

            await expect(page.getByRole('heading', { name: 'JWT Pizza API', exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { name: /\[POST\] \/api\/order/ })).toBeVisible();
            await expect(page.getByRole('main')).toContainText('Order a pizza');
            await expect(page.getByRole('main')).toContainText('mock-pizza-jwt');
        });
    }
});
