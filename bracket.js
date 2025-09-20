const { v4: uuidv4 } = require('uuid');

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

function calculatePrizePool(numBowlers, buyIn) {
  const total = numBowlers * buyIn;
  return {
    total,
    firstPlace: total - buyIn,
    secondPlace: buyIn
  };
}

module.exports = { createBrackets, calculatePrizePool };
