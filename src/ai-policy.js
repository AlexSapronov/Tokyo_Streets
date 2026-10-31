export function orderPolicy(order){
  const weights={attack:{risk:.08,focus:.003,heat:.003,tires:.003},
    conserve:{risk:1.5,focus:.06,heat:.04,tires:.12},
    safe:{risk:7,focus:.025,heat:.018,tires:.03},
    hold:{risk:2,focus:.02,heat:.015,tires:.025}}[order];
  if(!weights)return null;
  return {resourcePrice:state=>Math.max(0,70-state.focus)*weights.focus
      +Math.max(0,state.heat-95)*weights.heat+(100-state.tires)*weights.tires,
    stepCost:(card,result,sector)=>(sector.mode==='drift'?-result.clip.points/12:result.time)
      +result.risk*weights.risk+result.slip*weights.risk
      -(order==='hold'&&card.id==='defend'?.3:0)};
}
