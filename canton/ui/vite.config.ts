import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dApp talks to the Daml JSON Ledger API (/v1 -> local sandbox) and reads the
// encrypted blob back from the Walrus aggregator (/walrus -> testnet aggregator).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1': { target: 'http://localhost:7575', changeOrigin: true },
      '/walrus': {
        target: 'https://aggregator.walrus-testnet.walrus.space',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/walrus/, ''),
      },
    },
  },
});
