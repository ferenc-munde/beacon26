import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'game.html',
      },
    },
  },
  plugins: [
    {
      name: 'game-route-dev',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/game' || req.url?.startsWith('/game?')) {
            req.url = '/game.html';
          }
          next();
        });
      },
    },
  ],
});
