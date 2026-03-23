import { createServer } from 'vite';
process.chdir('./web');
const server = await createServer({ server: { port: 5180 } });
await server.listen();
server.printUrls();
