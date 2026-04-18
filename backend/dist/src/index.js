"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const aiNewsService_1 = require("./services/aiNewsService");
const marketDataService_1 = require("./services/marketDataService");
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
const openai_1 = __importDefault(require("openai"));
const PORT = process.env.PORT || 4000;
// ★ AI Morning Briefing Generator
const openai = new openai_1.default();
app.post('/api/briefing', async (req, res) => {
    try {
        const { articles } = req.body;
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            res.json({ briefing: "No significant news updates today to brief you on." });
            return;
        }
        if (!process.env.OPENAI_API_KEY) {
            res.json({ briefing: `Market Update: ${articles[0].title}. Monitor your watchlist for further developments on these fronts.` });
            return;
        }
        const prompt = `You are an elite financial analyst. Write an extremely concise, premium-feeling 2-sentence morning briefing summarizing these headlines. Do not use filler words. Be direct and insightful:\n\n` +
            articles.slice(0, 5).map((a) => `- ${a.title}`).join('\n');
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100
        });
        res.json({ briefing: completion.choices[0].message.content?.trim() || "Market conditions remain dynamic." });
    }
    catch (err) {
        console.error("OpenAI Briefing error:", err);
        res.json({ briefing: req.body.articles?.[0]?.title ? `Top Story: ${req.body.articles[0].title}.` : "Market conditions remain dynamic." });
    }
});
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
