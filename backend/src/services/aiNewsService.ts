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
  symbol: string,
  name: string
) {
  try {
    const query = encodeURIComponent(`${name} stock India when:2y`);
    const feed = await parser.parseURL(
      `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`
    );

    const topEntries = feed.items.slice(0, 50);

    const company = await prisma.company.findUnique({ where: { symbol } });
    if (!company) return [];

    // Fetch existing news for this company to check for duplicates
    const existingLinks = await prisma.companyNews.findMany({
      where: { companyId: company.id },
      include: { news: true },
    });
    const existingTitles = existingLinks.map((en) => en.news.title);
    const existingUrls = new Set(existingLinks.map((en) => en.news.url));

    const newArticles: any[] = [];

    for (const item of topEntries) {
      if (!item.title || !item.link) continue;

      // 1. Skip exact URL duplicate
      if (existingUrls.has(item.link)) continue;

      // 2. Skip if title is semantically too similar to any existing title (Jaccard > 0.6)
      const isDuplicate = existingTitles.some(
        (existing) => textSimilarity(existing, item.title!) > 0.6
      );
      if (isDuplicate) continue;

      // 3. Also skip if too similar to another article in this batch
      const batchDuplicate = newArticles.some(
        (a) => textSimilarity(a.title, item.title!) > 0.6
      );
      if (batchDuplicate) continue;

      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      // Extract source from title (Google News format: "Title - Source")
      let source = 'Google News';
      const dashIdx = item.title.lastIndexOf(' - ');
      if (dashIdx !== -1) {
        source = item.title.substring(dashIdx + 3).trim();
      }

      newArticles.push({
        title: item.title,
        link: item.link,
        source,
        publishedAt,
      });
    }

    // Persist new unique articles
    for (const article of newArticles) {
      try {
        const dbArticle = await prisma.newsArticle.create({
          data: {
            title: article.title,
            url: article.link,
            source: article.source,
            publishedAt: article.publishedAt,
          },
        });
        await prisma.companyNews.create({
          data: {
            companyId: company.id,
            newsId: dbArticle.id,
          },
        });
      } catch {
        // URL unique constraint violation — skip
      }
    }

    // Return all news for this company (latest first)
    const allNews = await prisma.companyNews.findMany({
      where: { companyId: company.id },
      include: { news: true },
      orderBy: { news: { publishedAt: 'desc' } },
      take: 50,
    });

    return allNews.map((n) => n.news);
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}
