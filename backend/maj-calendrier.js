import prisma from './lib/prisma.js';
import {
    estLanceEnLigneDeCommande,
    obtenirEquipeMystere,
    obtenirSaison,
    obtenirSportFootball,
    pause,
    trouverMatchCroise,
} from './lib/football.js';
import {
    appelFootballData,
    competitionsFootballData,
    determinerPhaseFd,
    determinerStatutFd,
    obtenirEquipeFd,
} from './lib/football-data.js';

// Synchronise le calendrier complet de la saison EN COURS de chaque compétition
// via football-data.org (le plan gratuit d'API-Sports n'y a pas accès).
// C'est la source de référence pour la planification : équipes, horaires, phases.
export async function majCalendrier() {
    if (!process.env.FOOTBALL_DATA_KEY) {
        console.warn('⚠️ FOOTBALL_DATA_KEY non défini : synchronisation du calendrier ignorée.');
        console.warn('   → Clé gratuite sur https://www.football-data.org/client/register');
        return;
    }

    console.log('📆 Synchronisation du calendrier (football-data.org)...');
    const football = await obtenirSportFootball();
    const equipeMystere = await obtenirEquipeMystere(football.sport_id);

    for (const { code, apiSportsId } of competitionsFootballData) {
        try {
            const competition = await prisma.competition.findUnique({ where: { api_id: apiSportsId } });
            if (!competition) {
                console.log(`⚠️ Compétition ${code} absente du catalogue (lancer import-competition).`);
                continue;
            }

            // Sans paramètre season, l'API renvoie la saison en cours
            const donnees = await appelFootballData(`competitions/${code}/matches`);
            const matchsFd = donnees.matches || [];
            if (matchsFd.length === 0) {
                console.log(`😴 ${competition.name} : aucun match renvoyé.`);
                continue;
            }

            // Lier la compétition à son ID football-data au premier passage
            const fdCompetitionId = donnees.competition?.id;
            if (fdCompetitionId && competition.fd_id !== fdCompetitionId) {
                await prisma.competition.update({
                    where: { competition_id: competition.competition_id },
                    data: { fd_id: fdCompetitionId },
                });
            }

            // L'année de la saison = année de sa date de début (même convention qu'API-Sports)
            const saisonFd = matchsFd[0].season;
            const annee = parseInt(saisonFd.startDate.slice(0, 4), 10);
            const saison = await obtenirSaison(competition.competition_id, annee);
            await prisma.season.update({
                where: { season_id: saison.season_id },
                data: { start_date: new Date(saisonFd.startDate), end_date: new Date(saisonFd.endDate) },
            });

            console.log(`🏆 ${competition.name} (saison ${annee}) : ${matchsFd.length} matchs reçus.`);

            for (const matchFd of matchsFd) {
                const eqDom = (await obtenirEquipeFd(matchFd.homeTeam, football.sport_id)) || equipeMystere;
                const eqExt = (await obtenirEquipeFd(matchFd.awayTeam, football.sport_id)) || equipeMystere;
                const startTime = new Date(matchFd.utcDate);

                // ⚠️ En cas de tirs au but, football-data les additionne dans
                // fullTime : on les soustrait pour retrouver le vrai score.
                const penalties = matchFd.score?.penalties;
                let scoreDom = matchFd.score?.fullTime?.home ?? null;
                let scoreExt = matchFd.score?.fullTime?.away ?? null;
                if (penalties && scoreDom !== null && scoreExt !== null) {
                    scoreDom -= penalties.home ?? 0;
                    scoreExt -= penalties.away ?? 0;
                }

                const donneesMatch = {
                    season_id: saison.season_id,
                    home_team_id: eqDom.team_id,
                    away_team_id: eqExt.team_id,
                    start_time: startTime,
                    status: determinerStatutFd(matchFd.status),
                    home_score: scoreDom,
                    away_score: scoreExt,
                    home_penalty: penalties?.home ?? null,
                    away_penalty: penalties?.away ?? null,
                    home_winner: matchFd.score?.winner ? matchFd.score.winner === 'HOME_TEAM' : null,
                    away_winner: matchFd.score?.winner ? matchFd.score.winner === 'AWAY_TEAM' : null,
                    phase: determinerPhaseFd(matchFd),
                };

                // Déjà connu via football-data ? Sinon, peut-être créé par API-Sports
                // (même saison + même coup d'envoi) ; sinon, on le crée.
                let existant = await prisma.match.findUnique({ where: { fd_id: matchFd.id } });
                if (!existant) {
                    existant = await trouverMatchCroise(saison.season_id, startTime, matchFd.homeTeam?.name, { fd_id: null });
                }

                if (existant) {
                    await prisma.match.update({
                        where: { match_id: existant.match_id },
                        data: { fd_id: matchFd.id, ...donneesMatch },
                    });
                } else {
                    await prisma.match.create({ data: { fd_id: matchFd.id, ...donneesMatch } });
                }
            }
            console.log(`✅ ${competition.name} synchronisée.`);

            await pause(6500); // Limite du plan gratuit : 10 appels/minute
        } catch (erreur) {
            const detail = erreur.response?.data?.message || erreur.message;
            console.error(`❌ Erreur sur ${code}:`, detail);
        }
    }
    console.log('🏁 Calendrier synchronisé !');
}

if (estLanceEnLigneDeCommande(import.meta.url)) {
    majCalendrier()
        .catch((e) => console.error('❌ Erreur pendant la synchronisation :', e.message))
        .finally(() => prisma.$disconnect());
}
