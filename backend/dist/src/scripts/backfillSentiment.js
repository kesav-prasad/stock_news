"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function run() {
    const articles = await prisma.newsArticle.findMany({ where: { sentiment: null } });
    let updated = 0;
    for (const article of articles) {
        const titleLower = article.title.toLowerCase();
        const bullishWords = /\b(surge|jump|soar|buy|upgrade|record|profit|gain|growth|rally|soars|up|higher|revenue|win|bull|expansion|beat|outperform)\b/i;
        const bearishWords = /\b(plunge|drop|fall|sell|downgrade|loss|decline|miss|down|lower|lawsuit|bear|shrink|underperform|crash|weakness|probe|investigate|fraud|scam|fine)\b/i;
        let sentiment = 'neutral';
        if (bearishWords.test(titleLower) && !bullishWords.test(titleLower))
            sentiment = 'bearish';
        else if (bullishWords.test(titleLower) && !bearishWords.test(titleLower))
            sentiment = 'bullish';
        if (sentiment !== 'neutral') {
            await prisma.newsArticle.update({
                where: { id: article.id },
                data: { sentiment }
            });
            updated++;
        }
    }
    console.log(`Backfilled ${updated} non-neutral out of ${articles.length} missing sentiments.`);
}
run().finally(() => prisma.$disconnect());
