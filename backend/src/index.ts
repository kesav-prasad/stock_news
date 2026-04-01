import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { fetchNewsForCompany } from './services/aiNewsService';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Search and filter companies
app.get('/api/companies', async (req, res) => {
  const { search, exchange, page = 1, limit = 100 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: String(search) } },
      { symbol: { contains: String(search) } },
    ];
  }
  if (exchange) {
    where.exchange = String(exchange).toUpperCase();
  }

  try {
    const [companies, total] = await Promise.all([
      prisma.company.findMany({ where, skip, take: Number(limit), orderBy: { name: 'asc' } }),
      prisma.company.count({ where }),
    ]);

    res.json({ companies, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// News for a company (with dedup fetch)
app.get('/api/companies/:id/news', async (req, res) => {
  const { id } = req.params;
  try {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const news = await fetchNewsForCompany(prisma, company.symbol, company.name);
    res.json(news);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
