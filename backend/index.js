import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import cron from 'node-cron';
import { exec } from 'node:child_process';
import { promisify } from 'util';

// Initialisation
const app = express();
const prisma = new PrismaClient();
const execPromise = promisify(exec);
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// ============================================================================
// ⚙️ FONCTION DE LANCEMENT DES SCRIPTS
// ============================================================================
async function runDailyJobs() {
    console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Début du cycle de mise à jour...`);
    const scripts = ['maj-competitions.js', 'init-calendrier.js', 'maj-quotidienne.js'];
    
    for (const script of scripts) {
        try {
            console.log(`▶️ Lancement de : ${script}`);
            await execPromise(`node ${script}`);
            console.log(`✅ Succès : ${script}`);
        } catch (e) {
            console.error(`❌ Erreur critique sur ${script}:`, e.message);
        }
    }
    console.log("🏁 Cycle autonome terminé.");
}

// ============================================================================
// 🚪 ROUTES API
// ============================================================================

app.get('/', (req, res) => {
    res.send('Serveur opérationnel !');
});

// Route dédiée au déclenchement manuel (utilisée par cron-job.org)
app.get('/cron-daily', async (req, res) => {
    console.log("🚀 Déclenchement manuel du job quotidien...");
    await runDailyJobs();
    res.status(200).send("Job quotidien terminé avec succès");
});

// Exemple de route pour tes compétitions
app.get('/competitions', async (req, res) => {
    try {
        const competitions = await prisma.competition.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(competitions);
    } catch (error) {
        res.status(500).json({ erreur: "Erreur lors de la récupération." });
    }
});

// ============================================================================
// ⏱️ CRON JOB AUTOMATIQUE (Tous les jours à 4h00 du matin)
// ============================================================================
cron.schedule('0 4 * * *', async () => {
    await runDailyJobs();
});

// ============================================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================================
app.listen(port, () => {
    console.log(`🚀 Serveur backend lancé sur le port ${port}`);
});