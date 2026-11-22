import { defineConfig } from 'vite';

// GitHub Pages serves the built app at https://hzmdin.github.io/WOCA/, so the
// production build (and `vite preview` of it) lives under /WOCA/.
// Development (npm run dev, start-woca.cmd) stays at the root: http://localhost:5173/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/WOCA/' : '/',
}));
