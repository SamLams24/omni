import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "./get-current-user";
import type { CurrentUser, UserRole } from "@/types/auth";

/**
 * Server Component guard: redirects to /login when there's no session, or
 * home when the user lacks every role in `roles`. Real enforcement always
 * happens on the backend too -- this only prevents an unauthorized user
 * from seeing a page shell that would immediately fail its own fetches.
 */
export async function requireUser(roles?: UserRole[]): Promise<CurrentUser> {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  if (!user) {
    redirect({ href: "/login", locale });
    // next-intl's redirect() is typed to return `never`, but generic
    // inference through createNavigation() doesn't always let tsc trust
    // that at the call site -- this throw is unreachable at runtime
    // (redirect() itself throws NEXT_REDIRECT) but keeps `user` narrowed
    // to non-null below without a type assertion.
    throw new Error("unreachable");
  }
  if (roles && !roles.some((role) => user.roles.includes(role))) {
    redirect({ href: "/", locale });
    throw new Error("unreachable");
  }
  return user;
}
