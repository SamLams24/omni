export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "SELLER" | "BUYER" | "DELIVERY";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roles: UserRole[];
};
