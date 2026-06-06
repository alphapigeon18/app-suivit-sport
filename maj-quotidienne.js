import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const competitionsCibles = [1, 2, 3, 4, 39, 61, 66, 78, 140];

function determinerStatutMatch(apiShortStatus) {
    const statusMap = { 'TBD': 'SCHEDULED', 'NS': 'SCHEDULED', '1H': 'IN_PLAY', 'HT': 'IN_PLAY', '2H': 'IN_PLAY', 'ET': 'IN_PLAY', 'BT': 'IN_PLAY', 'P': 'IN_PLAY', 'SUSP': 'IN_PLAY', 'INT': 'IN_PLAY', 'LIVE': 'IN_PLAY', 'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED', 'PST': 'POSTPONED', 'CANC': 'POSTPONED', 'ABD': 'POSTPONED', 'AWD': 'POSTPONED', 'WO': 'POSTPONED' };
    return statusMap[apiShortStatus] || 'SCHEDULED';
}

async function majQuotidienne() {
    const dateAujourdhui = new Date().toISOString().split('T')[0];
    console.log(`\n📅 Lancement de la MAJ Quotidienne pour le ${dateAujourdhui}`);

    try {
        const football = await prisma.sport.findFirst({ where: { name: 'Football' } });
        let equipeMystere = await prisma.team.findFirst({ where: { name: 'À déterminer' } });
        
        console.log(`🌍 Appel API : Récupération globale...`);
        const repMatchs = await axios.get(`https://v3.football.api-sports.io/fixtures`, {
            headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
            params: { date: dateAujourdhui }
        });

        const tousMatchsMondiauxAPI = repMatchs.data.response || [];
        const matchsAujourdhui = tousMatchsMondiauxAPI.filter(match => competitionsCibles.includes(match.league.id));

        if (matchsAujourdhui.length === 0) {
            console.log(`😴 Aucun match prévu aujourd'hui.`);
            return;
        }

        console.log(`🔥 ${matchsAujourdhui.length} matchs trouvés. Mise à jour...`);

        let ajouts = 0, misesAJour = 0;

        for (const matchDonnees of matchsAujourdhui) {
            const nomCompetition = matchDonnees.league.name;
            const anneeSaison = matchDonnees.league.season;
            const api_fixture_id = matchDonnees.fixture.id.toString();
            const statutPrisma = determinerStatutMatch(matchDonnees.fixture.status.short);
            const phaseMatch = matchDonnees.league.round;
            const dateMatch = new Date(matchDonnees.fixture.date);

            // 🚀 EXTRACTION DES BUTEURS (Events)
            const buteurs = (matchDonnees.events || [])
                .filter(e => e.type === 'Goal')
                .map(e => ({
                    joueur: e.player.name,
                    minute: e.time.elapsed,
                    equipe: e.team.name
                }));

            const competition = await prisma.competition.findFirst({ where: { name: nomCompetition } });
            if (!competition) continue; 

            let saison = await prisma.season.findFirst({ where: { competition_id: competition.competition_id, year_label: anneeSaison.toString() } });
            if (!saison) {
                saison = await prisma.season.create({ data: { competition_id: competition.competition_id, year_label: anneeSaison.toString() } });
            }

            let eqDom = equipeMystere;
            if (matchDonnees.teams.home && matchDonnees.teams.home.name) {
                eqDom = await prisma.team.findFirst({ where: { name: matchDonnees.teams.home.name }}) || await prisma.team.create({ data: { name: matchDonnees.teams.home.name, logo_url: matchDonnees.teams.home.logo, sport_id: football.sport_id }});
            }

            let eqExt = equipeMystere;
            if (matchDonnees.teams.away && matchDonnees.teams.away.name) {
                eqExt = await prisma.team.findFirst({ where: { name: matchDonnees.teams.away.name }}) || await prisma.team.create({ data: { name: matchDonnees.teams.away.name, logo_url: matchDonnees.teams.away.logo, sport_id: football.sport_id }});
            }

            const matchExistant = await prisma.match.findFirst({ where: { api_id: api_fixture_id } });

            // 🚀 MISE À JOUR AVEC ÉVÉNEMENTS (JSON)
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
                events: buteurs // On insère les buteurs ici
            };

            if (!matchExistant) {
                await prisma.match.create({ data: donneesMatch });
                ajouts++;
            } else {
                await prisma.match.update({ where: { match_id: matchExistant.match_id }, data: donneesMatch });
                misesAJour++;
            }
        }
        
        console.log(`✅ Bilan du jour : ${ajouts} créés, ${misesAJour} mis à jour.`);

    } catch (erreur) {
        console.error("❌ Erreur pendant la mise à jour quotidienne :", erreur.message);
    } finally {
        await prisma.$disconnect();
    }
}

majQuotidienne();