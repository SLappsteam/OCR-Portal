import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function extractStoreNumber(slug: string): string | null {
  const pattern = /^(ST[A-Z0-9]{1,3}|DCW[0-9]|STA[0-9]|STB[0-9]|STC[0-9]|STH[0-9]|STJ[0-9]|STL[0-9]|STM[0-9]|STN[0-9]|STP[0-9]|STQ[0-9]|STR[0-9]|STS[0-9]|STT[0-9]|STU[0-9])/i;
  const match = slug.match(pattern);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return null;
}

function parseAddress(address: string): { street: string; city: string; state: string; zip: string } {
  const result = { street: '', city: '', state: '', zip: '' };
  if (!address) return result;

  const normalized = address.replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
  const parts = normalized.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length >= 4) {
    const lastPart = parts[parts.length - 1] ?? '';
    const secondLast = parts[parts.length - 2] ?? '';
    const thirdLast = parts[parts.length - 3] ?? '';
    const fourthLast = parts[parts.length - 4] ?? '';

    if (lastPart === 'US' || lastPart === 'USA') {
      result.zip = secondLast.replace(/-\d+$/, '');
      result.state = thirdLast;
      result.city = fourthLast;
      result.street = parts.slice(0, parts.length - 4).join(', ');
    } else {
      const zipMatch = lastPart.match(/\d{5}/);
      if (zipMatch) {
        result.zip = zipMatch[0];
        result.state = secondLast;
        result.city = thirdLast;
        result.street = parts.slice(0, parts.length - 3).join(', ');
      }
    }
  }

  return result;
}

async function seedStores(): Promise<void> {
  const csvPath = 'C:\\Users\\claytr1\\Downloads\\netbox_sites.csv';

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  const headerLine = lines[0];
  if (!headerLine) {
    console.error('CSV file is empty');
    process.exit(1);
  }

  const headers = parseCsvLine(headerLine);
  const slugIdx = headers.findIndex(h => h.toLowerCase() === 'slug');
  const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
  const addrIdx = headers.findIndex(h => h.toLowerCase() === 'physical address');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const fields = parseCsvLine(line);
    const slug = fields[slugIdx] ?? '';
    const name = fields[nameIdx] ?? '';
    const physicalAddress = fields[addrIdx] ?? '';

    const storeNumber = extractStoreNumber(slug);
    if (!storeNumber) {
      skipped++;
      continue;
    }

    const parsed = parseAddress(physicalAddress);
    const storeName = name || slug;

    try {
      const existing = await prisma.store.findUnique({
        where: { store_number: storeNumber },
      });

      if (existing) {
        await prisma.store.update({
          where: { store_number: storeNumber },
          data: {
            name: storeName,
            address: parsed.street || physicalAddress || null,
            city: parsed.city || null,
            state: parsed.state || null,
            zip_code: parsed.zip || null,
          },
        });
        updated++;
        console.log(`Updated: ${storeNumber} - ${storeName}`);
      } else {
        await prisma.store.create({
          data: {
            store_number: storeNumber,
            name: storeName,
            address: parsed.street || physicalAddress || null,
            city: parsed.city || null,
            state: parsed.state || null,
            zip_code: parsed.zip || null,
          },
        });
        created++;
        console.log(`Created: ${storeNumber} - ${storeName}`);
      }
    } catch (error) {
      console.error(`Error processing ${storeNumber}:`, error);
    }
  }

  console.log(`\nSeed complete: ${created} created, ${updated} updated, ${skipped} skipped`);
}

seedStores()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
