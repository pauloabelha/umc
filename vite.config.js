import {defineConfig} from 'vite';
export default defineConfig({build: {rollupOptions: {input: {home: 'index.html', simulator: 'simulator/index.html', machine: 'simulator/machine.html', logic: 'simulator/logic.html'}}}});
