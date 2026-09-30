import { expect } from 'playwright-test-coverage';

export const menu = [
    { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
    { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
];

// Each test gets its own users, session, franchises, stores, and orders.
export async function mockPizzaService(page) {
    const users = [
        { id: 1, name: 'Admin User', email: 'a@jwt.com', password: 'admin', roles: [{ role: 'admin' }] },
        { id: 2, name: 'Franchise Owner', email: 'f@jwt.com', password: 'franchisee', roles: [{ role: 'franchisee', objectId: 1 }] },
        { id: 3, name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: 'diner' }] },
    ];
    let franchises = [
        { id: 1, name: 'pizzaPocket', admins: [{ id: 2, name: 'Franchise Owner', email: 'f@jwt.com' }], stores: [{ id: 1, name: 'SLC', totalRevenue: 0.004 }] },
    ];
    let loggedInUser = null;
    let nextStoreId = 2;
    let nextFranchiseId = 2;
    let nextOrderId = 23;
    const orders = [];
    const token = 'mock-session-token';
    const jwt = 'mock-pizza-jwt';

    function publicUser(user) {
        const { password, ...profile } = user;
        return profile;
    }

    await page.route(/\/api\//, async (route) => {
        const request = route.request();
        const { pathname, searchParams } = new URL(request.url());
        const method = request.method();
        const endpoint = `${method} ${pathname}`;
        const json = (body, status = 200) => route.fulfill({ status, json: body });

        if (pathname === '/api/auth') {
            if (method === 'PUT') {
                const body = request.postDataJSON();
                expect(Object.keys(body).sort()).toEqual(['email', 'password']);
                const user = users.find((user) => user.email === body.email && user.password === body.password);
                if (!user) return json({ message: 'Unauthorized' }, 401);
                loggedInUser = publicUser(user);
                return json({ user: loggedInUser, token });
            }
            if (method === 'POST') {
                const body = request.postDataJSON();
                expect(Object.keys(body).sort()).toEqual(['email', 'name', 'password']);
                if (users.some((user) => user.email === body.email)) return json({ message: 'Email already registered' }, 409);
                const user = { ...body, id: users.length + 1, roles: [{ role: 'diner' }] };
                users.push(user);
                loggedInUser = publicUser(user);
                return json({ user: loggedInUser, token });
            }
            if (method === 'DELETE') {
                expect(request.headers().authorization).toBe(`Bearer ${token}`);
                loggedInUser = null;
                return json({ message: 'Logged out' });
            }
        }

        if (endpoint === 'GET /api/order/menu') return json(menu);

        if (endpoint === 'GET /api/franchise') {
            const pageNumber = Number(searchParams.get('page'));
            const limit = Number(searchParams.get('limit'));
            expect(pageNumber).toBeGreaterThanOrEqual(0);
            expect(limit).toBeGreaterThan(0);
            const name = searchParams.get('name');
            expect(name).not.toBeNull();
            const filtered = franchises.filter((franchise) => franchise.name.toLowerCase().includes(name.replaceAll('*', '').toLowerCase()));
            const start = pageNumber * limit;
            return json({ franchises: filtered.slice(start, start + limit), more: start + limit < filtered.length });
        }

        if (endpoint === 'POST /api/order/verify') {
            expect(request.postDataJSON()).toEqual({ jwt });
            return json({ message: 'valid', payload: { order: orders.at(-1)?.order } });
        }

        if (endpoint === 'GET /api/docs') {
            return json({ endpoints: [{ requiresAuth: true, method: 'POST', path: '/api/order', description: 'Order a pizza', example: '{ "items": [] }', response: { jwt } }] });
        }

        const protectedEndpoint = pathname === '/api/user/me' || pathname === '/api/order' || pathname.startsWith('/api/franchise');
        if (protectedEndpoint) {
            if (!loggedInUser) return json({ message: 'Unauthorized' }, 401);
            expect(request.headers().authorization).toBe(`Bearer ${token}`);
        }

        if (endpoint === 'GET /api/user/me') return json(loggedInUser);
        if (endpoint === 'GET /api/order') {
            return json({ id: loggedInUser.id, dinerId: loggedInUser.id, orders: orders.filter((entry) => entry.dinerId === loggedInUser.id).map((entry) => entry.order) });
        }
        if (endpoint === 'POST /api/order') {
            const body = request.postDataJSON();
            expect(Object.keys(body).sort()).toEqual(['franchiseId', 'items', 'storeId']);
            const franchise = franchises.find((franchise) => franchise.id === body.franchiseId);
            expect(franchise?.stores.some((store) => String(store.id) === body.storeId)).toBe(true);
            expect(body.items.length).toBeGreaterThan(0);
            for (const item of body.items) {
                const pizza = menu.find((pizza) => pizza.id === item.menuId);
                expect(pizza).toBeDefined();
                expect(item).toEqual({ menuId: pizza.id, description: pizza.title, price: pizza.price });
            }
            const order = { ...body, id: nextOrderId++, date: '2026-09-30T12:00:00Z' };
            orders.push({ dinerId: loggedInUser.id, order });
            return json({ order, jwt });
        }

        if (endpoint === 'GET /api/franchise/2') {
            return json(franchises.filter((franchise) => franchise.admins.some((admin) => admin.id === loggedInUser.id)));
        }

        if (endpoint === 'POST /api/franchise') {
            expect(loggedInUser.roles).toContainEqual({ role: 'admin' });
            const body = request.postDataJSON();
            expect(body).toEqual({ id: '', name: expect.any(String), stores: [], admins: [{ email: expect.any(String) }] });
            const franchise = { ...body, id: nextFranchiseId++ };
            franchises.push(franchise);
            return json(franchise);
        }

        const storePath = pathname.match(/^\/api\/franchise\/(\d+)\/store(?:\/(\d+))?$/);
        if (storePath) {
            const franchise = franchises.find((franchise) => franchise.id === Number(storePath[1]));
            expect(franchise).toBeDefined();
            expect(loggedInUser.roles.some((role) => role.role === 'admin' || (role.role === 'franchisee' && role.objectId === franchise.id))).toBe(true);
            if (method === 'POST' && !storePath[2]) {
                const body = request.postDataJSON();
                expect(body).toEqual({ id: '', name: expect.any(String) });
                const store = { ...body, id: nextStoreId++, totalRevenue: 0 };
                franchise.stores.push(store);
                return json(store);
            }
            if (method === 'DELETE' && storePath[2]) {
                expect(franchise.stores.some((store) => store.id === Number(storePath[2]))).toBe(true);
                franchise.stores = franchise.stores.filter((store) => store.id !== Number(storePath[2]));
                return json({ message: 'Store closed' });
            }
        }

        if (method === 'DELETE' && /^\/api\/franchise\/\d+$/.test(pathname)) {
            expect(loggedInUser.roles).toContainEqual({ role: 'admin' });
            const id = Number(pathname.split('/').at(-1));
            expect(franchises.some((franchise) => franchise.id === id)).toBe(true);
            franchises = franchises.filter((franchise) => franchise.id !== id);
            return json({ message: 'Franchise closed' });
        }

        await route.abort();
        throw new Error(`Unexpected API request: ${endpoint}`);
    });
}
