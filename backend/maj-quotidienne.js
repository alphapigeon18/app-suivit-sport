import prisma from './lib/prisma.js';
import {
    appelApiSports,
    competitionsCibles,
    estLanceEnLigneDeCommande,
    obtenirEquipeMystere,
    obtenirSaison,
    obtenirSportFootball,
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

if (estLanceEnLigneDeCommande(import.meta.url)) {
    majQuotidienne()
        .catch((e) => console.error('❌ Erreur pendant la MAJ quotidienne :', e.message))
        .finally(() => prisma.$disconnect());
}
