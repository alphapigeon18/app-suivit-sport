import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import cron from 'node-cron';
import { exec } from 'node:child_process';

// Initialisation
const app = express();
const prisma = new PrismaClient();
const port = 3000;

// ============================================================================
// ⚙️ MIDDLEWARES
// ============================================================================
app.use(express.json()); 
app.use(cors()); 

// ============================================================================
// 🚪 ROUTES API
// ============================================================================

// 1. Route pour récupérer ton catalogue de compétitions
app.get('/competitions', async (req, res) => {
    try {
        console.log("📥 Une application demande la liste des compétitions...");
        const competitions = await prisma.competition.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(competitions);
    } catch (error) {
        console.error("❌ Erreur serveur :", error);
        res.status(500).json({ erreur: "Impossible de récupérer les compétitions." });
    }
});

// 2. Route pour récupérer les matchs (limité aux 50 prochains)
app.get('/matchs', async (req, res) => {
    try {
        console.log("📥 Une application demande la liste des matchs...");
        const matchs = await prisma.match.findMany({
            take: 50,
            orderBy: { start_time: 'asc' }
        });
        res.json(matchs);
    } catch (error) {
        console.error("❌ Erreur serveur :", error);
        res.status(500).json({ erreur: "Impossible de récupérer les matchs." });
    }
});

// 3. Route : Récupérer les infos de la ligue ET son calendrier
app.get('/competitions/:id/matchs', async (req, res) => {
    try {
        const competitionId = req.params.id;
        console.log(`\n📥 Demande reçue pour la compétition ID: ${competitionId}`);
        
        const ligue = await prisma.competition.findFirst({
            where: { competition_id: competitionId }
        });

        // Récupération des saisons pour le menu déroulant
        const saisons = await prisma.season.findMany({
            where: { competition_id: competitionId },
            orderBy: { year_label: 'desc' }
        });

        const matchsBruts = await prisma.match.findMany({
            where: { season: { competition_id: competitionId } },
            include: {
                team_match_home_team_idToteam: true,
                team_match_away_team_idToteam: true
            },
            orderBy: { start_time: 'asc' }
        });

        const matchsPropres = matchsBruts.map(match => ({
            match_id: match.match_id,
            season_id: match.season_id,
            start_time: match.start_time,
            status: match.status,
            phase: match.phase,
            home_score: match.home_score,
            away_score: match.away_score,
            home_penalty: match.home_penalty,
            away_penalty: match.away_penalty,
            home_winner: match.home_winner,
            away_winner: match.away_winner,
            home_team: match.team_match_home_team_idToteam,
            away_team: match.team_match_away_team_idToteam
        }));

        res.json({
            ligue: ligue,
            saisons: saisons,
            matchs: matchsPropres
        });

    } catch (error) {
        console.error("❌ Erreur serveur :", error);
        res.status(500).json({ erreur: "Impossible de récupérer le calendrier." });
    }
});

// ⏱️ CRON : Planificateur de tâches (Exécution toutes les 5 minutes)
// ⏱️ CRON : Planificateur de tâches (Exécution quotidienne à 04:00 du matin)
cron.schedule('0 4 * * *', async () => {
    console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Début du cycle autonome quotidien...`);

    const execPromise = (script) => new Promise((resolve) => {
        exec(`node --env-file=.env ${script}`, (err, stdout, stderr) => {
            if (err) console.error(`❌ Erreur sur ${script}: ${err.message}`);
            if (stderr) console.error(`⚠️ Avertissement sur ${script}: ${stderr}`);
            console.log(`✅ Fin ${script} : \n${stdout}`);
            resolve();
        });
    });

    try {
        // 1. Veille : Cherche les nouvelles saisons/éditions
        await execPromise('maj-competitions.js');
        
        // 2. Structuration : Synchronise le calendrier sur 14 jours 
        // (pour que les "À déterminer" deviennent des noms d'équipes)
        await execPromise('init-calendrier.js');
        
        // 3. Mise à jour : Score et buteurs des matchs en cours/finis
        await execPromise('maj-quotidienne.js');
        
        console.log("🏁 Cycle autonome terminé avec succès.");
    } catch (e) {
        console.error("❌ Erreur critique dans le cycle cron :", e);
    }
});
// Petite fonction utilitaire pour utiliser await avec exec
import { promisify } from 'util';
const execPromise = promisify(exec);
// Ajoute une route dédiée au déclenchement du cron
app.get('/cron-daily', async (req, res) => {
    console.log("🚀 Déclenchement manuel du job quotidien...");
    await execPromise('node maj-competitions.js');
    await execPromise('node init-calendrier.js');
    await execPromise('node maj-quotidienne.js');
    res.status(200).send("Job terminé");
});
app.get('/', (req, res) => {
    res.send('Serveur opérationnel !');
});

// ============================================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================================
app.listen(port, () => {
    console.log(`\n🚀 Serveur API ouvert et en écoute sur le port ${port}`);
});