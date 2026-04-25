"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const rss_parser_1 = __importDefault(require("rss-parser"));
const client_1 = require("@prisma/client");
const aiNewsService_1 = require("./services/aiNewsService");
const marketDataService_1 = require("./services/marketDataService");
const angelOneService_1 = require("./services/angelOneService");
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient();
// ★ In-memory cache for stock data (avoids hammering Yahoo Finance)
const quoteCache = new Map();
const histCache = new Map();
const QUOTE_TTL = 60000; // 60 seconds
const HIST_TTL = 300000; // 5 minutes
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Watchlist endpoints (Protected)
app.get('/api/watchlist', (0, clerk_sdk_node_1.ClerkExpressRequireAuth)({}), async (req, res) => {
    try {
        const userId = req.auth.userId;
        await exports.prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId },
        });
        const watchlists = await exports.prisma.userWatchlist.findMany({
            where: { userId },
            select: { companyId: true }
        });
        res.json({ watchlistIds: watchlists.map(w => w.companyId) });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});
app.post('/api/watchlist/toggle', (0, clerk_sdk_node_1.ClerkExpressRequireAuth)({}), async (req, res) => {
    try {
        const { companyId } = req.body;
        const userId = req.auth.userId;
        await exports.prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId },
        });
        const existing = await exports.prisma.userWatchlist.findUnique({
            where: { userId_companyId: { userId, companyId } }
        });
        if (existing) {
            await exports.prisma.userWatchlist.delete({
                where: { userId_companyId: { userId, companyId } }
            });
            res.json({ status: 'removed' });
        }
        else {
            await exports.prisma.userWatchlist.create({
                data: { userId, companyId }
            });
            res.json({ status: 'added' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to toggle watchlist' });
    }
});
// Search and filter companies
app.get('/api/companies', async (req, res) => {
    const { search, exchange, ids, page = 1, limit = 100 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (ids) {
        // If 'ids' is provided, we fetch exactly those companies
        where.id = { in: String(ids).split(',') };
    }
    else {
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
            exports.prisma.company.findMany({ where, skip, take: Number(limit), orderBy: { name: 'asc' } }),
            exports.prisma.company.count({ where }),
        ]);
        res.json({ companies, total, page: Number(page), limit: Number(limit) });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
});
// News for a company (with dedup fetch)
app.get('/api/companies/:id/news', async (req, res) => {
    const { id } = req.params;
    try {
        const company = await exports.prisma.company.findUnique({ where: { id } });
        if (!company) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const news = await (0, aiNewsService_1.fetchNewsForCompany)(exports.prisma, company.id, company.symbol, company.name);
        res.json(news);
    }
    catch (err) {
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
        const company = await exports.prisma.company.findUnique({ where: { id } });
        if (!company) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const quote = await (0, marketDataService_1.fetchStockQuote)(company.symbol);
        if (!quote) {
            // Try latest from DB
            const latest = await exports.prisma.stockPrice.findFirst({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
});
// ★ Historical chart data (cached 5min)
app.get('/api/companies/:id/historical', async (req, res) => {
    const { id } = req.params;
    const period = req.query.period || '1M';
    const cacheKey = `${id}_${period}`;
    try {
        // Check cache
        const cached = histCache.get(cacheKey);
        if (cached && Date.now() < cached.expires) {
            res.json(cached.data);
            return;
        }
        const company = await exports.prisma.company.findUnique({ where: { id } });
        if (!company) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const data = await (0, marketDataService_1.fetchHistoricalData)(company.symbol, period);
        histCache.set(cacheKey, { data, expires: Date.now() + HIST_TTL });
        res.json(data);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch historical data' });
    }
});
// ==========================================
// ★ MARKET NEWS FEED — Single endpoint for ALL Indian stock market news
// ==========================================
const rssParser = new rss_parser_1.default();
// In-memory cache for market news (avoids hitting Google News RSS too frequently)
let marketNewsCache = { data: [], expires: 0 };
const MARKET_NEWS_TTL = 3 * 60 * 1000; // 3 minutes
/**
 * Simple text similarity using Jaccard index on word sets.
 */
function titleSimilarity(a, b) {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const setA = new Set(normalize(a));
    const setB = new Set(normalize(b));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size === 0)
        return 0;
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
        const results = await Promise.all(queries.map(q => rssParser.parseURL(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`).catch(err => {
            console.error(`[MarketNews] Query failed: "${q}" —`, err.message);
            return { items: [] };
        })));
        // Merge all items from all queries
        const allItems = [];
        for (const feed of results) {
            if (feed.items)
                allItems.push(...feed.items);
        }
        console.log(`[MarketNews] Raw items from ${queries.length} queries: ${allItems.length}`);
        // Deduplicate by URL first
        const seenUrls = new Set();
        const urlDeduped = [];
        for (const item of allItems) {
            if (!item.title || !item.link)
                continue;
            if (seenUrls.has(item.link))
                continue;
            seenUrls.add(item.link);
            urlDeduped.push(item);
        }
        // Deduplicate by title similarity (Jaccard > 0.65 = duplicate)
        const dedupedItems = [];
        for (const item of urlDeduped) {
            const isDuplicate = dedupedItems.some(existing => titleSimilarity(existing.title, item.title) > 0.65);
            if (!isDuplicate)
                dedupedItems.push(item);
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
            if (bearishWords.test(titleLower) && !bullishWords.test(titleLower))
                sentiment = 'bearish';
            else if (bullishWords.test(titleLower) && !bearishWords.test(titleLower))
                sentiment = 'bullish';
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
        articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        console.log(`[MarketNews] Final: ${articles.length} unique articles after dedup`);
        // Cache the results
        marketNewsCache = { data: articles, expires: Date.now() + MARKET_NEWS_TTL };
        res.json(articles);
    }
    catch (err) {
        console.error('[MarketNews] Error:', err);
        // Return cached data even if expired, as fallback
        if (marketNewsCache.data.length > 0) {
            res.json(marketNewsCache.data);
        }
        else {
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
        const OpenAI = (await Promise.resolve().then(() => __importStar(require('openai')))).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = `You are an elite financial analyst. Write an extremely concise, premium-feeling 2-sentence morning briefing summarizing these headlines. Do not use filler words. Be direct and insightful:\n\n` +
            articles.slice(0, 5).map((a) => `- ${a.title}`).join('\n');
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100
        });
        res.json({ briefing: completion.choices[0].message.content?.trim() || fallbackBriefing });
    }
    catch (err) {
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
app.post('/api/broker/holdings', async (req, res) => {
    try {
        const { apiKey, clientId, pin, totpSecret } = req.body;
        if (!apiKey || !clientId || !pin || !totpSecret) {
            res.status(400).json({ error: 'Missing broker credentials' });
            return;
        }
        const angelOneService = new angelOneService_1.AngelOneService({
            apiKey,
            clientId,
            pin,
            totpSecret
        });
        // Fetches live from Angel One
        const holdings = await angelOneService.getHoldings();
        res.json({ success: true, holdings });
    }
    catch (err) {
        console.error('[Broker Holdings] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch holdings', message: err.message });
    }
});
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
