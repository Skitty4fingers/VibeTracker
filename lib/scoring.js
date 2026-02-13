/**
 * Compute subtotals, total, and status for a score row.
 * @param {object} score — { c1..c10 } (nullable integers)
 * @returns {{ businessSubtotal, technicalSubtotal, total, status }}
 */
function computeScoreFields(score) {
    const biz = [score.c1, score.c2, score.c3, score.c4, score.c5];
    const tech = [score.c6, score.c7, score.c8, score.c9, score.c10];

    const sum = (arr) => arr.reduce((s, v) => s + (v != null ? v : 0), 0);
    const allPresent = (arr) => arr.every((v) => v != null);

    const businessSubtotal = sum(biz);
    const technicalSubtotal = sum(tech);
    const total = businessSubtotal + technicalSubtotal;
    const status = allPresent(biz) && allPresent(tech) ? 'Complete' : 'Partial';

    return { businessSubtotal, technicalSubtotal, total, status };
}

/**
 * Rank an array of team+score objects.
 * Sort: total desc → businessSubtotal desc → technicalSubtotal desc → teamName asc
 * Mutates and returns the array with `rank` added.
 */
function rankTeams(teams) {
    teams.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.businessSubtotal !== a.businessSubtotal) return b.businessSubtotal - a.businessSubtotal;
        if (b.technicalSubtotal !== a.technicalSubtotal) return b.technicalSubtotal - a.technicalSubtotal;
        return a.teamName.localeCompare(b.teamName);
    });

    let rank = 1;
    for (let i = 0; i < teams.length; i++) {
        if (i > 0) {
            const prev = teams[i - 1];
            const curr = teams[i];
            if (curr.total !== prev.total || curr.businessSubtotal !== prev.businessSubtotal || curr.technicalSubtotal !== prev.technicalSubtotal) {
                rank = i + 1;
            }
        }
        teams[i].rank = rank;
    }
    return teams;
}

module.exports = { computeScoreFields, rankTeams };
