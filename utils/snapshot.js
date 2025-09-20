const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function calculatePrizePool(bracket, buyIn) {
  const totalSlots = bracket.bowlers.length;
  const pool = totalSlots * buyIn;
  return { total: pool, firstPlace: pool - buyIn, secondPlace: buyIn };
}

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
