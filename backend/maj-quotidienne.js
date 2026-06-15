import prisma from './lib/prisma.js';
import {
    appelApiSports,
    competitionsCibles,
    estLanceEnLigneDeCommande,
    normaliserNomEquipe,
    obtenirEquipeMystere,
    obtenirSaison,
    obtenirSportFootball,
    pause,
    upsertMatch,
} from './lib/football.js';

// Met à jour les matchs du jour (scores, statuts, buteurs)
// en un seul appel API global filtré sur les compétitions suivies.
export async function majQuotidienne() {
    const dateAujourdhui = new Date().toISOString().split('T')[0];
    console.log(`📅 MAJ quotidienne pour le ${dateAujourdhui}`);

    const football = await obtenirSportFootball();
    const equipeMystere = await obtenirEquipeMystere(football.sport_id);

    const tousMatchsAPI = await appelApiSports('fixtures', { date: dateAujourdhui });
    const matchsAujourdhui = tousMatchsAPI.filter((m) => competitionsCibles.includes(m.league.id));

    if (matchsAujourdhui.length === 0) {
        console.log("😴 Aucun match prévu aujourd'hui.");
        return;
    }

    console.log(`🔥 ${matchsAujourdhui.length} matchs trouvés. Mise à jour...`);
    let traites = 0;

    for (const matchDonnees of matchsAujourdhui) {
        try {
            const competition = await prisma.competition.findUnique({ where: { api_id: matchDonnees.league.id } });
            if (!competition) continue;

            const saison = await obtenirSaison(competition.competition_id, matchDonnees.league.season);
            await upsertMatch(matchDonnees, saison, football.sport_id, equipeMystere);
            traites++;
        } catch (erreur) {
            console.error(`❌ Erreur sur le match ${matchDonnees.fixture?.id}:`, erreur.message);
        }
    }

    console.log(`✅ Bilan du jour : ${traites} matchs synchronisés.`);
}

// Filet de sécurité : récupère le résultat final des matchs restés bloqués
// (toujours SCHEDULED/IN_PLAY alors que leur horaire est largement dépassé).
// majQuotidienne ne voit que les matchs du JOUR : un match d'hier non finalisé
// ne serait jamais corrigé sans ceci. On va le chercher par son identifiant API.
export async function finaliserMatchsBloques() {
    const maintenant = Date.now();
    const bloques = await prisma.match.findMany({
        where: {
            status: { in: ['SCHEDULED', 'IN_PLAY'] },
            api_id: { not: null },
            start_time: {
                gte: new Date(maintenant - 3 * 24 * 60 * 60 * 1000), // pas plus vieux que 3 jours
                lt: new Date(maintenant - 160 * 60 * 1000),          // horaire dépassé de > 2h40
            },
        },
        take: 20,
    });

    if (bloques.length === 0) return 0;
    console.log(`🔧 Finalisation de ${bloques.length} match(s) bloqué(s)...`);

    const football = await obtenirSportFootball();
    const equipeMystere = await obtenirEquipeMystere(football.sport_id);
    let corriges = 0;

    for (const m of bloques) {
        try {
            const [data] = await appelApiSports('fixtures', { id: m.api_id });
            if (!data) continue;
            const competition = await prisma.competition.findUnique({ where: { api_id: data.league.id } });
            if (!competition) continue;
            const saison = await obtenirSaison(competition.competition_id, data.league.season);
            await upsertMatch(data, saison, football.sport_id, equipeMystere);
            corriges++;
        } catch (erreur) {
            console.error(`❌ Finalisation du match ${m.api_id} :`, erreur.message);
        }
        await pause(6500); // Limite du plan gratuit : 10 appels/minute
    }

    console.log(`✅ ${corriges} match(s) finalisé(s).`);
    return corriges;
}

// Récupère les buteurs des matchs terminés (endpoint /fixtures/events,
// 1 appel par match) qui n'ont pas encore été enrichis. Limité par appel
// pour ménager le quota API-Sports (100/jour). Rattrape le retard au fil
// des cycles. Stocke par but : joueur, minute, côté (home/away), pénalty, csc.
export async function enrichirButeurs(limite = 8, joursMax = 60) {
    const depuis = new Date(Date.now() - joursMax * 24 * 60 * 60 * 1000);
    const matchs = await prisma.match.findMany({
        where: { status: 'FINISHED', api_id: { not: null }, buteurs_charges: false, start_time: { gte: depuis } },
        include: {
            team_match_home_team_idToteam: { select: { api_id: true, name: true } },
            team_match_away_team_idToteam: { select: { api_id: true, name: true } },
        },
        orderBy: { start_time: 'desc' },
        take: limite,
    });

    if (matchs.length === 0) return 0;
    console.log(`⚽ Récupération des buteurs pour ${matchs.length} match(s)...`);
    let n = 0;

    for (const m of matchs) {
        try {
            const events = await appelApiSports('fixtures/events', { fixture: m.api_id });
            const dom = m.team_match_home_team_idToteam;
            const ext = m.team_match_away_team_idToteam;
            const domNorm = normaliserNomEquipe(dom?.name);
            // Rattache un but à domicile/extérieur : par api_id si dispo, sinon par nom
            const coteDe = (team) => {
                if (dom?.api_id != null && team?.id === dom.api_id) return 'home';
                if (ext?.api_id != null && team?.id === ext.api_id) return 'away';
                return normaliserNomEquipe(team?.name) === domNorm ? 'home' : 'away';
            };
            const buteurs = events
                .filter((e) => e.type === 'Goal' && e.detail !== 'Missed Penalty' && e.player?.name)
                .map((e) => {
                    let cote = coteDe(e.team);
                    const csc = e.detail === 'Own Goal';
                    if (csc) cote = cote === 'home' ? 'away' : 'home'; // le csc profite à l'adversaire
                    return { joueur: e.player.name, minute: e.time?.elapsed ?? null, cote, penalty: e.detail === 'Penalty', csc };
                });
            await prisma.match.update({ where: { match_id: m.match_id }, data: { events: buteurs, buteurs_charges: true } });
            n++;
        } catch (erreur) {
            console.error(`❌ Buteurs du match ${m.api_id} :`, erreur.message);
        }
        await pause(6500); // Limite du plan gratuit : 10 appels/minute
    }

    console.log(`✅ Buteurs récupérés pour ${n} match(s).`);
    return n;
}

if (estLanceEnLigneDeCommande(import.meta.url)) {
    majQuotidienne()
        .catch((e) => console.error('❌ Erreur pendant la MAJ quotidienne :', e.message))
        .finally(() => prisma.$disconnect());
}
