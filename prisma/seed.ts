import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  // Expenses
  { name: 'Food', icon: '🍛', type: 'EXPENSE', isDefault: true },
  { name: 'Transport', icon: '🚗', type: 'EXPENSE', isDefault: true },
  { name: 'Fuel', icon: '⛽', type: 'EXPENSE', isDefault: true },
  { name: 'Rent', icon: '🏠', type: 'EXPENSE', isDefault: true },
  { name: 'Utilities', icon: '💡', type: 'EXPENSE', isDefault: true },
  { name: 'Internet', icon: '🌐', type: 'EXPENSE', isDefault: true },
  { name: 'Phone', icon: '📱', type: 'EXPENSE', isDefault: true },
  { name: 'Shopping', icon: '🛍️', type: 'EXPENSE', isDefault: true },
  { name: 'Healthcare', icon: '🏥', type: 'EXPENSE', isDefault: true },
  { name: 'Education', icon: '📚', type: 'EXPENSE', isDefault: true },
  { name: 'Entertainment', icon: '🎬', type: 'EXPENSE', isDefault: true },
  { name: 'Travel', icon: '✈️', type: 'EXPENSE', isDefault: true },
  { name: 'Debt', icon: '💳', type: 'EXPENSE', isDefault: true },
  { name: 'Loan', icon: '🏦', type: 'EXPENSE', isDefault: true },
  { name: 'Subscriptions', icon: '🔄', type: 'EXPENSE', isDefault: true },
  // Income
  { name: 'Salary', icon: '💰', type: 'INCOME', isDefault: true },
  { name: 'Freelance', icon: '💻', type: 'INCOME', isDefault: true },
  { name: 'Business', icon: '💼', type: 'INCOME', isDefault: true },
  { name: 'Investment', icon: '📈', type: 'INCOME', isDefault: true },
  { name: 'Gift', icon: '🎁', type: 'INCOME', isDefault: true },
  // Both
  { name: 'Other', icon: '📌', type: null, isDefault: true },
  { name: 'Adjustment', icon: '🔧', type: null, isDefault: true },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default (system) categories — no userId
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: null as unknown as string, name: cat.name } },
      update: { icon: cat.icon, type: cat.type ?? undefined, isDefault: cat.isDefault },
      create: {
        name: cat.name,
        icon: cat.icon,
        type: cat.type ?? undefined,
        isDefault: cat.isDefault,
        userId: null,
      },
    });
  }

  console.log(`✅ Created ${DEFAULT_CATEGORIES.length} default categories`);

  // Create a test user in development only
  if (process.env.NODE_ENV !== 'production') {
    const testUser = await prisma.user.upsert({
      where: { telegramUserId: BigInt(123456789) },
      update: {},
      create: {
        telegramUserId: BigInt(123456789),
        telegramUsername: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        timezone: 'Africa/Lagos',
        defaultCurrency: 'NGN',
        settings: { create: {} },
      },
    });

    // Sample transactions (amounts in kobo)
    const foodCat = await prisma.category.findFirst({ where: { name: 'Food', userId: null } });
    const salaryCat = await prisma.category.findFirst({ where: { name: 'Salary', userId: null } });

    if (foodCat && salaryCat) {
      await prisma.transaction.createMany({
        skipDuplicates: true,
        data: [
          {
            userId: testUser.id,
            type: 'INCOME',
            amountMinor: BigInt(50_000 * 100), // ₦50,000
            currency: 'NGN',
            categoryId: salaryCat.id,
            description: 'Monthly salary',
            transactionDate: new Date('2026-09-01'),
            source: 'COMMAND',
          },
          {
            userId: testUser.id,
            type: 'EXPENSE',
            amountMinor: BigInt(5_000 * 100), // ₦5,000
            currency: 'NGN',
            categoryId: foodCat.id,
            description: 'Groceries',
            transactionDate: new Date('2026-09-10'),
            source: 'TEXT',
          },
        ],
      });

      // Sample budget
      await prisma.budget.upsert({
        where: { id: 'seed-budget-food' },
        update: {},
        create: {
          id: 'seed-budget-food',
          userId: testUser.id,
          categoryId: foodCat.id,
          name: 'Food Budget',
          amountMinor: BigInt(80_000 * 100), // ₦80,000
          currency: 'NGN',
          period: 'MONTHLY',
        },
      });
    }

    console.log('✅ Test user and sample data created');
  }

  console.log('✅ Seeding complete!');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
