import { PrismaClient } from '@prisma/client';
import { fetchNewsForCompany } from './src/services/aiNewsService';

const prisma = new PrismaClient();

async function testFetch() {
  const company = await prisma.company.findFirst();
  console.log("Testing with company:", company?.name, company?.symbol);
  if (!company) return;

  const news = await fetchNewsForCompany(prisma, company.symbol, company.name);
  console.log("Fetched news length:", news.length);
  if (news.length > 0) {
    console.log("First news title:", news[0].title);
  }
}

testFetch();
