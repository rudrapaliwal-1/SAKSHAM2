import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api.js';
import { matchingRouter } from './modules/matching/matching.routes.js';
import { allocationsRouter } from './routes/allocations.routes.js';
import { decisionRouter } from './modules/decision/decision.routes.js';
import { ZodError } from 'zod';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', apiRouter);
app.use('/api/matching', matchingRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/decision', decisionRouter);

// Base route
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'SAKSHAM Emergency Response API System',
    version: '1.0.0',
  });
});

// Centralized error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload values.',
        details: err.flatten().fieldErrors,
      },
    });
  }

  // Handle typical prisma errors or connection issues
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database constraint error occurred.',
      },
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 SAKSHAM API running on http://localhost:${PORT} in ${process.env.NODE_ENV} mode.`);
});
