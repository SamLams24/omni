"use client";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * Catches errors thrown by the root layout itself (e.g. [locale]/layout.tsx
 * failing before NextIntlClientProvider mounts). Must define its own
 * html/body and cannot rely on translations -- static bilingual copy.
 */
export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col items-center justify-center gap-4 bg-neutral-950 px-6 py-16 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          500
        </p>
        <h1 className="text-2xl font-semibold">
          Une erreur est survenue / Something went wrong
        </h1>
        <p className="max-w-md text-neutral-400">
          Notre équipe a été notifiée. Veuillez réessayer.
          <br />
          Our team has been notified. Please try again.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Réessayer / Try again
        </button>
      </body>
    </html>
  );
}
