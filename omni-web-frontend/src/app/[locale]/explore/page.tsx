import { getTranslations } from "next-intl/server";
import { serverApiRequest } from "@/lib/api/server-client";
import type { Business } from "@/types/business";
import { ExploreList } from "./explore-list";

// ~0.2 degrees (~20km at this latitude) around the app's default center --
// a real "explore near you" would use the visitor's geolocation, but that
// requires client-side permission; the map page already covers that case.
// This is a lighter list view around a fixed default center.
const RADIUS_DEGREES = 0.2;

export default async function ExplorePage() {
  const t = await getTranslations("buyer.explore");
  const lat = Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT);
  const lon = Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LON);

  const businesses = await serverApiRequest<Business[]>(
    `/businesses?south=${lat - RADIUS_DEGREES}&west=${lon - RADIUS_DEGREES}&north=${lat + RADIUS_DEGREES}&east=${lon + RADIUS_DEGREES}`,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <ExploreList businesses={businesses} searchPlaceholder={t("searchPlaceholder")} />
    </main>
  );
}
