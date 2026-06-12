import axios from 'axios';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from './prisma.js';

// 🎯 LISTE BLANCHE : les IDs API-Sports des compétitions suivies
export const competitionsCibles = [1, 2, 3, 4, 39, 61, 66, 78, 140];

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Appel à l'API API-Sports (la clé est lue à chaque appel, après chargement du .env)
// ⚠️ L'API renvoie toujours un statut 200 : les erreurs (quota, plan, paramètres)
// sont dans le champ "errors" de la réponse, qu'il faut vérifier explicitement.
export async function appelApiSports(endpoint, params = {}) {
    const reponse = await axios.get(`https://v3.football.api-sports.io/${endpoint}`, {
        headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
        params,
    });
    const erreurs = reponse.data.errors;
    const aDesErreurs = Array.isArray(erreurs) ? erreurs.length > 0 : erreurs && Object.keys(erreurs).length > 0;
    if (aDesErreurs) {
        throw new Error(`API-Sports (${endpoint}) : ${JSON.stringify(erreurs)}`);
    }
    return reponse.data.response || [];
}

const statusMap = {
    'TBD': 'SCHEDULED', 'NS': 'SCHEDULED',
    '1H': 'IN_PLAY', 'HT': 'IN_PLAY', '2H': 'IN_PLAY', 'ET': 'IN_PLAY', 'BT': 'IN_PLAY',
    'P': 'IN_PLAY', 'SUSP': 'IN_PLAY', 'INT': 'IN_PLAY', 'LIVE': 'IN_PLAY',
    'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
    'PST': 'POSTPONED', 'CANC': 'POSTPONED', 'ABD': 'POSTPONED', 'AWD': 'POSTPONED', 'WO': 'POSTPONED',
};

export function determinerStatutMatch(apiShortStatus) {
    return statusMap[apiShortStatus] || 'SCHEDULED';
}

export async function obtenirSportFootball() {
    const football = await prisma.sport.findFirst({ where: { name: 'Football' } });
    if (!football) throw new Error("Le sport 'Football' n'existe pas dans la base !");
    return football;
}

// Équipe générique pour les matchs à venir dont les équipes ne sont pas connues (phases finales)
export async function obtenirEquipeMystere(sportId) {
    let equipe = await prisma.team.findFirst({ where: { name: 'À déterminer' } });
    if (!equipe) {
        equipe = await prisma.team.create({
            data: {
                name: 'À déterminer',
                logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Question_mark_grey.svg/120px-Question_mark_grey.svg.png',
                sport_id: sportId,
            },
        });
    }
    return equipe;
}

// Retrouve une équipe par son ID API (avec rattrapage par nom pour les équipes
// créées avant l'ajout de la colonne api_id), ou la crée.
export async function obtenirEquipe(equipeApi, sportId) {
    if (!equipeApi?.id || !equipeApi?.name) return null;

    const existante = await prisma.team.findFirst({
        where: { OR: [{ api_id: equipeApi.id }, { name: equipeApi.name }] },
    });

    if (existante) {
        if (existante.api_id !== equipeApi.id) {
            return prisma.team.update({
                where: { team_id: existante.team_id },
                data: { api_id: equipeApi.id, logo_url: equipeApi.logo },
            });
        }
        return existante;
    }

    return prisma.team.create({
        data: { api_id: equipeApi.id, name: equipeApi.name, logo_url: equipeApi.logo, sport_id: sportId },
    });
}

// Retrouve (ou crée) la saison d'une compétition pour une année donnée
export async function obtenirSaison(competitionId, anneeSaison) {
    const yearLabel = anneeSaison.toString();
    let saison = await prisma.season.findFirst({
        where: { competition_id: competitionId, year_label: yearLabel },
    });
    if (!saison) {
        saison = await prisma.season.create({
            data: { competition_id: competitionId, year_label: yearLabel },
        });
    }
    return saison;
}

// Crée ou met à jour un match à partir des données brutes de l'API
export async function upsertMatch(matchDonnees, saison, sportId, equipeMystere) {
    const buteurs = (matchDonnees.events || [])
        .filter((e) => e.type === 'Goal')
        .map((e) => ({ joueur: e.player.name, minute: e.time.elapsed, equipe: e.team.name }));

    const eqDom = (await obtenirEquipe(matchDonnees.teams.home, sportId)) || equipeMystere;
    const eqExt = (await obtenirEquipe(matchDonnees.teams.away, sportId)) || equipeMystere;

    const donneesMatch = {
        season_id: saison.season_id,
        home_team_id: eqDom.team_id,
        away_team_id: eqExt.team_id,
        start_time: new Date(matchDonnees.fixture.date),
        status: determinerStatutMatch(matchDonnees.fixture.status.short),
        home_score: matchDonnees.goals.home ?? null,
        away_score: matchDonnees.goals.away ?? null,
        phase: matchDonnees.league.round,
        home_penalty: matchDonnees.score?.penalty?.home ?? null,
        away_penalty: matchDonnees.score?.penalty?.away ?? null,
        home_winner: matchDonnees.teams.home?.winner ?? null,
        away_winner: matchDonnees.teams.away?.winner ?? null,
        events: buteurs,
    };

    const api_id = matchDonnees.fixture.id.toString();
    const resultat = await prisma.match.upsert({
        where: { api_id },
        create: { api_id, ...donneesMatch },
        update: donneesMatch,
    });
    return resultat;
}

// Permet de garder les scripts exécutables en ligne de commande (node script.js)
// tout en étant importables par le serveur sans s'exécuter automatiquement.
export function estLanceEnLigneDeCommande(metaUrl) {
    if (!process.argv[1]) return false;
    return path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
