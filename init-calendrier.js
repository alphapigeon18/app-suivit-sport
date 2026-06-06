import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const competitionsCibles = [1, 2, 3, 4, 39, 61, 66, 78, 140];

function determinerStatutMatch(apiShortStatus) {
    const statusMap = { 'TBD': 'SCHEDULED', 'NS': 'SCHEDULED', '1H': 'IN_PLAY', 'HT': 'IN_PLAY', '2H': 'IN_PLAY', 'ET': 'IN_PLAY', 'BT': 'IN_PLAY', 'P': 'IN_PLAY', 'SUSP': 'IN_PLAY', 'INT': 'IN_PLAY', 'LIVE': 'IN_PLAY', 'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED', 'PST': 'POSTPONED', 'CANC': 'POSTPONED', 'ABD': 'POSTPONED', 'AWD': 'POSTPONED', 'WO': 'POSTPONED' };
    return statusMap[apiShortStatus] || 'SCHEDULED';
}

async function initialiserCatalogueComplet() {
    console.log("🚀 Démarrage de l'initialisation massive du calendrier...");
    const football = await prisma.sport.findFirst({ where: { name: 'Football' } });

    let equipeMystere = await prisma.team.findFirst({ where: { name: 'À déterminer' } });
    if (!equipeMystere) {
        equipeMystere = await prisma.team.create({ data: { name: 'À déterminer', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Question_mark_grey.svg/120px-Question_mark_grey.svg.png', sport_id: football.sport_id } });
    }

    for (const apiLeagueId of competitionsCibles) {
        try {
            const repLigue = await axios.get(`https://v3.football.api-sports.io/leagues?id=${apiLeagueId}`, { headers: { 'x-apisports-key': process.env.API_SPORTS_KEY } });
            const donneesLigue = repLigue.data.response[0];
            if (!donneesLigue) continue;

            const nomCompetition = donneesLigue.league.name;
            const saisonActuelle = donneesLigue.seasons.find(s => s.current === true);
            const seasonYear = saisonActuelle.year;

            console.log(`\n=============================================`);
            console.log(`🏆 Traitement de : ${nomCompetition} (Saison ${seasonYear})`);

            const competition = await prisma.competition.findFirst({ where: { name: nomCompetition } });
            if (!competition) continue;

            let saison = await prisma.season.findFirst({ where: { competition_id: competition.competition_id, year_label: seasonYear.toString() } });
            if (!saison) {
                saison = await prisma.season.create({ data: { competition_id: competition.competition_id, year_label: seasonYear.toString() } });            }

            const repMatchs = await axios.get(`https://v3.football.api-sports.io/fixtures`, { headers: { 'x-apisports-key': process.env.API_SPORTS_KEY }, params: { league: apiLeagueId, season: seasonYear } });
            const matchsAPI = repMatchs.data.response || [];

            let ajouts = 0, misesAJour = 0;

            for (const matchDonnees of matchsAPI) {
                const api_fixture_id = matchDonnees.fixture.id.toString();
                const dateMatch = new Date(matchDonnees.fixture.date);
                const statutPrisma = determinerStatutMatch(matchDonnees.fixture.status.short);
                const phaseMatch = matchDonnees.league.round;

                // 🚀 EXTRACTION DES BUTEURS
                const buteurs = (matchDonnees.events || [])
                    .filter(e => e.type === 'Goal')
                    .map(e => ({
                        joueur: e.player.name,
                        minute: e.time.elapsed,
                        equipe: e.team.name
                    }));

                let eqDom = equipeMystere;
                if (matchDonnees.teams.home?.name) {
                    eqDom = await prisma.team.findFirst({ where: { name: matchDonnees.teams.home.name }}) || await prisma.team.create({ data: { name: matchDonnees.teams.home.name, logo_url: matchDonnees.teams.home.logo, sport_id: football.sport_id }});
                }

                let eqExt = equipeMystere;
                if (matchDonnees.teams.away?.name) {
                    eqExt = await prisma.team.findFirst({ where: { name: matchDonnees.teams.away.name }}) || await prisma.team.create({ data: { name: matchDonnees.teams.away.name, logo_url: matchDonnees.teams.away.logo, sport_id: football.sport_id }});
                }

                // 🚀 OBJET DE DONNÉES UNIFIÉ
                const donneesMatch = { 
                    season_id: saison.season_id, 
                    home_team_id: eqDom.team_id, 
                    away_team_id: eqExt.team_id, 
                    start_time: dateMatch, 
                    status: statutPrisma, 
                    home_score: matchDonnees.goals.home || 0, 
                    away_score: matchDonnees.goals.away || 0, 
                    api_id: api_fixture_id, 
                    phase: phaseMatch, 
                    home_penalty: matchDonnees.score?.penalty?.home ?? null, 
                    away_penalty: matchDonnees.score?.penalty?.away ?? null, 
                    home_winner: matchDonnees.teams.home.winner ?? null, 
                    away_winner: matchDonnees.teams.away.winner ?? null,
                    events: buteurs 
                };

                const matchExistant = await prisma.match.findFirst({ where: { api_id: api_fixture_id } });
                
                if (!matchExistant) {
                    await prisma.match.create({ data: donneesMatch });
                    ajouts++;
                } else {
                    await prisma.match.update({ where: { match_id: matchExistant.match_id }, data: donneesMatch });
                    misesAJour++;
                }
            }
            console.log(`✅ OK : ${ajouts} ajouts, ${misesAJour} mises à jour.`);
            await pause(6500);
        } catch (err) {
            console.error(`❌ Erreur sur la ligue ${apiLeagueId}:`, err.message);
        }
    }
    console.log(`\n🏁 Initialisation terminée !`);
    await prisma.$disconnect();
}

initialiserCatalogueComplet();