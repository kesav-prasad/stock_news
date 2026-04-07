import { PrismaClient } from '@prisma/client';
import { fetchNewsForCompany } from './src/services/aiNewsService';

const prisma = new PrismaClient();

async function test() {
  try {
    const companies = await prisma.company.findMany({ take: 1 });
    if (companies.length === 0) {
      console.log('No companies in DB');
      return;
    }
    const c = companies[0];
    console.log(`Testing news for: ${c.name} (${c.symbol}) [ID: ${c.id}]`);
    const news = await fetchNewsForCompany(prisma, c.id, c.symbol, c.name);
    console.log(`Found ${news.length} articles`);
    if (news.length > 0) {
      console.log('First article:', news[0].title);
    }
  } catch (e) {
    console.error('Test failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
