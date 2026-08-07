import type { BusinessStatus } from '../business-status.util';

export type BusinessDto = {
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
  source: 'OMNI' | 'OSM';
  createdAt: string;
};

export type BboxQuery = {
  south: number;
  west: number;
  north: number;
  east: number;
};
