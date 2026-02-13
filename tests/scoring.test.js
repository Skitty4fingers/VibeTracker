const { describe, it } = require('node:test');
const assert = require('node:assert');
const { computeScoreFields, rankTeams } = require('../lib/scoring');

describe('computeScoreFields', () => {
    it('computes correct totals for complete scores', () => {
        const score = { c1: 8, c2: 7, c3: 9, c4: 6, c5: 10, c6: 7, c7: 8, c8: 9, c9: 6, c10: 5 };
        const result = computeScoreFields(score);
        assert.strictEqual(result.businessSubtotal, 40);
        assert.strictEqual(result.technicalSubtotal, 35);
        assert.strictEqual(result.total, 75);
        assert.strictEqual(result.status, 'Complete');
    });

    it('handles partial scores (some nulls)', () => {
        const score = { c1: 8, c2: null, c3: 9, c4: null, c5: 10, c6: 7, c7: null, c8: 9, c9: null, c10: 5 };
        const result = computeScoreFields(score);
        assert.strictEqual(result.businessSubtotal, 27); // 8+0+9+0+10
        assert.strictEqual(result.technicalSubtotal, 21); // 7+0+9+0+5
        assert.strictEqual(result.total, 48);
        assert.strictEqual(result.status, 'Partial');
    });

    it('handles all nulls', () => {
        const score = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null };
        const result = computeScoreFields(score);
        assert.strictEqual(result.businessSubtotal, 0);
        assert.strictEqual(result.technicalSubtotal, 0);
        assert.strictEqual(result.total, 0);
        assert.strictEqual(result.status, 'Partial');
    });

    it('returns Partial when only business is complete', () => {
        const score = { c1: 5, c2: 5, c3: 5, c4: 5, c5: 5, c6: null, c7: null, c8: null, c9: null, c10: null };
        const result = computeScoreFields(score);
        assert.strictEqual(result.businessSubtotal, 25);
        assert.strictEqual(result.technicalSubtotal, 0);
        assert.strictEqual(result.status, 'Partial');
    });

    it('max scores (all 10)', () => {
        const score = { c1: 10, c2: 10, c3: 10, c4: 10, c5: 10, c6: 10, c7: 10, c8: 10, c9: 10, c10: 10 };
        const result = computeScoreFields(score);
        assert.strictEqual(result.total, 100);
        assert.strictEqual(result.status, 'Complete');
    });

    it('min scores (all 1)', () => {
        const score = { c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 1, c7: 1, c8: 1, c9: 1, c10: 1 };
        const result = computeScoreFields(score);
        assert.strictEqual(result.total, 10);
        assert.strictEqual(result.status, 'Complete');
    });
});

describe('rankTeams', () => {
    it('ranks by total descending', () => {
        const teams = [
            { teamName: 'Alpha', total: 50, businessSubtotal: 25, technicalSubtotal: 25 },
            { teamName: 'Beta', total: 70, businessSubtotal: 35, technicalSubtotal: 35 },
            { teamName: 'Gamma', total: 60, businessSubtotal: 30, technicalSubtotal: 30 },
        ];
        rankTeams(teams);
        assert.strictEqual(teams[0].teamName, 'Beta');
        assert.strictEqual(teams[0].rank, 1);
        assert.strictEqual(teams[1].teamName, 'Gamma');
        assert.strictEqual(teams[1].rank, 2);
        assert.strictEqual(teams[2].teamName, 'Alpha');
        assert.strictEqual(teams[2].rank, 3);
    });

    it('breaks tie by businessSubtotal desc', () => {
        const teams = [
            { teamName: 'A', total: 60, businessSubtotal: 25, technicalSubtotal: 35 },
            { teamName: 'B', total: 60, businessSubtotal: 30, technicalSubtotal: 30 },
        ];
        rankTeams(teams);
        assert.strictEqual(teams[0].teamName, 'B');
        assert.strictEqual(teams[0].rank, 1);
        assert.strictEqual(teams[1].teamName, 'A');
        assert.strictEqual(teams[1].rank, 2);
    });

    it('breaks tie by technicalSubtotal desc', () => {
        const teams = [
            { teamName: 'A', total: 60, businessSubtotal: 30, technicalSubtotal: 30 },
            { teamName: 'B', total: 60, businessSubtotal: 30, technicalSubtotal: 30 },
        ];
        // Same total, same biz, same tech — break by name asc
        rankTeams(teams);
        assert.strictEqual(teams[0].teamName, 'A');
        assert.strictEqual(teams[1].teamName, 'B');
        // Same scores → same rank
        assert.strictEqual(teams[0].rank, 1);
        assert.strictEqual(teams[1].rank, 1);
    });

    it('breaks tie by teamName asc when all scores equal', () => {
        const teams = [
            { teamName: 'Zebra', total: 50, businessSubtotal: 25, technicalSubtotal: 25 },
            { teamName: 'Alpha', total: 50, businessSubtotal: 25, technicalSubtotal: 25 },
            { teamName: 'Mango', total: 50, businessSubtotal: 25, technicalSubtotal: 25 },
        ];
        rankTeams(teams);
        assert.strictEqual(teams[0].teamName, 'Alpha');
        assert.strictEqual(teams[1].teamName, 'Mango');
        assert.strictEqual(teams[2].teamName, 'Zebra');
        // All tied so all rank 1
        assert.strictEqual(teams[0].rank, 1);
        assert.strictEqual(teams[1].rank, 1);
        assert.strictEqual(teams[2].rank, 1);
    });

    it('assigns correct ranks with gaps', () => {
        const teams = [
            { teamName: 'A', total: 80, businessSubtotal: 40, technicalSubtotal: 40 },
            { teamName: 'B', total: 80, businessSubtotal: 40, technicalSubtotal: 40 },
            { teamName: 'C', total: 60, businessSubtotal: 30, technicalSubtotal: 30 },
        ];
        rankTeams(teams);
        assert.strictEqual(teams[0].rank, 1); // A
        assert.strictEqual(teams[1].rank, 1); // B (tied with A)
        assert.strictEqual(teams[2].rank, 3); // C (rank 3, not 2)
    });
});
