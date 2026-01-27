import { PrismaClient, Store } from '@prisma/client';
import { StoreDto } from '../types';
import { NotFoundError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

function toStoreDto(store: Store): StoreDto {
  return {
    id: store.id,
    storeNumber: store.store_number,
    name: store.name,
    address: store.address ?? undefined,
    city: store.city ?? undefined,
    state: store.state ?? undefined,
    zipCode: store.zip_code ?? undefined,
    isActive: store.is_active,
  };
}

export async function getAllStores(activeOnly = true): Promise<StoreDto[]> {
  const where = activeOnly ? { is_active: true } : {};
  const stores = await prisma.store.findMany({
    where,
    orderBy: { store_number: 'asc' },
  });
  return stores.map(toStoreDto);
}

export async function getStoreById(id: number): Promise<StoreDto> {
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) {
    throw new NotFoundError(`Store with ID ${id} not found`);
  }
  return toStoreDto(store);
}

export async function getStoreByNumber(storeNumber: string): Promise<StoreDto> {
  const store = await prisma.store.findUnique({
    where: { store_number: storeNumber },
  });
  if (!store) {
    throw new NotFoundError(`Store ${storeNumber} not found`);
  }
  return toStoreDto(store);
}

export async function createStore(data: {
  storeNumber: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}): Promise<StoreDto> {
  const store = await prisma.store.create({
    data: {
      store_number: data.storeNumber,
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      zip_code: data.zipCode,
    },
  });
  return toStoreDto(store);
}

export async function updateStore(
  id: number,
  data: Partial<{
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    isActive: boolean;
  }>
): Promise<StoreDto> {
  const store = await prisma.store.update({
    where: { id },
    data: {
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      zip_code: data.zipCode,
      is_active: data.isActive,
    },
  });
  return toStoreDto(store);
}
