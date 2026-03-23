import { preview } from 'vite';
process.chdir('./web');
const server = await preview({ preview: { port: 5180 } });
server.printUrls();
