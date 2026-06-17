import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma.js';
import { majCalendrier } from './maj-calendrier.js';
import { majQuotidienne, finaliserMatchsBloques, enrichirButeurs } from './maj-quotidienne.js';
import { notifierMatchsTermines, envoyerATous } from './lib/notifications.js';
import { construireICS } from './lib/calendar.js';

// Initialisation
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// ============================================================================
// 🛡️ FILETS DE SÉCURITÉ : le serveur ne doit JAMAIS planter sur une erreur
// isolée (base Neon momentanément injoignable, API tierce, etc.). On journalise
// et on continue, plutôt que de laisser le process mourir et Railway redémarrer.
// ============================================================================
process.on('unhandledRejection', (raison) => {
    console.error('⚠️ Rejet non géré (ignoré) :', raison?.message || raison);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ Exception non gérée (ignorée) :', err?.message || err);
});

// Réessaie une opération (utile pour réveiller Neon qui se met en veille en
// plan gratuit : le 1er appel après inactivité peut échouer le temps du réveil).
async function avecReessai(fn, essais = 3, attenteMs = 2500) {
    for (let i = 0; i < essais; i++) {
        try {
            return await fn();
        } catch (erreur) {
            if (i === essais - 1) throw erreur;
            console.warn(`⏳ Base injoignable, nouvel essai ${i + 1}/${essais - 1}...`);
            await new Promise((r) => setTimeout(r, attenteMs));
        }
    }
}

// ============================================================================
// ⚙️ CYCLE DE MISE À JOUR (déclenché par le ping cron-job.org toutes les 10 min)
//
// Le ping ne sert qu'à garder le serveur éveillé. Le cycle décide quoi faire
// avec des contrôles en BASE (gratuits) ; il n'appelle l'API-Football QUE :
//   - 1 fois par jour (après 4h) : synchro complète du calendrier + finalisation
//   - pendant la FENÊTRE HORAIRE d'un match (du coup d'envoi à +2h40) : scores
//   - quand un match est resté bloqué après son horaire : finalisation ciblée
// Hors de ces cas, le ping ne fait qu'une lecture en base : zéro appel API.
// ============================================================================
const FENETRE_FIN_MS = 160 * 60 * 1000;   // durée max d'un match (prolongations + t.a.b.)
const HEURE_SYNC_UTC = 4;                  // synchro quotidienne après 4h (UTC)

let jobEnCours = false;
let dernierJourSync = null;

function syncQuotidienneDue() {
    const now = new Date();
    return now.getUTCHours() >= HEURE_SYNC_UTC && now.toISOString().slice(0, 10) !== dernierJourSync;
}

// Y a-t-il un match dans sa fenêtre horaire (coup d'envoi imminent ou en cours) ?
// Basé sur start_time, PAS sur le statut → insensible aux matchs bloqués.
async function fenetreMatchActive() {
    const maintenant = Date.now();
    const n = await prisma.match.count({
        where: {
            status: { in: ['SCHEDULED', 'IN_PLAY'] },
            start_time: {
                gte: new Date(maintenant - FENETRE_FIN_MS), // a commencé il y a moins de 2h40
                lte: new Date(maintenant + 5 * 60 * 1000),  // ou commence dans moins de 5 min
            },
        },
    });
    return n > 0;
}

// Un match a-t-il dépassé sa fenêtre sans être finalisé ?
async function aDesMatchsBloques() {
    const maintenant = Date.now();
    const n = await prisma.match.count({
        where: {
            status: { in: ['SCHEDULED', 'IN_PLAY'] },
            api_id: { not: null },
            start_time: {
                gte: new Date(maintenant - 3 * 24 * 60 * 60 * 1000),
                lt: new Date(maintenant - FENETRE_FIN_MS),
            },
        },
    });
    return n > 0;
}

async function executerCycle() {
    if (jobEnCours) {
        console.log('⏭️ Un cycle est déjà en cours, on ignore ce déclenchement.');
        return;
    }
    jobEnCours = true;
    try {
        // Réveille la base (Neon se met en veille) avec réessai. Si elle reste
        // injoignable, on abandonne proprement ce cycle (le prochain ping réessaiera).
        try {
            await avecReessai(() => prisma.$queryRaw`SELECT 1`);
        } catch (erreur) {
            console.error('❌ Base injoignable, cycle ignoré :', erreur.message);
            return;
        }

        if (syncQuotidienneDue()) {
            console.log(`\n🔄 [${new Date().toISOString()}] Synchro quotidienne...`);
            dernierJourSync = new Date().toISOString().slice(0, 10);
            try {
                await majCalendrier();
            } catch (erreur) {
                console.error('❌ Erreur calendrier (football-data) :', erreur.message);
            }
            try {
                await finaliserMatchsBloques();
            } catch (erreur) {
                console.error('❌ Erreur finalisation :', erreur.message);
            }
            // ⛔ Buteurs désactivés (17 juin 2026) : le compte API-Sports a été suspendu
            // (quota 100/j dépassé pendant la Coupe du Monde). enrichirButeurs matraquait
            // /fixtures/events (1 appel/match) → cause probable de la suspension.
            // Réactiver la ligne ci-dessous une fois le compte API-Sports rétabli.
            // try { await enrichirButeurs(30, 2000); } catch (erreur) { console.error('❌ Erreur buteurs :', erreur.message); }
            console.log('🏁 Synchro quotidienne terminée.');
        } else if (await fenetreMatchActive()) {
            console.log('⚽ Match dans sa fenêtre horaire : rafraîchissement des scores...');
            try {
                await majQuotidienne();
            } catch (erreur) {
                console.error('❌ Erreur rafraîchissement live :', erreur.message);
            }
            // ⛔ Buteurs désactivés (voir note plus haut) — réactiver quand API-Sports refonctionne.
            // try { await enrichirButeurs(6, 3); } catch (erreur) { console.error('❌ Erreur buteurs :', erreur.message); }
        } else if (await aDesMatchsBloques()) {
            try {
                await finaliserMatchsBloques();
            } catch (erreur) {
                console.error('❌ Erreur finalisation :', erreur.message);
            }
        }
        // (sinon : rien — le ping n'a fait que des lectures en base, aucun appel API)

        // On notifie les matchs qui viennent de passer à « terminé »
        try {
            await notifierMatchsTermines();
        } catch (erreur) {
            console.error('❌ Erreur notifications fin de match :', erreur.message);
        }
    } catch (erreur) {
        // Dernier filet : aucune erreur du cycle ne doit faire planter le serveur
        console.error('❌ Erreur inattendue du cycle :', erreur.message);
    } finally {
        jobEnCours = false;
    }
}

// ============================================================================
// 🚪 ROUTES API
// ============================================================================

app.get('/', (req, res) => {
    res.send('Serveur opérationnel !');
});

// Déclenchement du cycle de mise à jour (pingé par cron-job.org toutes les 10 min).
// Protégé par un token (variable d'environnement CRON_SECRET).
app.get('/cron-daily', (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const tokenRecu = req.query.token || req.get('x-cron-token');
        if (tokenRecu !== secret) {
            return res.status(403).send('Accès refusé.');
        }
    }

    // On répond tout de suite (cron-job.org a un timeout court),
    // le cycle continue en arrière-plan.
    res.status(202).send('Cycle de mise à jour lancé.');
    executerCycle().catch((e) => console.error('❌ Cycle :', e.message));
});

// Liste des compétitions (page d'accueil)
app.get('/competitions', async (req, res) => {
    try {
        const competitions = await prisma.competition.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(competitions);
    } catch (erreur) {
        console.error('❌ /competitions :', erreur.message);
        res.status(500).json({ erreur: 'Erreur lors de la récupération.' });
    }
});

// Liste des équipes (sélecteur de préférences de notification)
app.get('/teams', async (req, res) => {
    try {
        const teams = await prisma.team.findMany({
            where: { name: { not: 'À déterminer' } },
            select: { team_id: true, name: true, logo_url: true },
            orderBy: { name: 'asc' },
        });
        res.json(teams);
    } catch (erreur) {
        console.error('❌ /teams :', erreur.message);
        res.status(500).json({ erreur: 'Erreur lors de la récupération.' });
    }
});

// Détail d'une compétition : infos, saisons et tous les matchs (page détail)
app.get('/competitions/:id/matchs', async (req, res) => {
    try {
        const ligue = await prisma.competition.findUnique({
            where: { competition_id: req.params.id },
        });
        if (!ligue) {
            return res.status(404).json({ erreur: 'Compétition introuvable.' });
        }

        const saisons = await prisma.season.findMany({
            where: { competition_id: ligue.competition_id },
            orderBy: { year_label: 'desc' },
        });

        const matchsBruts = await prisma.match.findMany({
            where: { season: { competition_id: ligue.competition_id } },
            include: {
                team_match_home_team_idToteam: true,
                team_match_away_team_idToteam: true,
            },
            orderBy: { start_time: 'asc' },
        });

        // On renomme les relations Prisma en home_team / away_team pour le frontend
        const matchs = matchsBruts.map(
            ({ team_match_home_team_idToteam: home_team, team_match_away_team_idToteam: away_team, ...match }) => ({
                ...match,
                home_team,
                away_team,
            })
        );

        res.json({ ligue, saisons, matchs });
    } catch (erreur) {
        console.error('❌ /competitions/:id/matchs :', erreur.message);
        res.status(500).json({ erreur: 'Erreur lors de la récupération.' });
    }
});

// ============================================================================
// 🔔 NOTIFICATIONS PUSH (Web Push natif)
// ============================================================================

// Clé publique VAPID (le frontend en a besoin pour s'abonner)
app.get('/notifications/vapid-public-key', (req, res) => {
    const cle = process.env.VAPID_PUBLIC_KEY;
    if (!cle) return res.status(503).json({ erreur: 'Notifications non configurées.' });
    res.json({ publicKey: cle });
});

// Enregistre l'abonnement d'un appareil. Par défaut, un nouvel appareil
// suit toutes les compétitions (l'utilisateur affine ensuite ses préférences).
app.post('/notifications/subscribe', async (req, res) => {
    try {
        const sub = req.body;
        if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
            return res.status(400).json({ erreur: 'Abonnement invalide.' });
        }
        const comps = await prisma.competition.findMany({ select: { competition_id: true } });
        await prisma.push_subscription.upsert({
            where: { endpoint: sub.endpoint },
            create: {
                endpoint: sub.endpoint,
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                competitions: comps.map((c) => c.competition_id),
            },
            update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, // ne touche pas aux préférences
        });
        res.status(201).json({ ok: true });
    } catch (erreur) {
        console.error('❌ /notifications/subscribe :', erreur.message);
        res.status(500).json({ erreur: 'Erreur abonnement.' });
    }
});

// Préférences d'un appareil (compétitions + équipes suivies)
app.get('/notifications/preferences', async (req, res) => {
    try {
        const endpoint = req.query.endpoint;
        if (!endpoint) return res.status(400).json({ erreur: 'endpoint manquant.' });
        const ab = await prisma.push_subscription.findUnique({ where: { endpoint } });
        if (!ab) return res.status(404).json({ erreur: 'Abonnement introuvable.' });
        res.json({ id: ab.id, competitions: ab.competitions, teams: ab.teams });
    } catch (erreur) {
        console.error('❌ GET /notifications/preferences :', erreur.message);
        res.status(500).json({ erreur: 'Erreur préférences.' });
    }
});

app.post('/notifications/preferences', async (req, res) => {
    try {
        const { endpoint, competitions, teams } = req.body;
        if (!endpoint) return res.status(400).json({ erreur: 'endpoint manquant.' });
        await prisma.push_subscription.update({
            where: { endpoint },
            data: {
                competitions: Array.isArray(competitions) ? competitions : [],
                teams: Array.isArray(teams) ? teams : [],
            },
        });
        res.json({ ok: true });
    } catch (erreur) {
        console.error('❌ POST /notifications/preferences :', erreur.message);
        res.status(500).json({ erreur: 'Erreur préférences.' });
    }
});

// Supprime l'abonnement d'un appareil
app.post('/notifications/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) await prisma.push_subscription.deleteMany({ where: { endpoint } });
        res.json({ ok: true });
    } catch (erreur) {
        console.error('❌ /notifications/unsubscribe :', erreur.message);
        res.status(500).json({ erreur: 'Erreur désabonnement.' });
    }
});

// Envoi d'une notification de test à tous les abonnés (protégé par token).
// Accessible en GET (pratique depuis un navigateur) ou POST.
async function envoyerNotificationTest(req, res) {
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const token = req.query.token || req.get('x-cron-token');
        if (token !== secret) return res.status(403).send('Accès refusé.');
    }
    const base = (process.env.FRONTEND_URL || 'https://alphapigeon18.github.io/app-suivit-sport').replace(/\/$/, '');
    const resultat = await envoyerATous({
        title: '🏆 SuiviSport',
        body: 'Notification de test — tout fonctionne !',
        url: base,
        icon: `${base}/pwa-192x192.png`,
        badge: `${base}/badge-96x96.png`,
    });
    res.json(resultat);
}
app.get('/notifications/test', envoyerNotificationTest);
app.post('/notifications/test', envoyerNotificationTest);

// ============================================================================
// 📅 FLUX CALENDRIER (.ics) — matchs suivis d'un appareil
// L'identifiant de l'abonnement sert de jeton (URL non devinable).
// L'agenda de l'utilisateur s'y abonne et se rafraîchit tout seul.
// ============================================================================
app.get('/calendar/:token', async (req, res) => {
    try {
        const id = req.params.token.replace(/\.ics$/i, '');
        const ab = await prisma.push_subscription.findUnique({ where: { id } });
        if (!ab) return res.status(404).send('Calendrier introuvable.');

        // Mêmes critères que les notifications : compétition suivie OU équipe suivie.
        // On garde les matchs récents (résultats) et tous les matchs à venir.
        const matchs = await prisma.match.findMany({
            where: {
                start_time: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) },
                OR: [
                    { season: { competition_id: { in: ab.competitions } } },
                    { home_team_id: { in: ab.teams } },
                    { away_team_id: { in: ab.teams } },
                ],
            },
            include: {
                team_match_home_team_idToteam: true,
                team_match_away_team_idToteam: true,
                season: { include: { competition: true } },
            },
            orderBy: { start_time: 'asc' },
            take: 400,
        });

        const ics = construireICS(matchs, 'SuiviSport — Mes matchs');
        res.set('Content-Type', 'text/calendar; charset=utf-8');
        // ?dl=1 → téléchargement du fichier (import ponctuel, utile sur Android)
        const disposition = req.query.dl ? 'attachment' : 'inline';
        res.set('Content-Disposition', `${disposition}; filename="suivisport.ics"`);
        res.send(ics);
    } catch (erreur) {
        console.error('❌ /calendar :', erreur.message);
        res.status(500).send('Erreur calendrier.');
    }
});

// ============================================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================================
app.listen(port, () => {
    console.log(`🚀 Serveur backend lancé sur le port ${port}`);
    if (!process.env.CRON_SECRET) {
        console.warn('⚠️ CRON_SECRET non défini : /cron-daily est accessible sans token !');
    }
});
