// Quick test to debug yahoo-finance2
import yahooFinance from 'yahoo-finance2';

async function test() {
  console.log('Testing yahoo-finance2...');
  
  try {
    console.log('\n--- Testing quote for RELIANCE.NS ---');
    const quote: any = await yahooFinance.quote('RELIANCE.NS');
    console.log('Quote result:', JSON.stringify(quote, null, 2));
  } catch (err: any) {
    console.error('Quote error:', err.message);
  }

  try {
    console.log('\n--- Testing quote for AAPL ---');
    const quote2: any = await yahooFinance.quote('AAPL');
    console.log('AAPL price:', quote2?.regularMarketPrice);
  } catch (err: any) {
    console.error('AAPL error:', err.message);
  }

  try {
    console.log('\n--- Testing historical for RELIANCE.NS ---');
    const hist: any = await yahooFinance.historical('RELIANCE.NS', {
      period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d' as any,
    });
    console.log('Historical points:', hist?.length || 0);
    if (hist && hist.length > 0) {
      console.log('First:', hist[0]);
    }
  } catch (err: any) {
    console.error('Historical error:', err.message);
  }
}

test();
