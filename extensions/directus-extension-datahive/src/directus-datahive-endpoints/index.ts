import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint((router) => {
	router.get('/lolilol', (_req, res) => res.send('Hello, World!'));
});
