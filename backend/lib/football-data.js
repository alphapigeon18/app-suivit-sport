import axios from 'axios';
import prisma from './prisma.js';
import { normaliserNomEquipe, trouverEquipeParNom } from './football.js';

// 🎯 Compétitions disponibles sur le plan gratuit de football-data.org,
// reliées à nos compétitions existantes via leur ID API-Sports.
// (Europa League et Coupe de France ne sont pas dans le plan gratuit :
// elles restent alimentées par API-Sports via la MAJ quotidienne.)
export const competitionsFootballData = [
    { code: 'WC', apiSportsId: 1 },   // Coupe du Monde
    { code: 'CL', apiSportsId: 2 },   // Champions League
    { code: 'EC', apiSportsId: 4 },   // Euro
    { code: 'PL', apiSportsId: 39 },  // Premier League
    { code: 'FL1', apiSportsId: 61 }, // Ligue 1
    { code: 'BL1', apiSportsId: 78 }, // Bundesliga
    { code: 'PD', apiSportsId: 140 }, // La Liga
];

// Appel à l'API football-data.org (v4)
export async function appelFootballData(endpoint, params = {}) {
    if (!process.env.FOOTBALL_DATA_KEY) {
        throw new Error('FOOTBALL_DATA_KEY non défini (clé gratuite sur football-data.org/client/register)');
    }
    const reponse = await axios.get(`https://api.football-data.org/v4/${endpoint}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY },
        params,
    });
    return reponse.data;
}

const statutsFd = {
    'SCHEDULED': 'SCHEDULED', 'TIMED': 'SCHEDULED',
    'IN_PLAY': 'IN_PLAY', 'PAUSED': 'IN_PLAY', 'LIVE': 'IN_PLAY',
    'FINISHED': 'FINISHED', 'AWARDED': 'FINISHED',
    'POSTPONED': 'POSTPONED', 'SUSPENDED': 'POSTPONED', 'CANCELLED': 'POSTPONED',
};

export function determinerStatutFd(statutApi) {
    return statutsFd[statutApi] || 'SCHEDULED';
}

// Phases à élimination directe, dans le même format qu'API-Sports
// pour que le frontend les traduise de la même façon
const phasesFd = {
    'LAST_64': 'Round of 64',
    'LAST_32': 'Round of 32',
    'LAST_16': 'Round of 16',
    'PLAYOFFS': 'Play-offs',
    'PLAY_OFF_ROUND': 'Play-offs',
    'QUARTER_FINALS': 'Quarter-finals',
    'SEMI_FINALS': 'Semi-finals',
    'THIRD_PLACE': '3rd Place Final',
    'FINAL': 'Final',
};

// Construit la phase d'un match football-data ("Group A - Journée 2",
// "Quarter-finals", "Regular Season - 15"...)
export function determinerPhaseFd(matchFd) {
    if (matchFd.group) {
        // "GROUP_A" → "Group A" (format attendu par le frontend)
        const groupe = matchFd.group.replace('_', ' ').replace(/^GROUP/i, 'Group');
        return matchFd.matchday ? `${groupe} - Journée ${matchFd.matchday}` : groupe;
    }
    if (phasesFd[matchFd.stage]) return phasesFd[matchFd.stage];
    if (matchFd.stage === 'REGULAR_SEASON') return `Regular Season - ${matchFd.matchday}`;
    if (matchFd.stage === 'LEAGUE_STAGE') return `League Stage - ${matchFd.matchday}`;
    return matchFd.stage;
}

// Retrouve une équipe par son ID football-data (avec rattrapage par nom
// pour les équipes créées par API-Sports), ou la crée.
export async function obtenirEquipeFd(equipeFd, sportId) {
    if (!equipeFd?.id || !equipeFd?.name) return null;

    let existante = await prisma.team.findUnique({ where: { fd_id: equipeFd.id } });
    if (!existante) existante = await trouverEquipeParNom(equipeFd.name);

    if (existante) {
        if (existante.fd_id !== equipeFd.id) {
            return prisma.team.update({
                where: { team_id: existante.team_id },
                data: { fd_id: equipeFd.id, logo_url: existante.logo_url || equipeFd.crest },
            });
        }
        return existante;
    }

    return prisma.team.create({
        data: { fd_id: equipeFd.id, name: equipeFd.name, logo_url: equipeFd.crest, sport_id: sportId },
    });
}
