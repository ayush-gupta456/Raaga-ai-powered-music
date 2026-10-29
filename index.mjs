// Vercel's Express entrypoint. Initialization is lazy so builds never need secrets.
import { createApp } from './server/index.mjs';
export default createApp();
