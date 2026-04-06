import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { fetchNewsForCompany } from './services/aiNewsService';
import { ClerkExpressRequireAuth, StrictAuthProp } from '@clerk/clerk-sdk-node';

declare global {
  namespace Express {
    interface Request extends StrictAuthProp {}
  }
}

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

// Watchlist endpoints (Protected)
app.get('/api/watchlist', ClerkExpressRequireAuth({}) as unknown as express.RequestHandler, async (req: any, res) => {
  try {
    const userId = req.auth.userId;
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const watchlists = await prisma.userWatchlist.findMany({
      where: { userId },
      select: { companyId: true }
    });
    res.json({ watchlistIds: watchlists.map(w => w.companyId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

app.post('/api/watchlist/toggle', ClerkExpressRequireAuth({}) as unknown as express.RequestHandler, async (req: any, res) => {
  try {
    const { companyId } = req.body;
    const userId = req.auth.userId;

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const existing = await prisma.userWatchlist.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });

    if (existing) {
      await prisma.userWatchlist.delete({
        where: { userId_companyId: { userId, companyId } }
      });
      res.json({ status: 'removed' });
    } else {
      await prisma.userWatchlist.create({
        data: { userId, companyId }
      });
      res.json({ status: 'added' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle watchlist' });
  }
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
    const news = await fetchNewsForCompany(prisma, company.id, company.symbol, company.name);
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
