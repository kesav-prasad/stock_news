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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function seedCompanies() {
    console.log('Starting company sync...');
    const dataPath = path.join(__dirname, '..', 'data', 'companies_data.json');
    if (!fs.existsSync(dataPath)) {
        console.error('companies_data.json not found! Run generateCompanies.ts first.');
        process.exit(1);
    }
    const allCompanies = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`Loaded ${allCompanies.length} companies from JSON`);
    let inserted = 0;
    const batchSize = 50;
    for (let i = 0; i < allCompanies.length; i += batchSize) {
        const batch = allCompanies.slice(i, i + batchSize);
        await Promise.all(batch.map(async (company) => {
            if (!company.symbol || !company.name)
                return;
            try {
                await prisma.company.upsert({
                    where: { symbol: company.symbol },
                    update: {
                        name: company.name,
                        exchange: company.exchange,
                        sector: company.sector || null,
                        industry: company.industry || null,
                    },
                    create: {
                        symbol: company.symbol,
                        name: company.name,
                        exchange: company.exchange,
                        sector: company.sector || null,
                        industry: company.industry || null,
                    },
                });
                inserted++;
            }
            catch {
                // Skip duplicates
            }
        }));
        if ((i + batchSize) % 500 === 0 || i + batchSize >= allCompanies.length) {
            console.log(`Progress: ${Math.min(i + batchSize, allCompanies.length)}/${allCompanies.length}`);
        }
    }
    console.log(`Synced ${inserted} companies successfully.`);
    await prisma.$disconnect();
}
seedCompanies().then(() => process.exit(0));
