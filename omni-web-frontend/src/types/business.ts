export type BusinessStatus = "UNCONFIRMED" | "CONFIRMED" | "CERTIFIED";

export type Business = {
  id: string;
  name: string;
  categoryId: string | null;
  description: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number | null;
  status: BusinessStatus;
  source: "OMNI" | "OSM";
  createdAt: string;
};

export type MapFacility = {
  id: string;
  source: "osm" | "omni";
  businessId: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  status: BusinessStatus;
  tags: Record<string, string>;
};

export type Bbox = { south: number; west: number; north: number; east: number };
