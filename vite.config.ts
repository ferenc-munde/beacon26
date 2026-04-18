import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Custom plugin: copy src/puzzle-games/* to dist/puzzle-games/ after build
function copyPuzzleGames() {
  return {
    name: 'copy-puzzle-games',
    closeBundle() {
      const src = resolve(__dirname, 'src/puzzle-games');
      const dest = resolve(__dirname, 'dist/puzzle-games');
      copyDir(src, dest);
      console.log('[vite] Copied puzzle-games → dist/puzzle-games/');
    },
  };
}

function copyDir(src: string, dest: string) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [copyPuzzleGames()],
});