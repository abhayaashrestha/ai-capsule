import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import db from './db.js';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.routes.js';
import capsuleRoutes from './routes/capsules.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/api/capsules', capsuleRoutes);

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const clientDist = path.join(__dirname, '../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('Serving React build from', clientDist);
} else {
  console.log('No React build found — API only (run npm run dev in client/)');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
