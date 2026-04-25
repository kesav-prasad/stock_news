import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';
import { fetchNewsForCompany } from './services/aiNewsService';
import { fetchStockQuote, fetchHistoricalData } from './services/marketDataService';
import { AngelOneService } from './services/angelOneService';
import { ClerkExpressRequireAuth, StrictAuthProp } from '@clerk/clerk-sdk-node';

declare global {
  namespace Express {
    interface Request extends StrictAuthProp {}
  }
}

dotenv.config();

export const prisma = new PrismaClient();

// ★ In-memory cache for stock data (avoids hammering Yahoo Finance)
const quoteCache = new Map<string, { data: any; expires: number }>();
const histCache = new Map<string, { data: any; expires: number }>();
const QUOTE_TTL = 60_000; // 60 seconds
const HIST_TTL = 300_000; // 5 minutes
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
  const { search, exchange, ids, page = 1, limit = 100 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
  
  if (ids) {
    // If 'ids' is provided, we fetch exactly those companies
    where.id = { in: String(ids).split(',') };
  } else {
    // Otherwise apply regular search filters
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { symbol: { contains: String(search) } },
      ];
    }
    if (exchange) {
      where.exchange = String(exchange).toUpperCase();
    }
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

// ★ Live stock quote (cached 60s)
app.get('/api/companies/:id/quote', async (req, res) => {
  const { id } = req.params;
  try {
    // Check cache first
    const cached = quoteCache.get(id);
    if (cached && Date.now() < cached.expires) {
      res.json(cached.data);
      return;
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const quote = await fetchStockQuote(company.symbol);
    if (!quote) {
      // Try latest from DB
      const latest = await prisma.stockPrice.findFirst({
        where: { companyId: id },
        orderBy: { timestamp: 'desc' },
      });
      const fallback = latest
        ? { price: latest.price, change: latest.change, changePercent: latest.changePercent, timestamp: latest.timestamp, symbol: company.symbol, name: company.name }
        : { price: 0, change: 0, changePercent: 0, timestamp: new Date(), symbol: company.symbol, name: company.name };
      res.json(fallback);
      return;
    }

    const result = { ...quote, symbol: company.symbol, name: company.name };
    quoteCache.set(id, { data: result, expires: Date.now() + QUOTE_TTL });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// ★ Historical chart data (cached 5min)
app.get('/api/companies/:id/historical', async (req, res) => {
  const { id } = req.params;
  const period = (req.query.period as string) || '1M';
  const cacheKey = `${id}_${period}`;
  try {
    // Check cache
    const cached = histCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      res.json(cached.data);
      return;
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const data = await fetchHistoricalData(company.symbol, period as any);
    histCache.set(cacheKey, { data, expires: Date.now() + HIST_TTL });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// ==========================================
// ★ MARKET NEWS FEED — Single endpoint for ALL Indian stock market news
// ==========================================

const rssParser = new Parser();

// In-memory cache for market news (avoids hitting Google News RSS too frequently)
let marketNewsCache: { data: any[]; expires: number } = { data: [], expires: 0 };
const MARKET_NEWS_TTL = 3 * 60 * 1000; // 3 minutes

/**
 * Simple text similarity using Jaccard index on word sets.
 */
function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const setA = new Set(normalize(a));
  const setB = new Set(normalize(b));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

app.get('/api/market-news', async (_req, res) => {
  try {
    // Return cached data if still fresh
    if (Date.now() < marketNewsCache.expires && marketNewsCache.data.length > 0) {
      console.log(`[MarketNews] Serving ${marketNewsCache.data.length} cached articles`);
      res.json(marketNewsCache.data);
      return;
    }

    console.log('[MarketNews] Fetching fresh news from Google News RSS...');

    // Broad queries covering all Indian stock market news
    // NOTE: Removed `when:1d` — it's too restrictive and causes Google News
    // to return zero results. The RSS feed already returns recent articles by default.
    const queries = [
      'Indian stock market news',
      'BSE NSE Nifty Sensex share market',
      'share market India today',
      'stock market India latest',
      'Nifty 50 stocks today India',
      'India finance market news',
      'Reliance TCS HDFC Infosys stock',
      'Indian share price today',
    ];

    // Fetch all queries in parallel
    const results = await Promise.all(
      queries.map(q =>
        rssParser.parseURL(
          `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`
        ).catch(err => {
          console.error(`[MarketNews] Query failed: "${q}" —`, err.message);
          return { items: [] };
        })
      )
    );

    // Merge all items from all queries
    const allItems: any[] = [];
    for (const feed of results) {
      if (feed.items) allItems.push(...feed.items);
    }

    console.log(`[MarketNews] Raw items from ${queries.length} queries: ${allItems.length}`);

    // Deduplicate by URL first
    const seenUrls = new Set<string>();
    const urlDeduped: any[] = [];
    for (const item of allItems) {
      if (!item.title || !item.link) continue;
      if (seenUrls.has(item.link)) continue;
      seenUrls.add(item.link);
      urlDeduped.push(item);
    }

    // Deduplicate by title similarity (Jaccard > 0.65 = duplicate)
    const dedupedItems: any[] = [];
    for (const item of urlDeduped) {
      const isDuplicate = dedupedItems.some(
        existing => titleSimilarity(existing.title, item.title) > 0.65
      );
      if (!isDuplicate) dedupedItems.push(item);
    }

    // Parse into structured articles
    const bullishWords = /\b(surge|jump|soar|buy|upgrade|record|profit|gain|growth|rally|soars|up|higher|revenue|win|bull|expansion|beat|outperform|rise|rises|bullish|positive|upbeat|boom)\b/i;
    const bearishWords = /\b(plunge|drop|fall|sell|downgrade|loss|decline|miss|down|lower|lawsuit|bear|shrink|underperform|crash|weakness|probe|investigate|fraud|scam|fine|tank|slump|tumble|bearish|negative)\b/i;

    const articles = dedupedItems.map(item => {
      let source = 'Google News';
      const dashIdx = item.title.lastIndexOf(' - ');
      let title = item.title;
      if (dashIdx !== -1) {
        source = item.title.substring(dashIdx + 3).trim();
        title = item.title.substring(0, dashIdx).trim();
      }

      const titleLower = title.toLowerCase();
      let sentiment = 'neutral';
      if (bearishWords.test(titleLower) && !bullishWords.test(titleLower)) sentiment = 'bearish';
      else if (bullishWords.test(titleLower) && !bearishWords.test(titleLower)) sentiment = 'bullish';

      return {
        id: item.link,
        title,
        url: item.link,
        source,
        publishedAt: item.isoDate || new Date().toISOString(),
        sentiment,
      };
    });

    // Sort by publishedAt descending (newest first)
    articles.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    console.log(`[MarketNews] Final: ${articles.length} unique articles after dedup`);

    // Cache the results
    marketNewsCache = { data: articles, expires: Date.now() + MARKET_NEWS_TTL };

    res.json(articles);
  } catch (err) {
    console.error('[MarketNews] Error:', err);
    // Return cached data even if expired, as fallback
    if (marketNewsCache.data.length > 0) {
      res.json(marketNewsCache.data);
    } else {
      res.status(500).json({ error: 'Failed to fetch market news' });
    }
  }
});

// ★ AI Morning Briefing Generator
// NOTE: OpenAI is lazy-imported inside the handler to prevent server crash
// when OPENAI_API_KEY is not set (e.g. on Render where .env is gitignored)
app.post('/api/briefing', async (req, res) => {
  try {
    const { articles } = req.body;
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      res.json({ briefing: "No significant news updates today to brief you on." });
      return;
    }

    // Build a smart fallback briefing from headlines
    const fallbackBriefing = articles.length >= 2
      ? `${articles[0].title}. Meanwhile, ${articles[1].title.toLowerCase()}.`
      : `Market Update: ${articles[0].title}. Monitor your watchlist for further developments.`;

    if (!process.env.OPENAI_API_KEY) {
      res.json({ briefing: fallbackBriefing });
      return;
    }

    // Lazy-init OpenAI only when we actually have a key
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are an elite financial analyst. Write an extremely concise, premium-feeling 2-sentence morning briefing summarizing these headlines. Do not use filler words. Be direct and insightful:\n\n` +
      articles.slice(0, 5).map((a: any) => `- ${a.title}`).join('\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100
    });

    res.json({ briefing: completion.choices[0].message.content?.trim() || fallbackBriefing });
  } catch (err) {
    console.error("OpenAI Briefing error:", err);
    const fallback = req.body.articles?.[0]?.title
      ? `Top Story: ${req.body.articles[0].title}.`
      : "Market conditions remain dynamic.";
    res.json({ briefing: fallback });
  }
});

// ==========================================
// ★ BROKER INTEGRATION (ANGEL ONE)
// ==========================================

// Stateless Fetch holdings (Proxy to Angel One)
app.post('/api/broker/holdings', async (req: any, res) => {
  try {
    const { apiKey, clientId, pin, totpSecret } = req.body;
    
    if (!apiKey || !clientId || !pin || !totpSecret) {
      res.status(400).json({ error: 'Missing broker credentials' });
      return;
    }

    const angelOneService = new AngelOneService({
      apiKey,
      clientId,
      pin,
      totpSecret
    });

    // Fetches live from Angel One
    const holdings = await angelOneService.getHoldings();
    res.json({ success: true, holdings });
  } catch (err: any) {
    console.error('[Broker Holdings] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch holdings', message: err.message });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
