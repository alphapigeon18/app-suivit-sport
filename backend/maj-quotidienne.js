import prisma from './lib/prisma.js';
import {
    appelApiSports,
    competitionsCibles,
    estLanceEnLigneDeCommande,
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

if (estLanceEnLigneDeCommande(import.meta.url)) {
    majQuotidienne()
        .catch((e) => console.error('❌ Erreur pendant la MAJ quotidienne :', e.message))
        .finally(() => prisma.$disconnect());
}
