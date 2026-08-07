import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverApiRequest } from "@/lib/api/server-client";
import { ApiError } from "@/lib/api/api-error";
import type { Business } from "@/types/business";

type PageProps = { params: Promise<{ id: string }> };

export default async function BusinessDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("business");
  const tFields = await getTranslations("business.fields");

  let business: Business;
  try {
    business = await serverApiRequest<Business>(`/businesses/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-12">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">{business.name}</h1>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
          {t(`status.${business.status}`)}
        </span>
      </div>
      <p className="text-sm text-neutral-500">{t(`statusDescription.${business.status}`)}</p>

      {business.description ? <p className="text-neutral-300">{business.description}</p> : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">{tFields("phone")}</dt>
        <dd className="text-white">{business.phone}</dd>
        {business.address ? (
          <>
            <dt className="text-neutral-500">{tFields("address")}</dt>
            <dd className="text-white">{business.address}</dd>
          </>
        ) : null}
        {business.email ? (
          <>
            <dt className="text-neutral-500">Email</dt>
            <dd className="text-white">{business.email}</dd>
          </>
        ) : null}
      </dl>
    </main>
  );
}
