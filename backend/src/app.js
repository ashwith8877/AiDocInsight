import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.isDev) {
  app.use(morgan('dev'));
}

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
