import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-widest text-emerald-400">
        {tCommon("appName")}
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold sm:text-5xl">
        {t("title")}
      </h1>
      <p className="max-w-xl text-white/60">{t("subtitle")}</p>
      <Link
        href="/map"
        className="mt-4 rounded-full bg-emerald-500 px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-emerald-400"
      >
        {t("cta")}
      </Link>
    </main>
  );
}
