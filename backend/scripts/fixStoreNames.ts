import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany();

  for (const store of stores) {
    if (store.name.startsWith('Store ')) {
      const newName = store.name.replace('Store ', '');
      await prisma.store.update({
        where: { id: store.id },
        data: { name: newName }
      });
      console.log('Updated:', store.name, '->', newName);
    } else {
      console.log('Unchanged:', store.store_number, '-', store.name);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
