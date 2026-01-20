const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} PrizePool
 * @property {number} total - Total prize pool amount
 * @property {number} firstPlace - First place prize
 * @property {number} secondPlace - Second place prize
 */

/**
 * @typedef {Object} Bracket
 * @property {string} id - Bracket identifier (e.g., 'bracket-1')
 * @property {string[]} bowlers - Array of bowler IDs
 * @property {string} status - Bracket status ('open' or 'closed')
 * @property {number} buyIn - Buy-in amount per bowler
 * @property {PrizePool} prizePool - Prize distribution
 */

/**
 * Creates bracket groups from approved registrations.
 * Groups bowlers into brackets of maxBowlers size, filling incomplete
 * brackets with placeholder IDs.
 * 
 * @param {Object[]} registrations - All user registration objects
 * @param {string} registrations[].id - User's unique ID
 * @param {boolean} registrations[].approved - Whether user is approved
 * @param {number} maxBowlers - Maximum bowlers per bracket
 * @param {number} buyIn - Buy-in amount per bowler in dollars
 * @returns {Bracket[]} Array of bracket objects
 * 
 * @example
 * const registrations = [
 *   { id: 'user-1', approved: true },
 *   { id: 'user-2', approved: true },
 *   { id: 'user-3', approved: false }  // Not included
 * ];
 * const brackets = createBrackets(registrations, 8, 5);
 * // Returns: [{
 * //   id: 'bracket-1',
 * //   bowlers: ['user-1', 'user-2', 'admin-placeholder-...', ...],
 * //   status: 'open',
 * //   buyIn: 5,
 * //   prizePool: { total: 40, firstPlace: 35, secondPlace: 5 }
 * // }]
 */
function createBrackets(registrations, maxBowlers, buyIn) {
  const brackets = [];
  let currentBracket = [];
  let bracketCount = 1;

  const approvedBowlers = registrations.filter(r => r.approved);

  approvedBowlers.forEach(b => {
    currentBracket.push(b.id);
    if (currentBracket.length === maxBowlers) {
      brackets.push({
        id: `bracket-${bracketCount}`,
        bowlers: currentBracket.slice(),
        status: 'open',
        buyIn,
        prizePool: calculatePrizePool(currentBracket.length, buyIn)
      });
      currentBracket = [];
      bracketCount++;
    }
  });

  if (currentBracket.length > 0) {
    while (currentBracket.length < maxBowlers) {
      currentBracket.push(`admin-placeholder-${uuidv4()}`);
    }
    brackets.push({
      id: `bracket-${bracketCount}`,
      bowlers: currentBracket,
      status: 'open',
      buyIn,
      prizePool: calculatePrizePool(currentBracket.length, buyIn)
    });
  }

  return brackets;
}

/**
 * Calculates prize distribution for a bracket.
 * First place receives total pool minus one buy-in.
 * Second place receives one buy-in.
 * 
 * @param {number} numBowlers - Number of bowlers in the bracket
 * @param {number} buyIn - Buy-in amount per bowler in dollars
 * @returns {PrizePool} Prize pool distribution object
 * 
 * @example
 * calculatePrizePool(8, 5);
 * // Returns: { total: 40, firstPlace: 35, secondPlace: 5 }
 * 
 * @example
 * calculatePrizePool(4, 10);
 * // Returns: { total: 40, firstPlace: 30, secondPlace: 10 }
 */
function calculatePrizePool(numBowlers, buyIn) {
  const total = numBowlers * buyIn;
  return {
    total,
    firstPlace: total - buyIn,
    secondPlace: buyIn
  };
}

module.exports = { createBrackets, calculatePrizePool };
