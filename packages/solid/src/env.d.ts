// Upstream relies on `process.env.NODE_ENV` being replaced at build time (bundlers and Vite do).
declare const process: { env: { NODE_ENV?: string | undefined } };
