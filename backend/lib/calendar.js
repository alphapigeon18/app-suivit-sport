// Génère un flux iCalendar (.ics) des matchs suivis par un appareil.

// Échappe les caractères spéciaux du format iCalendar
function echapper(texte) {
    return (texte || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Date UTC au format iCalendar : 20260612T190000Z
function dateICS(d) {
    return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Repli de ligne (RFC 5545 : max ~75 octets, suite préfixée d'une espace)
function plier(ligne) {
    const max = 72;
    if (ligne.length <= max) return ligne;
    let out = ligne.slice(0, max);
    let reste = ligne.slice(max);
    while (reste.length > max - 1) {
        out += '\r\n ' + reste.slice(0, max - 1);
        reste = reste.slice(max - 1);
    }
    return out + '\r\n ' + reste;
}

export function construireICS(matchs, nomCalendrier) {
    const maintenant = dateICS(new Date());
    const lignes = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SuiviSport//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        plier(`X-WR-CALNAME:${echapper(nomCalendrier)}`),
        'X-WR-TIMEZONE:UTC',
        'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
        'X-PUBLISHED-TTL:PT6H',
    ];

    for (const m of matchs) {
        const home = m.team_match_home_team_idToteam?.name || 'À déterminer';
        const away = m.team_match_away_team_idToteam?.name || 'À déterminer';
        const competition = m.season?.competition?.name || '';
        const fini = m.status === 'FINISHED' && m.home_score != null && m.away_score != null;
        const titre = fini ? `${home} ${m.home_score}–${m.away_score} ${away}` : `${home} – ${away}`;
        const debut = dateICS(m.start_time);
        const fin = dateICS(new Date(new Date(m.start_time).getTime() + 2 * 60 * 60 * 1000));
        const description = [competition, m.phase].filter(Boolean).join(' · ');

        lignes.push(
            'BEGIN:VEVENT',
            `UID:${m.match_id}@suivisport`,
            `DTSTAMP:${maintenant}`,
            `DTSTART:${debut}`,
            `DTEND:${fin}`,
            plier(`SUMMARY:${echapper(competition ? `${titre} · ${competition}` : titre)}`),
            plier(`DESCRIPTION:${echapper(description)}`),
            'STATUS:CONFIRMED',
            'END:VEVENT'
        );
    }

    lignes.push('END:VCALENDAR');
    return lignes.join('\r\n');
}
