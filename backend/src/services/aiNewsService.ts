import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';

const parser = new Parser();

/**
 * Simple text-based similarity using Jaccard index on word sets.
 * Returns a value between 0 and 1 (1 = identical).
 */
function textSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const setA = new Set(normalize(a));
  const setB = new Set(normalize(b));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export async function fetchNewsForCompany(
  prisma: PrismaClient,
  companyId: string,
  symbol: string,
  name: string
) {
  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return [];

    const CACHE_HOURS = 6;
    const CACHE_MS = CACHE_HOURS * 60 * 60 * 1000;
    const now = new Date();
    
    // 1. Get existing news from DB immediately
    const existingLinks = await prisma.companyNews.findMany({
      where: { companyId: company.id },
      include: { news: true },
      orderBy: { news: { publishedAt: 'desc' } },
      take: 50,
    });
    const currentNews = existingLinks.map((n) => n.news);

    // 2. Decide if we need to refresh (Stale-While-Revalidate)
    const isStale = !company.lastNewsFetch || (now.getTime() - company.lastNewsFetch.getTime() > CACHE_MS);

    if (isStale) {
      // 3. Trigger background refresh (don't await it if we already have some news)
      const refreshTask = (async () => {
        try {
          const cleanSymbol = symbol.split('.')[0];
          const nameWords = name.split(' ').slice(0, 3).join(' ');
          const queries = [
            `${name} India stock news when:2y`,
            `${cleanSymbol} stock India news when:2y`,
            `${nameWords} business news India`
          ];

          // Fetch all queries in parallel for maximum speed
          const results = await Promise.all(
            queries.map(q => 
              parser.parseURL(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`)
                .catch(err => {
                  console.error(`Query failed for ${q}:`, err.message);
                  return { items: [] };
                })
            )
          );

          // Pick the best result (one with the most items)
          const bestResult = results.reduce((prev, curr) => 
            (curr.items.length > prev.items.length) ? curr : prev, { items: [] });

          if (bestResult.items.length === 0) return;

          const topEntries = bestResult.items.slice(0, 50);
          const existingUrls = new Set(currentNews.map((n) => n.url));
          const existingTitles = currentNews.map((n) => n.title);

          const newArticles: any[] = [];
          for (const item of topEntries) {
            if (!item.title || !item.link || existingUrls.has(item.link)) continue;

            // Optional: Skip similarity check if we already have plenty of news to speed up
            if (newArticles.length + currentNews.length > 30) {
              const isDuplicate = existingTitles.some(t => textSimilarity(t, item.title!) > 0.8);
              if (isDuplicate) continue;
            }

            let source = 'Google News';
            const dashIdx = item.title.lastIndexOf(' - ');
            if (dashIdx !== -1) source = item.title.substring(dashIdx + 3).trim();

            newArticles.push({
              title: item.title,
              url: item.link,
              source,
              publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
            });
          }

          // Persist new unique articles
          for (const article of newArticles) {
            const dbArticle = await prisma.newsArticle.upsert({
              where: { url: article.url },
              update: {},
              create: article,
            });

            await prisma.companyNews.upsert({
              where: { companyId_newsId: { companyId: company.id, newsId: dbArticle.id } },
              update: {},
              create: { companyId: company.id, newsId: dbArticle.id },
            });
          }

          await prisma.company.update({
            where: { id: company.id },
            data: { lastNewsFetch: new Date() },
          });
          
          console.log(`Background refresh complete for ${name}: found ${newArticles.length} new articles`);
        } catch (e) {
          console.error(`Background refresh failed for ${name}:`, e);
        }
      });

      if (currentNews.length > 0) {
        // We have old news, return it now and refresh in background
        refreshTask();
        return currentNews;
      } else {
        // No news at all, must wait for the first fetch
        await refreshTask();
        // Fetch again to get the newly persisted items
        const freshLinks = await prisma.companyNews.findMany({
          where: { companyId: company.id },
          include: { news: true },
          orderBy: { news: { publishedAt: 'desc' } },
          take: 50,
        });
        return freshLinks.map(n => n.news);
      }
    }

    return currentNews;
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}
