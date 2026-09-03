import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // node environment supports WebCrypto (SubtleCrypto X25519) natively in Node 20+
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
});
