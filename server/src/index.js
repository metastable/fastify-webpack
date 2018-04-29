import fastify from 'fastify';
import * as fastifyAutoPush from 'fastify-auto-push';
import fastifyHelmet from 'fastify-helmet';
import fastifyCompress from 'fastify-compress';
import fastifyReact from 'fastify-react';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { description, version } from '../package.json';

const fsReadFile = promisify(fs.readFile);

const STATIC_DIR = path.resolve(__dirname, '../client/dist');
const CERTS_DIR = path.resolve(__dirname, './certs');
const PORT = 8080;

async function createServerOptions() {
	const readCertFile = (filename) => fsReadFile(path.resolve(CERTS_DIR, filename));

	const [key, cert] = await Promise.all([
		readCertFile('key.pem'),
		readCertFile('cert.pem'),
	]);

	return {
		key,
		cert,
	};
}

async function main() {
	const { key, cert } = await createServerOptions();

	const app = fastify({
		http2: true,
		https: { key, cert },
	});

	// # Fastify tips
	// ## Promise/async/await resolution
	// > Warning: You can't return undefined.
	// - https://www.fastify.io/docs/latest/Routes/#promise-resolution
	// - https://www.fastify.io/docs/latest/Routes/#async-await

	// AutoPush should be registered as the first in the middleware chain.
	app.register(fastifyAutoPush.staticServe, {
		root: STATIC_DIR,
	});

	// Add important security headers via helmet.
	app.register(fastifyHelmet);

	// Add compression utils (gzip, etc).
	app.register(fastifyCompress, {
		threshold: 150, // bytes; below this size will not be compressed
	});

	app.route({
		method: 'GET',
		url: '/server-version.json',
		schema: {
			response: {
				200: {
					type: 'object',
					properties: {
						version: { type: 'string' },
						description: { type: 'string' },
					},
				},
			},
		},
		handler: async (request, reply) => {
			reply.type('application/json').code(200)

			return {
				version,
				description,
			};
		},
	});

	// React server-side rendering support via Next Framework.
	app
		.register(fastifyReact)
		.after(() => {
			app.next('/hello') // `GET /hello` => `./pages/hello`
		})

	await app.listen(PORT);
	console.log(`Listening on port ${PORT}`);
}

main().catch((err) => {
	console.error(err);
});