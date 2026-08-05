import { authApiHandler } from "@neondatabase/auth/next";

const auth = authApiHandler({
  baseUrl: import.meta.env.VITE_NEON_AUTH_URL,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
    sameSite: "lax",
  },
});

export const GET = auth.GET;
export const POST = auth.POST;
export const PUT = auth.PUT;
export const DELETE = auth.DELETE;
export const PATCH = auth.PATCH;
