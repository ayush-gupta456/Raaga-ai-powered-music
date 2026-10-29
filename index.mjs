// Vercel's Express entrypoint. Initialization is lazy so builds never need secrets.
import express from 'express';
import { createApp } from './server/index.mjs';
const app = express();
app.disable('x-powered-by');
app.use(createApp());
export default app;
