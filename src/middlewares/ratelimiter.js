import { rateLimit } from 'express-rate-limit';

export function rateLimiter(windowMs, limit) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    });
}
