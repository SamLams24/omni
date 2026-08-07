import { PrismaClient } from '@prisma/client';
import { hash as argon2Hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'admin.access',
  'users.read',
  'users.update',
  'users.suspend',
  'businesses.read',
  'businesses.create',
  'businesses.update',
  'businesses.verify',
  'businesses.certify',
  'kyc.read',
  'kyc.approve',
  'kyc.reject',
  'subscriptions.read',
  'subscriptions.manage',
  'payments.read',
  'payments.manage',
  'seller.dashboard.access',
  'buyer.dashboard.access',
  'delivery.dashboard.access',
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: [
    'admin.access',
    'users.read',
    'users.update',
    'users.suspend',
    'businesses.read',
    'businesses.verify',
    'businesses.certify',
    'kyc.read',
    'kyc.approve',
    'kyc.reject',
    'subscriptions.read',
    'subscriptions.manage',
    'payments.read',
    'payments.manage',
  ],
  MODERATOR: ['businesses.read', 'kyc.read', 'kyc.approve', 'kyc.reject'],
  SELLER: [
    'businesses.read',
    'businesses.create',
    'businesses.update',
    'seller.dashboard.access',
  ],
  BUYER: ['buyer.dashboard.access'],
  DELIVERY: ['delivery.dashboard.access'],
};

async function main() {
  console.log('Seeding OMNI development database...');

  // --- Roles & permissions -------------------------------------------------
  const permissionsByKey: Map<
    string,
    Awaited<ReturnType<typeof prisma.permission.upsert>>
  > = new Map(
    await Promise.all(
      PERMISSIONS.map(async (key) => {
        const permission = await prisma.permission.upsert({
          where: { key },
          update: {},
          create: { key },
        });
        return [key, permission] as const;
      }),
    ),
  );

  const rolesByName = new Map(
    await Promise.all(
      Object.keys(ROLE_PERMISSIONS).map(async (name) => {
        const role = await prisma.role.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        return [name, role] as const;
      }),
    ),
  );

  for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = rolesByName.get(roleName);
    if (!role) continue;
    await Promise.all(
      permissionKeys
        .flatMap((key) => {
          const permission = permissionsByKey.get(key);
          return permission ? [{ key, permission }] : [];
        })
        .map(({ permission }) => {
          return prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: { roleId: role.id, permissionId: permission.id },
          });
        }),
    );
  }

  const adminRole = rolesByName.get('SUPER_ADMIN');
  const sellerRole = rolesByName.get('SELLER');
  const buyerRole = rolesByName.get('BUYER');
  if (!adminRole || !sellerRole || !buyerRole) {
    throw new Error('Expected roles were not created');
  }

  // --- Dev accounts ----------------------------------------------------------
  // Development-only credentials -- NEVER reused in staging or production.
  // See docs/setup/admin-account.md.
  const devPasswordHash = await argon2Hash('ChangeMe123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@omni.dev' },
    update: {},
    create: {
      name: 'OMNI Admin (dev)',
      email: 'admin@omni.dev',
      passwordHash: devPasswordHash,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@omni.dev' },
    update: {},
    create: {
      name: 'Vendeur Démo',
      email: 'vendor@omni.dev',
      passwordHash: devPasswordHash,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: vendorUser.id, roleId: sellerRole.id } },
    update: {},
    create: { userId: vendorUser.id, roleId: sellerRole.id },
  });

  const buyerUser = await prisma.user.upsert({
    where: { email: 'buyer@omni.dev' },
    update: {},
    create: {
      name: 'Acheteur Démo',
      email: 'buyer@omni.dev',
      passwordHash: devPasswordHash,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: buyerUser.id, roleId: buyerRole.id } },
    update: {},
    create: { userId: buyerUser.id, roleId: buyerRole.id },
  });

  // --- Categories --------------------------------------------------------
  const categories = await Promise.all(
    [
      { slug: 'alimentation', name: 'Alimentation' },
      { slug: 'services', name: 'Services' },
      { slug: 'artisanat', name: 'Artisanat' },
      { slug: 'mode', name: 'Mode' },
      { slug: 'maison', name: 'Maison' },
    ].map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: {},
        create: category,
      }),
    ),
  );

  // --- Subscription plan (for the FedaPay payment flow, Payment model) ---
  const premiumPlan = await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000f1' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000f1',
      tier: 'PREMIUM',
      name: 'Premium mensuel',
      priceAmount: '5000',
      priceCurrency: 'XOF',
    },
  });

  // --- Demo businesses covering all three verification states ------------
  // Lomé, Togo coordinates, matching legacy default fallback.
  const lomeLat = 6.1319;
  const lomeLon = 1.2228;

  // 1. UNCONFIRMED: no KYC submitted yet.
  await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Boutique Non Vérifiée (démo)',
      categoryId: categories[0]?.id,
      phone: '+22890000001',
      kycStatus: 'NONE',
      latitude: lomeLat,
      longitude: lomeLon,
      owners: { create: { userId: vendorUser.id, role: 'owner' } },
    },
  });

  // 2. CONFIRMED: KYC approved, no active subscription.
  const verifiedBusiness = await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Atelier Vérifié (démo)',
      categoryId: categories[2]?.id,
      phone: '+22890000002',
      kycStatus: 'APPROVED',
      kycReviewedAt: new Date(),
      latitude: lomeLat + 0.005,
      longitude: lomeLon + 0.003,
      owners: { create: { userId: vendorUser.id, role: 'owner' } },
    },
  });
  await prisma.kycRequest.create({
    data: {
      businessId: verifiedBusiness.id,
      userId: vendorUser.id,
      status: 'APPROVED',
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });

  // 3. CERTIFIED: KYC approved AND an active, paid premium subscription.
  const certifiedBusiness = await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Marché Certifié (démo)',
      categoryId: categories[1]?.id,
      phone: '+22890000003',
      kycStatus: 'APPROVED',
      kycReviewedAt: new Date(),
      latitude: lomeLat - 0.004,
      longitude: lomeLon + 0.006,
      owners: { create: { userId: vendorUser.id, role: 'owner' } },
    },
  });
  await prisma.kycRequest.create({
    data: {
      businessId: certifiedBusiness.id,
      userId: vendorUser.id,
      status: 'APPROVED',
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });
  const certifiedSubscription = await prisma.subscription.create({
    data: {
      userId: vendorUser.id,
      businessId: certifiedBusiness.id,
      planId: premiumPlan.id,
      tier: 'PREMIUM',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.payment.create({
    data: {
      userId: vendorUser.id,
      subscriptionId: certifiedSubscription.id,
      planId: premiumPlan.id,
      amount: premiumPlan.priceAmount,
      currency: premiumPlan.priceCurrency,
      method: 'USSD_PUSH',
      status: 'SUCCEEDED',
    },
  });

  console.log('Seed complete.');
  console.log(
    'Dev logins (development only, see docs/setup/admin-account.md):',
  );
  console.log('  admin@omni.dev  / ChangeMe123!  (SUPER_ADMIN)');
  console.log('  vendor@omni.dev / ChangeMe123!  (SELLER)');
  console.log('  buyer@omni.dev  / ChangeMe123!  (BUYER)');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
