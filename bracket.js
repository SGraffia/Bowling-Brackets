export function createBowlers(bowlers, base, pct) {
  return bowlers.map(b=>{
    const handicap = Math.max(0,(base-b.average)*pct);
    return {...b, netScores:b.scores.map(s=>s.score+handicap)};
  });
}

export function runBracket(players) {
  const shuffled = [...players].sort(()=>Math.random()-0.5);
  const results = [];
  for(let i=0;i<shuffled.length;i+=2){
    const p1=shuffled[i], p2=shuffled[i+1];
    if(!p2) continue;
    const score1=p1.netScores.reduce((a,b)=>a+b,0);
    const score2=p2.netScores.reduce((a,b)=>a+b,0);
    const winner = score1>=score2 ? p1.name : p2.name;
    results.push({
      matchup:[p1.name,p2.name],
      scores:[score1,score2],
      netScores:[score1,score2],
      winner
    });
  }
  return results;
}

export function calculatePrize(bracket) {
  const total = bracket.buyIn * bracket.approvedBowlers.length;
  const first = total - bracket.buyIn;
  const second = bracket.buyIn;
  return { totalPrize: total, firstPlace:first, secondPlace:second };
}
