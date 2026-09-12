import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { verifyAccessToken } from "../utils/token";

// Rate-limiting by raw IP alone breaks down for this app: in production every
// office/VPN sits behind one NAT'd public IP, so express-rate-limit was
// lumping every employee behind that IP into a single shared bucket. A dozen
// people with dashboards, notification polling, and task boards open at once
// blew through the old 300-per-15-min ceiling in minutes, and everyone
// behind that IP started seeing 429s together — not because any one of them
// was abusing the API, but because the bucket had no notion of "user".
//
// Fix: key the bucket by the authenticated user (decoded straight from the
// access token, cheaply — no DB round trip) so each employee gets their own
// allowance. Requests with no/invalid token (public routes, login page,
// expired session) fall back to IP via ipKeyGenerator, which is still the
// right key for those and stays IPv6-safe.
function keyByUserOrIp(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(header.slice("Bearer ".length));
      return `user:${payload.sub}`;
    } catch {
      // Fall through to IP — expired/invalid tokens still hit this limiter
      // (auth itself runs later, per-route) and shouldn't crash it.
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

// Sized for real usage, not just abuse: a single active tab can easily
// generate a steady stream on its own — notification polling every 30s, an
// IT dashboard polling every 30s, a task detail view polling itself, its
// comment thread, and its attachment panel every 20s each — on top of normal
// clicking around. 400 requests per 5 minutes (80/min) comfortably covers
// that per user while still bounding a runaway script or scrape.
export const apiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
    errors: [],
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
    errors: [],
  },
});
