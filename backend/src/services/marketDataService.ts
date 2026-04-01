import yahooFinance from 'yahoo-finance2';
import { prisma } from '../index';

export async function fetchStockQuote(symbol: string) {
  try {
    const quote: any = await yahooFinance.quote(symbol);
    if (!quote) return null;

    const price = quote.regularMarketPrice || 0;
    const change = quote.regularMarketChange || 0;
    const changePercent = quote.regularMarketChangePercent || 0;

    return {
      price,
      change,
      changePercent,
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

export async function fetchHistoricalData(symbol: string, period: '1D' | '1W' | '1M' | '1Y') {
  try {
    const now = new Date();
    const periodMap = {
      '1D': { period1: new Date(now.getTime() - 24 * 60 * 60 * 1000), interval: '5m' as const },
      '1W': { period1: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), interval: '1h' as const },
      '1M': { period1: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), interval: '1d' as const },
      '1Y': { period1: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), interval: '1wk' as const }
    };

    const queryOptions: any = {
      period1: periodMap[period].period1,
      period2: now,
      interval: periodMap[period].interval
    };

    const result: any[] = (await yahooFinance.historical(symbol, queryOptions)) as any[];
    return result.map((data: any) => ({
      time: Math.floor(data.date.getTime() / 1000),
      value: data.close || data.open
    }));
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

export async function updateAllStockPrices() {
  console.log('Updating stock prices...');
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
