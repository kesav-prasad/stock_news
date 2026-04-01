import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function seedCompanies() {
  console.log('Starting company sync...');

  const dataPath = path.join(__dirname, '..', 'data', 'companies_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('companies_data.json not found! Run generateCompanies.ts first.');
    process.exit(1);
  }

  const allCompanies = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${allCompanies.length} companies from JSON`);

  let inserted = 0;
  const batchSize = 50;

  for (let i = 0; i < allCompanies.length; i += batchSize) {
    const batch = allCompanies.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (company: any) => {
        if (!company.symbol || !company.name) return;
        try {
          await prisma.company.upsert({
            where: { symbol: company.symbol },
            update: {
              name: company.name,
              exchange: company.exchange,
              sector: company.sector || null,
              industry: company.industry || null,
            },
            create: {
              symbol: company.symbol,
              name: company.name,
              exchange: company.exchange,
              sector: company.sector || null,
              industry: company.industry || null,
            },
          });
          inserted++;
        } catch {
          // Skip duplicates
        }
      })
    );

    if ((i + batchSize) % 500 === 0 || i + batchSize >= allCompanies.length) {
      console.log(`Progress: ${Math.min(i + batchSize, allCompanies.length)}/${allCompanies.length}`);
    }
  }

  console.log(`Synced ${inserted} companies successfully.`);
  await prisma.$disconnect();
}

seedCompanies().then(() => process.exit(0));
