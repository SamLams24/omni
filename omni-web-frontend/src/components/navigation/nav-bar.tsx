"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApiRequest } from "@/lib/api/browser-client";
import { useCurrentUser, CURRENT_USER_QUERY_KEY } from "@/hooks/use-current-user";

function resolveDashboard(roles: string[]): { href: string; labelKey: "admin" | "seller" | "delivery" } | null {
  if (roles.includes("SUPER_ADMIN") || roles.includes("ADMIN")) {
    return { href: "/admin", labelKey: "admin" };
  }
  if (roles.includes("SELLER")) {
    return { href: "/seller", labelKey: "seller" };
  }
  if (roles.includes("DELIVERY")) {
    return { href: "/delivery", labelKey: "delivery" };
  }
  return null;
}

export function NavBar() {
  const t = useTranslations("nav");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  const logoutMutation = useMutation({
    mutationFn: () => {
      const csrfToken = /(?:^|; )omni_csrf=([^;]+)/.exec(document.cookie)?.[1];
      const headers = new Headers();
      if (csrfToken) {
        headers.set("X-CSRF-Token", decodeURIComponent(csrfToken));
      }
      return browserApiRequest<void>("/auth/logout", { method: "POST", headers });
    },
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
      router.push("/");
    },
  });

  const dashboard = user ? resolveDashboard(user.roles) : null;

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
      <Link href="/" className="text-sm font-semibold tracking-widest text-white">
        OMNI
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/map" className="text-neutral-300 hover:text-white">
          {t("map")}
        </Link>
        {dashboard ? (
          <Link href={dashboard.href} className="text-neutral-300 hover:text-white">
            {t(dashboard.labelKey)}
          </Link>
        ) : null}
        {user ? (
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            className="text-neutral-300 hover:text-white"
          >
            {t("logout")}
          </button>
        ) : (
          <>
            <Link href="/login" className="text-neutral-300 hover:text-white">
              {t("login")}
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-white px-3 py-1.5 text-neutral-950 hover:bg-neutral-200"
            >
              {t("register")}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
