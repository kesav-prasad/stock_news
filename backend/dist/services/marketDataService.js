"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchStockQuote = fetchStockQuote;
exports.fetchHistoricalData = fetchHistoricalData;
exports.updateAllStockPrices = updateAllStockPrices;
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const yahooFinance = new yahoo_finance2_1.default();
const client_1 = require("@prisma/client");
// Use a lazy import to avoid circular dependency with index.ts
let _prisma = null;
function getPrisma() {
    if (!_prisma) {
        _prisma = new client_1.PrismaClient();
    }
    return _prisma;
}
async function fetchStockQuote(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);
        if (!quote)
            return null;
        const price = quote.regularMarketPrice || 0;
        const change = quote.regularMarketChange || 0;
        const changePercent = quote.regularMarketChangePercent || 0;
        return {
            price,
            change,
            changePercent,
            timestamp: new Date()
        };
    }
    catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return null;
    }
}
async function fetchHistoricalData(symbol, period) {
    try {
        const now = new Date();
        const periodMap = {
            '1M': { period1: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), interval: '1d' },
            '6M': { period1: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), interval: '1d' },
            '1Y': { period1: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), interval: '1wk' },
            '5Y': { period1: new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000), interval: '1mo' }
        };
        const queryOptions = {
            period1: periodMap[period].period1,
            period2: now,
            interval: periodMap[period].interval
        };
        const result = (await yahooFinance.historical(symbol, queryOptions));
        return result.map((data) => ({
            time: Math.floor(data.date.getTime() / 1000),
            value: data.close || data.open
        }));
    }
    catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        return [];
    }
}
async function updateAllStockPrices() {
    console.log('Updating stock prices...');
    const prisma = getPrisma();
    const companies = await prisma.company.findMany();
    // Throttle requests not to get banned
    const batchSize = 10;
    for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, i + batchSize);
        await Promise.all(batch.map(async (company) => {
            const quote = await fetchStockQuote(company.symbol);
            if (quote) {
                await prisma.stockPrice.create({
                    data: {
                        companyId: company.id,
                        price: quote.price,
                        change: quote.change,
                        changePercent: quote.changePercent,
                        timestamp: quote.timestamp
                    }
                });
            }
        }));
        // Wait 500ms between batches
        await new Promise(res => setTimeout(res, 500));
    }
    console.log('Stock prices updated successfully.');
}
