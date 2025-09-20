const { v4: uuidv4 } = require('uuid');

function createBrackets(registrations, maxBowlers) {
  const brackets = [];
  let currentBracket = [];
  let bracketCount = 1;

  registrations.forEach(b => {
    currentBracket.push(b.id);
    if (currentBracket.length === maxBowlers) {
      brackets.push({ id: `bracket-${bracketCount}`, bowlers: currentBracket.slice(), status: 'open', buyIn: 5 });
      currentBracket = [];
      bracketCount++;
    }
  });

  if (currentBracket.length > 0) {
    while (currentBracket.length < maxBowlers) {
      currentBracket.push(`admin-placeholder-${uuidv4()}`);
    }
    brackets.push({ id: `bracket-${bracketCount}`, bowlers: currentBracket, status: 'open', buyIn: 5 });
  }

  return brackets;
}

module.exports = { createBrackets };
