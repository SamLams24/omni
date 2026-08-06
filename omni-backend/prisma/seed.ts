import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const PERMISSIONS = [
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "businesses.read",
  "businesses.verify",
  "businesses.certify",
  "kyc.read",
  "kyc.approve",
  "kyc.reject",
  "subscriptions.read",
  "subscriptions.manage",
  "payments.read",
  "payments.refund",
  "admin.access",
] as const;

async function main() {
  console.log("Seeding OMNI development database...");

  // --- Roles & permissions -------------------------------------------------
  const permissions = await Promise.all(
    PERMISSIONS.map((key) =>
      prisma.permission.upsert({ where: { key }, update: {}, create: { key } }),
    ),
  );

  const adminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: {},
    create: { name: "SUPER_ADMIN", description: "Full administrative access" },
  });

  const userRole = await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: { name: "USER", description: "Standard authenticated user" },
  });

  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id },
      }),
    ),
  );

  // --- Dev admin account -----------------------------------------------------
  // Development-only credentials -- NEVER reused in staging or production.
  const adminPasswordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: "admin@omni.dev" },
    update: {},
    create: {
      name: "OMNI Admin (dev)",
      email: "admin@omni.dev",
      passwordHash: adminPasswordHash,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const vendorPasswordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });
  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@omni.dev" },
    update: {},
    create: {
      name: "Vendeur Démo",
      email: "vendor@omni.dev",
      passwordHash: vendorPasswordHash,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: vendorUser.id, roleId: userRole.id } },
    update: {},
    create: { userId: vendorUser.id, roleId: userRole.id },
  });

  // --- Categories --------------------------------------------------------
  const categories = await Promise.all(
    [
      { slug: "alimentation", name: "Alimentation" },
      { slug: "services", name: "Services" },
      { slug: "artisanat", name: "Artisanat" },
      { slug: "mode", name: "Mode" },
      { slug: "maison", name: "Maison" },
    ].map((category) =>
      prisma.category.upsert({ where: { slug: category.slug }, update: {}, create: category }),
    ),
  );

  // --- Demo businesses covering all three verification states ------------
  // 1. non_verifiee: no KYC submitted yet.
  await prisma.business.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Boutique Non Vérifiée (démo)",
      categoryId: categories[0]?.id,
      phone: "+22890000001",
      kycStatus: "NONE",
      owners: { create: { userId: vendorUser.id, role: "owner" } },
    },
  });

  // 2. verifiee: KYC approved, no active subscription.
  const verifiedBusiness = await prisma.business.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Atelier Vérifié (démo)",
      categoryId: categories[2]?.id,
      phone: "+22890000002",
      kycStatus: "APPROVED",
      kycReviewedAt: new Date(),
      owners: { create: { userId: vendorUser.id, role: "owner" } },
    },
  });
  await prisma.kycRequest.create({
    data: {
      businessId: verifiedBusiness.id,
      userId: vendorUser.id,
      status: "APPROVED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });

  // 3. certifiee: KYC approved AND an active, paid premium subscription.
  const certifiedBusiness = await prisma.business.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Marché Certifié (démo)",
      categoryId: categories[1]?.id,
      phone: "+22890000003",
      kycStatus: "APPROVED",
      kycReviewedAt: new Date(),
      owners: { create: { userId: vendorUser.id, role: "owner" } },
    },
  });
  await prisma.kycRequest.create({
    data: {
      businessId: certifiedBusiness.id,
      userId: vendorUser.id,
      status: "APPROVED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });
  await prisma.subscription.create({
    data: {
      userId: vendorUser.id,
      businessId: certifiedBusiness.id,
      tier: "PREMIUM",
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Seed complete.");
  console.log("Dev admin login: admin@omni.dev / ChangeMe123! (development only)");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
