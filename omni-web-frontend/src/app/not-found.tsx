import Link from "next/link";
import "./globals.css";

/**
 * Root-level 404. Fires when the [locale] dynamic segment itself doesn't
 * match a supported locale (the layout that would provide html/body bails
 * out via notFound() before rendering), or for a path with no locale
 * prefix at all. No NextIntlClientProvider exists at this point, so the
 * copy is static and bilingual rather than translated.
 */
export default function RootNotFound() {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col items-center justify-center gap-4 bg-neutral-950 px-6 py-16 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          404
        </p>
        <h1 className="text-2xl font-semibold">
          Page introuvable / Page not found
        </h1>
        <p className="max-w-md text-neutral-400">
          La page que vous recherchez n&apos;existe pas.
          <br />
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            href="/fr"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Accueil
          </Link>
          <Link
            href="/en"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900"
          >
            Home
          </Link>
        </div>
      </body>
    </html>
  );
}
