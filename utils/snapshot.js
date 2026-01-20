const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * @typedef {Object} Game
 * @property {number} score - Game score
 */

/**
 * @typedef {Object} SnapshotBowler
 * @property {string} id - Bowler's unique ID
 * @property {string} name - Bowler's display name
 * @property {Game[]} games - Current games
 * @property {Game[][]} previousGames - History of edited scores
 * @property {boolean} scoresLocked - Whether scores are locked
 */

/**
 * @typedef {Object} SnapshotBracket
 * @property {string} bracketId - Bracket identifier
 * @property {SnapshotBowler[]} bowlers - Array of bowler details
 * @property {Object} prizePool - Prize distribution
 */

/**
 * Calculates prize pool for a bracket.
 * 
 * @param {Object} bracket - Bracket object
 * @param {string[]} bracket.bowlers - Array of bowler IDs
 * @param {number} buyIn - Buy-in amount per bowler
 * @returns {{total: number, firstPlace: number, secondPlace: number}} Prize distribution
 * 
 * @example
 * const bracket = { bowlers: ['id1', 'id2', 'id3', 'id4'] };
 * calculatePrizePool(bracket, 5);
 * // Returns: { total: 20, firstPlace: 15, secondPlace: 5 }
 */
function calculatePrizePool(bracket, buyIn) {
  const totalSlots = bracket.bowlers.length;
  const pool = totalSlots * buyIn;
  return { total: pool, firstPlace: pool - buyIn, secondPlace: buyIn };
}

/**
 * Generates a snapshot of all brackets with resolved bowler details.
 * Replaces bowler IDs with full bowler objects including names and scores.
 * 
 * @param {Object[]} brackets - Array of bracket objects
 * @param {string} brackets[].id - Bracket identifier
 * @param {string[]} brackets[].bowlers - Array of bowler IDs
 * @param {number} brackets[].buyIn - Buy-in amount
 * @param {Object[]} registrations - Array of user registration objects
 * @param {string} registrations[].id - User's unique ID
 * @param {string} registrations[].name - User's display name
 * @param {Game[]} registrations[].games - User's game scores
 * @returns {SnapshotBracket[]} Array of snapshot objects with resolved bowler data
 * 
 * @example
 * const brackets = [{ id: 'bracket-1', bowlers: ['user-1'], buyIn: 5 }];
 * const registrations = [{ id: 'user-1', name: 'John', games: [] }];
 * const snapshot = generateWeeklySnapshot(brackets, registrations);
 * // Returns: [{
 * //   bracketId: 'bracket-1',
 * //   bowlers: [{ id: 'user-1', name: 'John', games: [], ... }],
 * //   prizePool: { total: 5, firstPlace: 0, secondPlace: 5 }
 * // }]
 */
function generateWeeklySnapshot(brackets, registrations) {
  return brackets.map(bracket => {
    const bowlers = bracket.bowlers.map(bid => {
      const bowler = registrations.find(r => r.id === bid) || { id: bid, name: bid };
      return {
        id: bowler.id,
        name: bowler.name,
        games: bowler.games || [],
        previousGames: bowler.previousGames || [],
        scoresLocked: bowler.scoresLocked
      };
    });
    return { bracketId: bracket.id, bowlers, prizePool: calculatePrizePool(bracket, bracket.buyIn) };
  });
}

/**
 * Generates a PDF document from snapshot data.
 * Supports both full bracket snapshots (array) and single bowler snapshots (object).
 * 
 * @param {SnapshotBracket[]|Object} snapshot - Snapshot data
 *   - If array: generates PDF with all brackets
 *   - If object: generates PDF for single bowler with { bracketId, bowler, prizePool }
 * @param {string} bowlerId - Bowler ID used in the output filename
 * @returns {string} Absolute file path to the generated PDF
 * 
 * @example
 * // Generate PDF for all brackets
 * const allBrackets = generateWeeklySnapshot(brackets, registrations);
 * const pdfPath = createBowlerPDF(allBrackets, 'admin');
 * // Returns: '/app/data/snapshot_admin_1695219200000.pdf'
 * 
 * @example
 * // Generate PDF for single bowler
 * const singleBowler = {
 *   bracketId: 'bracket-1',
 *   bowler: { name: 'John', games: [{ score: 200 }], previousGames: [] },
 *   prizePool: { total: 40, firstPlace: 35, secondPlace: 5 }
 * };
 * const pdfPath = createBowlerPDF(singleBowler, 'user-123');
 * // Returns: '/app/data/snapshot_user-123_1695219200000.pdf'
 */
function createBowlerPDF(snapshot, bowlerId) {
  const pdfPath = path.join(__dirname, '..', 'data', `snapshot_${bowlerId}_${Date.now()}.pdf`);
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(18).text('Bowling Bracket Snapshot', { align: 'center' });
  doc.moveDown();

  if (Array.isArray(snapshot)) {
    snapshot.forEach(bracket => {
      doc.fontSize(14).text(`Bracket: ${bracket.bracketId}`);
      bracket.bowlers.forEach(b => {
        const scores = b.games.map(g => g.score).join(', ');
        doc.fontSize(12).text(`${b.name} | Scores: ${scores}`);
      });
      const prize = bracket.prizePool;
      doc.fontSize(12).text(`Prize Pool: $${prize.total} | First: $${prize.firstPlace} | Second: $${prize.secondPlace}`);
      doc.moveDown();
    });
  } else {
    const b = snapshot.bowler;
    const scores = b.games.map(g => g.score).join(', ');
    doc.fontSize(12).text(`Bracket: ${snapshot.bracketId}`);
    doc.fontSize(12).text(`Name: ${b.name}`);
    doc.fontSize(12).text(`Scores: ${scores}`);
    if (b.previousGames.length > 0) {
      doc.fontSize(12).text(`Previous Scores:`);
      b.previousGames.forEach((pg, i) => {
        doc.fontSize(12).text(`Edit ${i+1}: ${pg.map(g => g.score).join(', ')}`);
      });
    }
    const prize = snapshot.prizePool;
    doc.fontSize(12).text(`Prize Pool: $${prize.total} | First: $${prize.firstPlace} | Second: $${prize.secondPlace}`);
  }

  doc.end();
  return pdfPath;
}

module.exports = { calculatePrizePool, generateWeeklySnapshot, createBowlerPDF };
