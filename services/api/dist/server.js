"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_js_1 = require("./routes/api.js");
const matching_routes_js_1 = require("./modules/matching/matching.routes.js");
const allocations_routes_js_1 = require("./routes/allocations.routes.js");
const decision_routes_js_1 = require("./modules/decision/decision.routes.js");
const zod_1 = require("zod");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// API Routes
app.use('/api', api_js_1.apiRouter);
app.use('/api/matching', matching_routes_js_1.matchingRouter);
app.use('/api/allocations', allocations_routes_js_1.allocationsRouter);
app.use('/api/decision', decision_routes_js_1.decisionRouter);
// Base route
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'SAKSHAM Emergency Response API System',
        version: '1.0.0',
    });
});
// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err);
    if (err instanceof zod_1.ZodError) {
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
