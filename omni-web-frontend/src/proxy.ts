import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same behavior, new file
// convention). next-intl's `createMiddleware` returns a handler compatible
// with the Proxy signature, so it is exported directly as the default export.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
