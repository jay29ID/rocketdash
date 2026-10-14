(function(){
'use strict';
// ---------- helpers ----------
const $=id=>document.getElementById(id);
const DAY=864e5;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtDate=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmtDay=d=>d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const fmtTime=d=>d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const sign=v=>(v>=0?'+':'')+v;
const num=v=>v==null||v===''||isNaN(+v)?null:+v;
const co=(o,k)=>o==null?null:num(o[k]!=null?o[k]:o[k.toLowerCase()]);

const ARENA_NAMES={stadium_p:'DFH Stadium',stadium_day_p:'DFH Stadium (Day)',stadium_foggy_p:'DFH Stadium (Stormy)',stadium_winter_p:'DFH Stadium (Snowy)',eurostadium_p:'Mannfield',eurostadium_night_p:'Mannfield (Night)',eurostadium_rainy_p:'Mannfield (Stormy)',eurostadium_snownight_p:'Mannfield (Snowy)',cs_p:'Champions Field',cs_day_p:'Champions Field (Day)',trainstation_p:'Urban Central',trainstation_night_p:'Urban Central (Night)',trainstation_dawn_p:'Urban Central (Dawn)',park_p:'Beckwith Park',park_night_p:'Beckwith Park (Midnight)',park_rainy_p:'Beckwith Park (Stormy)',utopiastadium_p:'Utopia Coliseum',utopiastadium_dusk_p:'Utopia Coliseum (Dusk)',utopiastadium_snow_p:'Utopia Coliseum (Snowy)',neotokyo_standard_p:'Neo Tokyo',underwater_p:'AquaDome',beach_p:'Salty Shores',beach_night_p:'Salty Shores (Night)',farm_p:'Farmstead',farm_night_p:'Farmstead (Night)',wasteland_s_p:'Wasteland',wasteland_night_s_p:'Wasteland (Night)',chn_stadium_p:'Forbidden Temple',chn_stadium_day_p:'Forbidden Temple (Day)',outlaw_p:'Deadeye Canyon',arc_standard_p:'Starbase ARC',street_p:'Sovereign Heights',music_p:'Neon Fields',hoopsstadium_p:'Dunk House',ff_dusk_p:'Estadio Vida',swoosh_p:'Champions Field (Nike FC)',cs_hw_p:'Rivals Arena',woods_p:'Drift Woods',woods_night_p:'Drift Woods (Night)',fni_stadium_p:'Futura Garden'};
// Ball speeds from BallHit may arrive in game units per second; anything that high can't be km/h.
// Car speed comes in game units per second (supersonic is 2200); the game's km/h is uu/s x 0.036.
function carKmh(v){v=num(v);return v==null||v<=0?null:v>300?v*0.036:v;}
function toKmh(v){return v==null?null:v>300?Math.round(v*0.036):v;}
// The Stats API sends a loadout as a list of item codes with the car body first ("body_grain").
// Codes we know the in-game name of go here; anything else is shown tidied up.
const CAR_NAMES={body_grain:'Fennec'};   // confirmed by Jason; add others as they turn up
function carName(l){
  if(!l||typeof l!=='object')return null;
  let v=Array.isArray(l)?(l.find(x=>/^body_/i.test(x))||l[0]):l.Car!=null?l.Car:l.Body!=null?l.Body:l.car;
  if(v==null||v===''||v==='None')return null;
  v=String(v);const k=v.toLowerCase();
  if(CAR_NAMES[k])return CAR_NAMES[k];
  if(!/^body_/.test(k))return v;
  return k.slice(5).split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
}
const WARM='Casual Doubles', RANKED='Ranked Doubles';
const plName=p=>p===WARM?'Warm-Ups':p;
function arenaName(a){if(!a)return 'Unknown arena';const k=String(a).toLowerCase();return ARENA_NAMES[k]||String(a).replace(/_P$/i,'').replace(/_/g,' ');}

// Approximate Ranked Doubles ranges.
const RANKS=[['Bronze I',0],['Bronze II',235],['Bronze III',295],['Silver I',355],['Silver II',415],['Silver III',475],
  ['Gold I',535],['Gold II',595],['Gold III',655],['Platinum I',715],['Platinum II',775],['Platinum III',835],
  ['Diamond I',895],['Diamond II',975],['Diamond III',1055],['Champion I',1175],['Champion II',1295],['Champion III',1415],
  ['Grand Champion I',1575],['Grand Champion II',1705],['Grand Champion III',1835],['Supersonic Legend',1875]];
const rankIndex=v=>{let i=RANKS.length-1;while(i>0&&v<RANKS[i][1])i--;return i;};
// Rank badges drawn for this page (not the game's artwork): shields for Bronze to Platinum, a gem
// for Diamond, a crowned gem for Champion, a winged shield for Grand Champion and a winged star
// for Supersonic Legend. The number of chevrons is the tier (I, II, III).
const RANK_COL=['#B4733F','#AEB9C6','#E2AE2F','#3FC0D6','#3D7EF2','#9A5CF6','#E0404C','#C9D2DE'];
function rankBadge(v,size=26){
  if(v==null)return '';
  const i=rankIndex(v),fam=Math.min(7,Math.floor(i/3)),n=i%3+1,col=RANK_COL[fam];
  const cut='var(--surface)';
  const chev=(y0,step,w)=>{let d='';for(let k=0;k<n;k++){const y=y0+k*step;d+=`<path d="M${12-w} ${y}L12 ${y+w*.6}L${12+w} ${y}" fill="none" stroke="${cut}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;}return d;};
  let g='';
  if(fam<=3)g=`<path d="M12 1.8 20.5 4.8V11.5C20.5 16.8 16.8 20.5 12 22.2 7.2 20.5 3.5 16.8 3.5 11.5V4.8Z" fill="${col}"/>`+chev(7.5,3.6,4.2);
  else if(fam===4)g=`<path d="M6.5 3.5H17.5L22 9 12 21.5 2 9Z" fill="${col}"/><path d="M2 9H22" stroke="${cut}" stroke-width="1" opacity=".6"/>`+chev(11,2.8,3.4);
  else if(fam===5)g=`<path d="M4 7 7.5 9.5 12 3 16.5 9.5 20 7 18.5 12 12 22 5.5 12Z" fill="${col}"/>`+chev(11,2.8,3.4);
  else if(fam===6)g=`<path d="M1 5C3 9 5.5 10.5 8 10.5L7 14C3.8 13.2 1.8 10 1 5ZM23 5C21 9 18.5 10.5 16 10.5L17 14C20.2 13.2 22.2 10 23 5Z" fill="${col}" opacity=".85"/><path d="M12 2.5 17.5 5V11.5C17.5 15.8 15.2 19 12 21 8.8 19 6.5 15.8 6.5 11.5V5Z" fill="${col}"/>`+chev(7.5,3.4,3.2);
  else g=`<path d="M1 6C3 10 5.5 11.5 8 11.5L7 15C3.8 14.2 1.8 11 1 6ZM23 6C21 10 18.5 11.5 16 11.5L17 15C20.2 14.2 22.2 11 23 6Z" fill="${col}" stroke="var(--ink-2)" stroke-width=".6"/><path d="M12 2.5 14.6 8.6 21 9.1 16.1 13.3 17.6 19.8 12 16.4 6.4 19.8 7.9 13.3 3 9.1 9.4 8.6Z" fill="${col}" stroke="var(--ink-2)" stroke-width=".8" stroke-linejoin="round"/>`;
  return `<svg class="rkb" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${g}</svg>`;
}
function rankOf(v){
  if(v==null)return 'No MMR yet';
  const i=rankIndex(v);
  if(i===RANKS.length-1)return RANKS[i][0];
  const lo=RANKS[i][1], hi=RANKS[i+1][1];
  const div=Math.min(4,Math.floor((v-lo)/((hi-lo)/4))+1);
  return RANKS[i][0]+' · Div '+['I','II','III','IV'][div-1];
}

// ---------- sample data in the recorder's own format ----------
function makeSample(names){
  let a=2929;const rnd=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const pois=l=>{let L=Math.exp(-l),k=0,p=1;do{k++;p*=rnd()}while(p>L);return k-1};
  const norm=(m,s)=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  const pick=arr=>arr[Math.floor(rnd()*arr.length)];
  const base=[{g:.95,sh:3.2,sv:1.25,d:.85,t:28,boost:44,ss:17,air:9,wall:12,gs:91,bump:2.6},{g:.78,sh:2.7,sv:1.75,d:1.45,t:30,boost:39,ss:13,air:6,wall:15,gs:84,bump:3.8}],prof=names.map((n,j)=>base[j%base.length]);
  const arenas=Object.keys(ARENA_NAMES).filter(k=>!/\(/.test(ARENA_NAMES[k]));
  function spot(range){
    const r=rnd();let x,y;
    if(r<.55){x=norm(0,900);y=norm(4050,550);}else if(r<.85){x=norm(0,1600);y=norm(2900,700);}else{x=norm(0,2200);y=norm(900,1400)*range;}
    x=clamp(x,-3950,3950);y=clamp(y,-4800,5000);
    const side=rnd()<.5?-1:1;let ix;do{ix=side*norm(470,260)}while(Math.abs(ix)>800);
    const iz=rnd()<.58?clamp(93+Math.abs(norm(0,90)),93,549):clamp(norm(400,110),93,549);
    return {x,y,ix,iz};
  }
  const end=new Date();end.setHours(21,40,0,0);if(end>Date.now())end.setTime(end.getTime()-DAY);
  const matches=[],mmr=[];let rating=names.map((n,j)=>948+56*j);
  const days=[44,42,39,37,35,32,29,27,24,21,18,16,13,11,8,6,4,2,0];
  days.forEach((ago,si)=>{
    const start=new Date(end.getTime()-ago*DAY);start.setHours(19+Math.floor(rnd()*2),Math.floor(rnd()*50),0,0);
    const n=4+Math.floor(rnd()*8), form=norm(0,.09)+(si>=days.length-2?.16:si>12?.04:0);
    let t=start.getTime(),w=0;
    const wn=rnd()<.8?2+Math.floor(rnd()*3):0;   // casual doubles warm-ups first, most nights
    const crowd=SPECTATORS.filter(()=>rnd()<.35);
    for(let k=0;k<wn+n;k++){
      const warm=k<wn;
      const win=rnd()<clamp((warm?.55:.52)+form*(warm?1.4:1),.2,.85);if(!warm)w+=win?1:-1;
      let us,them;
      if(win){us=1+pois(1.7);them=Math.min(us-1,pois(1.3));}else{them=1+pois(1.8);us=Math.min(them-1,pois(1.3));}
      const ot=Math.abs(us-them)===1&&rnd()<.3, dur=300+(ot?30+Math.floor(rnd()*150):0);
      const my=rnd()<.5?0:1, f=my===1?-1:1;
      const goals=[], lines=prof.map(()=>({goals:0,assists:0}));
      const pos=(s,flip)=>({shot_from:{X:Math.round(flip*s.x),Y:Math.round(flip*s.y),Z:93},impact:{X:Math.round(flip*s.ix),Y:Math.round(flip*5120),Z:Math.round(s.iz)}});
      for(let g=0;g<us;g++){
        const who=Math.floor(rnd()*names.length);lines[who].goals++;
        const mate=names.length>1&&rnd()<.55?(who+1+Math.floor(rnd()*(names.length-1)))%names.length:-1;if(mate>=0)lines[mate].assists++;
        const af=mate>=0?{X:Math.round(clamp(norm(0,2200),-3900,3900)),Y:Math.round(f*clamp(norm(2600,900),400,4900)),Z:Math.round(clamp(norm(140,120),17,900))}:null;
        goals.push({assist_from:af,team:my,ours:true,goal_time:rnd()<.08?9+Math.floor(rnd()*3):14+Math.floor(rnd()*120),since_save:rnd()<.25?+(2+rnd()*20).toFixed(1):null,scorer:names[who],assister:mate>=0?names[mate]:null,speed:Math.round(clamp(norm(prof[who].gs,18),35,140)),...pos(spot(who?.8:1),f)});
      }
      for(let g=0;g<them;g++)goals.push({team:1-my,ours:false,goal_time:rnd()<.08?9+Math.floor(rnd()*3):14+Math.floor(rnd()*120),scorer:'Opponent',speed:Math.round(clamp(norm(86,18),35,140)),...pos(spot(1.1),-f)});
      for(let i=goals.length-1;i>0;i--){const k=Math.floor(rnd()*(i+1));[goals[i],goals[k]]=[goals[k],goals[i]];}   // in match order
      const players=prof.map((p,j)=>{
        const L=lines[j],shots=L.goals+pois(Math.max(.4,p.sh-p.g)),saves=pois(p.sv*(them>2?1.25:1)),demos=pois(p.d),touches=Math.max(8,Math.round(norm(p.t,5)));
        const air=+clamp(norm(p.air,1.8),1,20).toFixed(1),wall=+clamp(norm(p.wall,2.5),3,25).toFixed(1);
        return {name:names[j],team:my,tracked:true,goals:L.goals,assists:L.assists,shots,saves,demos,touches,
          score:100*L.goals+50*L.assists+50*saves+20*shots+15*demos+2*touches+Math.floor(rnd()*40),
          car_touches:pois(p.bump),boost_pickups:Math.round(clamp(norm(j?34:29,6),8,70)),loadout:{Car:j?'Fennec':'Octane'},avg_boost:Math.round(clamp(norm(p.boost,5),20,70)),pct_supersonic:+clamp(norm(p.ss,3),3,35).toFixed(1),pct_zero_boost:+clamp(norm(j?9:7,3),1,25).toFixed(1),zero_boost_fixed:true,
          avg_speed:Math.round(clamp(norm(j?1380:1320,60),1100,1600)),max_speed:2300,pct_air:air,pct_wall:wall,pct_ground:+(100-air-wall).toFixed(1),hardest_hit:Math.round(clamp(norm(p.gs+25,15),60,160))};
      });
      // Two opponents, and now and then one of them redirects one of our shots on its way in.
      const foes=[pick(['Zephyr','BallChaser99','nxtLvl','Mochi','RocketRalph','ghostpepper']),pick(['Tidal','Vex','sir_flips','Kiwi','B0ost','Nova'])];
      foes.forEach(n=>players.push({name:n,team:1-my,tracked:false,platform:'Epic'}));
      goals.forEach(g=>{if(g.ours&&rnd()<.14){const s=g.shot_from,ix=g.impact.X,f=Math.sign(g.impact.Y)||1;
        g.scorer_from=s;g.last_touch=pick(foes);g.shot_from={X:Math.round(s.X+(ix-s.X)*.6+norm(0,250)),Y:Math.round(s.Y+(f*5120-s.Y)*.6),Z:Math.round(clamp(norm(260,140),60,700))};}
        // Newer recorders save the last 3 touches; give the sample's assisted goals some.
        if(g.ours&&g.assist_from&&rnd()<.7){const t=[{player:g.assister,team:my,location:g.assist_from},{player:g.scorer,team:my,location:g.scorer_from||g.shot_from}];
          if(g.last_touch)t.push({player:g.last_touch,team:1-my,location:g.shot_from});g.touches=t.slice(-3);}});
      matches.push({match_guid:'sample-'+si+'-'+k,started_at:new Date(t).toISOString(),duration_seconds:dur,playlist:warm?'Casual Doubles':'Ranked Doubles',arena:pick(arenas),
        overtime:ot,my_team:my,result:win?'Win':'Loss',team_score:us,opponent_score:them,goals,players,
        replay_created:rnd()<.2?new Date(t+dur*1000).toISOString():null,
        kickoffs:us+them+1,players_left:rnd()<.08?[{name:'Opponent',team:1-my}]:[],spectators:crowd,drinks:{[names[0]]:Math.floor(k*.7)}});
      t+=(dur+60+Math.floor(rnd()*90))*1000;
    }
    rating=rating.map((v,j)=>Math.round(v+w*(8.5+j)+norm(0,6)));
    names.forEach((nm,j)=>mmr.push({logged_at:new Date(t).toISOString(),player:nm,playlist:'Ranked Doubles',mmr:rating[j]}));
  });
  return {matches,mmr};
}

// ---------- units ----------
// Everything is stored metric; the Units toggle converts only when it's shown.
const IMP=()=>units==='imperial';
const fSpd=(kmh,d=0)=>kmh==null?'–':IMP()?(kmh*0.621371).toFixed(d)+' mph':kmh.toFixed(d)+' km/h';
const fDist=(km,d=1)=>km==null?'–':IMP()?(km*0.621371).toFixed(d)+' mi':km.toFixed(d)+' km';
const fLen=m=>m==null?'–':IMP()?(m*1.09361).toFixed(0)+' yd':m.toFixed(0)+' m';

// ---------- wallpaper ----------
// Wallpapers Jason picked, in public/bg/. One is chosen at random on each visit, behind the drawn pitch.
const WALLPAPERS=['stadium.webp','octane.jpg','fennec.webp'];
document.documentElement.style.setProperty('--wall',`url(/bg/${WALLPAPERS[Math.floor(Math.random()*WALLPAPERS.length)]})`);

// ---------- model ----------
let PLAYERS=[], RAW={matches:[],mmr:[]}, SAMPLE=false;
let ALL=[], DONE=[], sessions=[], NOW=Date.now();
const SPECTATORS=['Morgan','Chance','Nick'];
let period='30', mode='avg', metric='winpct', playlist=null, units='metric', mapSide='us', mapWho='all';
try{const s=JSON.parse(localStorage.getItem('rl-duo-ui')||'{}');if(s.period)period=s.period;if(s.mode)mode=s.mode;if(s.metric)metric=s.metric;if(s.playlist)playlist=s.playlist;if(s.units)units=s.units;}catch(e){}
const saveUi=()=>{try{localStorage.setItem('rl-duo-ui',JSON.stringify({period,mode,metric,playlist,units}))}catch(e){}};

// A forfeit never sends the game's "match ended" event, so the recorder saves it as Incomplete.
// When one side was ahead, that side won (the team behind forfeited, or quit, which is a loss too).
// Level or 0-0 games that never finished stay out.
function forfeit(r){
  if(!r||r.result!=='Incomplete'||num(r.my_team)==null)return r;
  const us=num(r.team_score),them=num(r.opponent_score);
  if(us==null||them==null||us===them)return r;
  return {...r,result:us>them?'Win':'Loss',ff:true};
}
// A goal within this many seconds of play after a kickoff counts as a kickoff goal.
// Newer recordings carry since_kickoff, read off the game clock. Older ones only have the game's
// goal_time, which never goes below 9 in our games: it seems to include the countdown and
// a few seconds more, so up to 11 there is roughly the same as 6 seconds of play.
const KICKOFF_SECS=6, KICKOFF_GOAL_TIME=11;
function isKickoffGoal(g){
  const s=num(g.since_kickoff);if(s!=null)return s<=KICKOFF_SECS;
  const t=num(g.goal_time);return t!=null&&t>0&&t<=KICKOFF_GOAL_TIME;
}
// A counter goal is scored within this many seconds of play after a save by the scoring team.
const COUNTER_SECS=15;
// Biggest gap we were behind (or ahead) by at any point, from the goals in the order they were scored.
function maxDeficit(goals,sign=1){let d=0,worst=0;goals.forEach(g=>{d+=g.ours?-sign:sign;if(d>worst)worst=d;});return worst;}
// The game never fills duration_seconds in our records, so fall back to the time between the
// recorder's start and end stamps. Average speed is sampled over that same stretch.
function matchSecs(r){
  const d=num(r.duration_seconds);if(d)return d;
  const s=(new Date(r.ended_at)-new Date(r.started_at))/1000;
  return s>=60&&s<=2400?s:null;
}
function toMatch(r){
  const rows=r.players||[];
  // Only matches recorded with save timing can count counter goals.
  const counters=p=>num(r.kickoffs)>0?(r.goals||[]).filter(g=>g&&g.scorer===p.name&&num(g.since_save)!=null&&+g.since_save<=COUNTER_SECS).length:null;
  const lines=PLAYERS.map(p=>{
    const row=rows.find(x=>x&&x.name===p.name);if(!row)return null;
    return {score:num(row.score)||0,goals:num(row.goals)||0,assists:num(row.assists)||0,shots:num(row.shots)||0,saves:num(row.saves)||0,
      demos:num(row.demos)||0,touches:num(row.touches)||0,bumps:num(row.car_touches),boost:num(row.avg_boost),ss:num(row.pct_supersonic),
      air:num(row.pct_air),wall:num(row.pct_wall),ground:num(row.pct_ground),hardest:toKmh(num(row.hardest_hit)),
      pickups:num(row.boost_pickups),car:carName(row.loadout),speed:carKmh(row.avg_speed),topSpeed:carKmh(row.max_speed),
      // No odometer in the Stats API: distance is average speed x time in the match (km).
      dist:carKmh(row.avg_speed)!=null&&matchSecs(r)?carKmh(row.avg_speed)*matchSecs(r)/3600:null,
      saveGoals:counters(p),
      noBoost:row.zero_boost_fixed&&num(row.pct_zero_boost)!=null?num(row.pct_zero_boost)/100*(num(r.duration_seconds)||300):null,
      goalSpeeds:(r.goals||[]).filter(g=>g&&!(+g.goal_time<=0&&(r.goals||[]).some(x=>x&&+x.goal_time>0))&&g.scorer===p.name&&num(g.speed)!=null).map(g=>+g.speed)};
  });
  const myTeam=num(r.my_team);
  // The game sends a second, empty GoalScored for most goals (no goal time, no scorer), so a match
  // stored twice as many goals as were scored. Real goals always have a goal time.
  const rawGoals=(r.goals||[]).filter(Boolean), timed=rawGoals.some(g=>+g.goal_time>0);
  const teamOf={};(r.players||[]).forEach(p=>{if(p&&p.name)teamOf[p.name]=num(p.team);});
  const goals=rawGoals.filter(g=>!timed||+g.goal_time>0).map(g=>{
    const team=num(g.team), f=team===1?-1:1, i=g.impact;
    // Redirect: the game's last touch belongs to the other team from the scorer. Then shot_from is
    // where that player touched it, and scorer_from (newer recorders) is where the scorer hit it.
    const lt=g.last_touch, defl=lt&&g.scorer&&lt!==g.scorer&&teamOf[lt]!=null&&team!=null&&teamOf[lt]!==team?String(lt):null;
    const s=defl&&g.scorer_from?g.scorer_from:g.shot_from, dp=defl?g.shot_from:null;
    const ours=g.ours!=null?!!g.ours:(myTeam!=null&&team===myTeam);
    // Credit the goal to whoever the game credits; the last hit can be an opponent's deflection.
    const who=ours?PLAYERS.findIndex(p=>p.name===(PLAYERS.some(q=>q.name===g.scorer)?g.scorer:g.shot_from_player)):-1;
    return {ours,who,scorer:g.scorer||null,assister:g.assister||null,ko:isKickoffGoal(g),spd:num(g.speed)!=null?Math.round(+g.speed):null,
      z:co(s,'Z'),x:co(s,'X')!=null?f*co(s,'X'):null,y:co(s,'Y')!=null?f*co(s,'Y'):null,
      ix:co(i,'X')!=null?f*co(i,'X'):null,iz:co(i,'Z'),
      ax:co(g.assist_from,'X')!=null?f*co(g.assist_from,'X'):null,ay:co(g.assist_from,'Y')!=null?f*co(g.assist_from,'Y'):null,az:co(g.assist_from,'Z'),
      touches:Array.isArray(g.touches)?g.touches.filter(t=>t&&t.location).map(t=>({name:t.player?String(t.player):'',team:num(t.team),x:f*co(t.location,'X'),y:f*co(t.location,'Y'),z:co(t.location,'Z')})):null,scoreTeam:team,
      defl,dx:co(dp,'X')!=null?f*co(dp,'X'):null,dy:co(dp,'Y')!=null?f*co(dp,'Y'):null,dz:co(dp,'Z'),deflOnly:!!defl&&!g.scorer_from};
  });
  const dur=num(r.duration_seconds)||300;
  // Lowest and highest goal margin during the match, replayed from the goals in scoring order.
  // Skipped when the goals don't add up to the final score.
  let mg=0,lo=0,hi=0;goals.forEach(g=>{mg+=g.ours?1:-1;lo=Math.min(lo,mg);hi=Math.max(hi,mg);});
  const swing=goals.length&&mg===(num(r.team_score)||0)-(num(r.opponent_score)||0)?{lo,hi}:null;
  const opps=(r.players||[]).filter(p=>p&&p.name&&!p.tracked&&myTeam!=null&&num(p.team)!==myTeam).map(p=>({name:String(p.name),url:trackerUrl(p)}));
  const left=(r.players_left||[]).filter(Boolean).map(x=>({name:x.name,ours:myTeam!=null&&num(x.team)===myTeam}));
  return {guid:r.match_guid,when:new Date(r.started_at),win:r.result==='Win',us:num(r.team_score)||0,them:num(r.opponent_score)||0,
    ot:!!r.overtime,dur,swing,arena:arenaName(r.arena),playlist:r.playlist||'Unknown playlist',lines,
    first:goals.length?(goals[0].ours?'us':'them'):null,goals,secs:matchSecs(r),deficit:maxDeficit(goals),lead:maxDeficit(goals,-1),
    ourGoals:goals.filter(g=>g.ours),theirGoals:goals.filter(g=>!g.ours),
    replay:!!r.replay_created,left,opps,ff:!!r.ff,
    spectators:Array.isArray(r.spectators)?r.spectators.map(String):null,
    drinks:r.drinks&&num(r.drinks[PLAYERS[0].name])!=null?num(r.drinks[PLAYERS[0].name]):null};
}

function build(){
  const done=RAW.matches.map(forfeit).filter(r=>r&&(r.result==='Win'||r.result==='Loss')&&r.started_at).map(toMatch).filter(m=>!isNaN(m.when));
  done.sort((a,b)=>a.when-b.when);
  const counts={};done.forEach(m=>counts[m.playlist]=(counts[m.playlist]||0)+1);
  const lists=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  if(playlist!=='All'&&!counts[playlist])playlist=counts['Ranked Doubles']?'Ranked Doubles':'All';
  $('playlist').innerHTML=`<option value="All">All playlists (${done.length})</option>`+lists.map(l=>`<option value="${esc(l)}">${esc(plName(l))} (${counts[l]})</option>`).join('');
  $('playlist').value=playlist;
  DONE=done;
  ALL=playlist==='All'?done:done.filter(m=>m.playlist===playlist);
  sessions=[];
  ALL.forEach(m=>{const s=sessions[sessions.length-1];
    if(s&&m.when-s.end<90*6e4){s.matches.push(m);s.end=new Date(m.when.getTime()+m.dur*1000);}
    else sessions.push({start:m.when,end:new Date(m.when.getTime()+m.dur*1000),matches:[m]});});
  NOW=SAMPLE&&ALL.length?ALL[ALL.length-1].when.getTime()+DAY/4:Date.now();
}
const mmrPlaylist=()=>playlist&&/^Ranked /.test(playlist)?playlist:'Ranked Doubles';
function mmrRows(j){
  return RAW.mmr.filter(r=>r&&r.player===PLAYERS[j].name&&r.playlist===mmrPlaylist()&&num(r.mmr)!=null)
    .map(r=>({at:new Date(r.logged_at),v:+r.mmr})).filter(r=>!isNaN(r.at)).sort((a,b)=>a.at-b.at);
}
function mmrAt(j,t){let v=null;for(const r of mmrRows(j)){if(r.at.getTime()<=t)v=r.v;else break;}return v;}

function inPeriod(){
  if(!ALL.length)return [];
  if(period==='all')return ALL;
  if(period==='game')return ALL.slice(-1);
  if(period==='last')return sessions[sessions.length-1].matches;
  const cut=NOW-(+period)*DAY;
  return ALL.filter(m=>m.when.getTime()>=cut);
}
function streaks(list){
  let cur=0,curW=null,bestW=0,bestL=0,run=0,prev=null;
  list.forEach(m=>{if(m.win===prev)run++;else{run=1;prev=m.win;}if(m.win)bestW=Math.max(bestW,run);else bestL=Math.max(bestL,run);});
  if(list.length){curW=list[list.length-1].win;for(let i=list.length-1;i>=0&&list[i].win===curW;i--)cur++;}
  return {cur,curW,bestW,bestL};
}
// True when player j's value is higher than every other player's.
const leads=(vals,j)=>{const o=vals.filter((v,k)=>k!==j&&v!=null);return vals[j]!=null&&o.length>0&&vals[j]>Math.max(...o);};
function agg(list){
  return PLAYERS.map((p,j)=>{
    const L=list.map(m=>m.lines[j]).filter(Boolean);
    const t={games:L.length,mvp:0,both:0};
    ['score','goals','assists','shots','saves','demos','touches'].forEach(k=>t[k]=L.reduce((s,l)=>s+l[k],0));
    const avg=k=>{const v=L.map(l=>l[k]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
    ['boost','ss','air','wall','ground','bumps','pickups','speed'].forEach(k=>t[k]=avg(k));
    const tl=L.filter(l=>l.saveGoals!=null);t.timed=tl.length;t.saveGoals=tl.reduce((s,l)=>s+l.saveGoals,0);
    const cars={};L.forEach(l=>{if(l.car)cars[l.car]=(cars[l.car]||0)+1;});
    t.car=Object.keys(cars).sort((a,b)=>cars[b]-cars[a])[0]||null;
    t.shotpct=t.shots?100*t.goals/t.shots:null;
    const sp=L.flatMap(l=>l.goalSpeeds);
    t.gsAvg=sp.length?sp.reduce((a,b)=>a+b,0)/sp.length:null;t.gsMax=sp.length?Math.max(...sp):null;
    const nb=L.map(l=>l.noBoost).filter(v=>v!=null);t.noBoost=nb.length?nb.reduce((a,b)=>a+b,0):null;t.noBoostGames=nb.length;
    const hh=L.map(l=>l.hardest).filter(v=>v!=null);t.hardest=hh.length?Math.max(...hh):null;
    const ht=list.filter(m=>m.lines[j]&&m.lines[j].goals>=3);t.hat=ht.length;t.hatWins=ht.filter(m=>m.win).length;
    // Win record by how many goals this player scored in the game (index 5 = 5 or more).
    t.byGoals=[1,2,3,4,5].map(n=>{const g=list.filter(m=>m.lines[j]&&(n<5?m.lines[j].goals===n:m.lines[j].goals>=5));return {n:g.length,w:g.filter(m=>m.win).length};});
    t.kickoff=list.reduce((s,m)=>s+m.ourGoals.filter(g=>g.ko&&g.who===j).length,0);
    const dd=L.map(l=>l.dist).filter(v=>v!=null);t.dist=dd.length?dd.reduce((a,b)=>a+b,0):null;t.distGames=dd.length;
    const ts=L.map(l=>l.topSpeed).filter(v=>v!=null);t.topSpeed=ts.length?Math.max(...ts):null;
    list.forEach(m=>{const a=m.lines[j],o=m.lines.filter((l,k)=>l&&k!==j);if(a&&o.length){t.both++;if(o.every(l=>a.score>l.score))t.mvp++;}});
    return t;
  });
}

// ---------- summary ----------
function renderSummary(list){
  const w=list.filter(m=>m.win).length,l=list.length-w;
  $('kRecord').textContent=w+'–'+l;
  const gf=list.reduce((s,m)=>s+m.us,0),ga=list.reduce((s,m)=>s+m.them,0);
  $('kRecordSub').textContent=list.length?`${Math.round(100*w/list.length)}% win rate · goals ${gf} for, ${ga} against`:'No matches in this period';
  const st=streaks(list),all=streaks(ALL),el=$('kStreak');
  el.className='big num '+(all.curW?'w':'l');
  el.textContent=all.cur?(all.curW?'W':'L')+all.cur:'–';
  $('kStreakSub').textContent=all.cur?all.cur+(all.curW?(all.cur>1?' wins':' win'):(all.cur>1?' losses':' loss'))+' in a row, across sessions':'';
  $('kBestW').textContent=st.bestW;$('kBestL').textContent=st.bestL;
  $('kRankLabel').textContent=mmrPlaylist()+' rank';
  $('kRanks').innerHTML=PLAYERS.map((p,j)=>{const v=mmrAt(j,Infinity);return `<span class="who"><i style="background:${p.color}"></i>${esc(p.short)}</span><span class="rk">${rankBadge(v)}<span>${esc(rankOf(v))}</span></span><span class="mmr">${v==null?'':v}</span>`;}).join('');
  const d=PLAYERS.map((p,j)=>{const now=mmrAt(j,Infinity),then=mmrAt(j,NOW-30*DAY);return now!=null&&then!=null?now-then:null;});
  $('kRankSub').textContent=d.some(v=>v!=null)?'30-day change: '+PLAYERS.map((p,j)=>d[j]==null?null:p.short+' '+sign(d[j])).filter(Boolean).join(', '):'';
  $('rangeText').textContent=list.length?(list.length===1?`${fmtDate(list[0].when)} ${fmtTime(list[0].when)} · 1 match`:`${fmtDate(list[0].when)} to ${fmtDate(list[list.length-1].when)} · ${list.length} matches`):'No matches in this period';
}

// ---------- last session ----------
function renderLastSession(){
  const s=sessions[sessions.length-1],list=s.matches;
  const w=list.filter(m=>m.win).length,l=list.length-w;
  const mins=Math.round(list.reduce((a,m)=>a+m.dur,0)/60);
  $('lsWhen').textContent=fmtDay(s.start)+', '+fmtTime(s.start);
  $('lsRecord').innerHTML=`${w}–${l} <span class="pill ${w>=l?'w':'l'}">${w>l?'WINNING':w===l?'EVEN':'LOSING'} SESSION</span>`;
  const dm=PLAYERS.map((p,j)=>{const a=mmrAt(j,s.start.getTime()),b=mmrAt(j,s.end.getTime()+30*6e4);return a!=null&&b!=null&&a!==b?p.short+' '+sign(b-a):null;}).filter(Boolean);
  $('lsMeta').innerHTML=`<span>${list.length} match${list.length>1?'es':''}</span><span>${mins} min played</span>`+(dm.length?`<span>MMR ${esc(dm.join(', '))}</span>`:'');
  const A=agg(list);
  const cols=[['score','Score'],['goals','G'],['assists','A'],['shots','Sh'],['saves','Sv'],['demos','Dm'],['touches','Tch']];
  $('lsTable').innerHTML='<thead><tr><th>Player</th>'+cols.map(c=>`<th>${c[1]}</th>`).join('')+'</tr></thead><tbody>'+
    PLAYERS.map((p,j)=>A[j].games?`<tr><td><span class="tag ${p.tag}" style="padding:1px 8px"><i></i>${esc(p.short)}</span></td>`+cols.map(c=>{const v=A[j][c[0]];return `<td${leads(A.map(a=>a.games?a[c[0]]:null),j)?' style="font-weight:600"':''}>${v}</td>`;}).join('')+'</tr>':'').join('')+'</tbody>';
  const byDiff=[...list].sort((a,b)=>(b.us-b.them)-(a.us-a.them));
  const best=byDiff[0],worst=byDiff[byDiff.length-1];
  let top=null;list.forEach(m=>m.lines.forEach((L,j)=>{if(L&&(!top||L.score>top.s))top={j,s:L.score};}));
  $('lsCallouts').innerHTML=[
    ['Best win',best.win?`${best.us}–${best.them} on ${best.arena}`:'No wins'],
    ['Worst loss',!worst.win?`${worst.us}–${worst.them} on ${worst.arena}`:'No losses'],
    ['Top game',top?`${PLAYERS[top.j].short}, ${top.s} score`:'–']
  ].map(c=>`<div class="callout"><span class="k">${c[0]}</span><span class="v num">${esc(c[1])}</span></div>`).join('');
}

// ---------- form strip ----------
function renderStrip(){
  const last=ALL.slice(-40);
  const maxD=Math.max(1,...last.map(m=>Math.abs(m.us-m.them)));
  const strip=$('strip');
  strip.setAttribute('aria-label','Last results: '+last.map(m=>m.win?'W':'L').join(''));
  strip.innerHTML=last.map(m=>{
    const h=Math.round(18+32*(Math.abs(m.us-m.them)/maxD));
    const t=`${m.win?'Win':'Loss'} ${m.us}–${m.them}${m.ot?' (OT)':''} · ${m.arena} · ${fmtDate(m.when)}`;
    return `<div class="pip ${m.win?'w':'l'}" title="${esc(t)}"><span style="height:${h/2}%"></span></div>`;
  }).join('');
  const rec=l=>{const w=l.filter(m=>m.win).length;return w+'–'+(l.length-w);};
  $('formCallouts').innerHTML=[['Last 10',rec(ALL.slice(-10))],['Overtime',rec(ALL.filter(m=>m.ot))],['One-goal games',rec(ALL.filter(m=>Math.abs(m.us-m.them)===1))]]
    .map(c=>`<div class="callout"><span class="k">${c[0]}</span><span class="v num">${c[1]}</span></div>`).join('');
}

// ---------- comparison ----------
const STATS=[{k:'score',label:'Score'},{k:'goals',label:'Goals'},{k:'assists',label:'Assists'},{k:'shots',label:'Shots'},{k:'shotpct',label:'Shooting %',pct:true},{k:'saves',label:'Saves'},{k:'demos',label:'Demos'},{k:'touches',label:'Touches'},{k:'mvp',label:'Top scorer',count:true}];
function renderCmp(list){
  const A=agg(list);
  const rows=STATS.map(s=>{
    const vals=A.map(a=>{
      if(s.pct)return a[s.k];
      if(s.count)return mode==='avg'?(a.both?100*a.mvp/a.both:null):a.mvp;
      return a.games?(mode==='avg'?a[s.k]/a.games:a[s.k]):null;
    });
    const mx=Math.max(1e-9,...vals.filter(v=>v!=null));
    const fmt=v=>v==null?'–':s.pct||(s.count&&mode==='avg')?v.toFixed(0)+'%':mode==='avg'?(s.k==='score'||s.k==='touches'?v.toFixed(0):v.toFixed(2)):Math.round(v).toLocaleString();
    const label=s.count&&mode==='avg'?'Top scorer %':s.label;
    return `<div class="cmp-row"><span class="stat">${label}</span>`+vals.map((v,j)=>`<div class="bar"><span class="val ${leads(vals,j)?'lead':''}">${fmt(v)}</span><div class="track"><div class="fill" style="width:${v==null?0:(100*v/mx).toFixed(1)}%;background:${PLAYERS[j].color}"></div></div></div>`).join('')+'</div>';
  });
  $('cmp').innerHTML=`<div class="cmp-row head"><span>${list.length} games</span>`+PLAYERS.map((p,j)=>`<span class="tag ${p.tag}" style="justify-self:start"><i></i>${esc(p.name)} · ${A[j].games}</span>`).join('')+'</div>'+rows.join('');
}

// ---------- charts ----------
function niceStep(r){const p=Math.pow(10,Math.floor(Math.log10(r||1)));const f=r/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;}
function lineChart(el,{labels,series,fmt,minY,maxY,height=240}){
  const all=series.flatMap(s=>s.values).filter(v=>v!=null);
  if(!all.length){el.innerHTML='<p class="note">Nothing to chart yet.</p>';return;}
  const W=Math.max(300,el.clientWidth||600),H=height,pad={l:44,r:14,t:12,b:26};
  let lo=minY!=null?minY:Math.min(...all),hi=maxY!=null?maxY:Math.max(...all);
  if(minY==null||maxY==null){const span=(hi-lo)||Math.max(1,Math.abs(hi)*.1);if(minY==null)lo-=span*.12;if(maxY==null)hi+=span*.12;}
  const step=niceStep((hi-lo)/4);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;if(hi===lo)hi=lo+step;
  const n=labels.length;
  const x=i=>pad.l+(n<2?(W-pad.l-pad.r)/2:i*(W-pad.l-pad.r)/(n-1));
  const y=v=>pad.t+(hi-v)*(H-pad.t-pad.b)/(hi-lo);
  let g='';
  for(let v=lo;v<=hi+1e-9;v+=step)g+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${pad.l-8}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;
  const every=Math.ceil(n/(W<500?4:8));
  labels.forEach((l,i)=>{if(i%every===0||i===n-1)g+=`<text x="${x(i)}" y="${H-6}" text-anchor="middle">${esc(l)}</text>`;});
  if(series.ref!=null)g+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(series.ref)}" y2="${y(series.ref)}" stroke="var(--muted)" stroke-dasharray="3 4"/>`;
  series.forEach(s=>{
    const pts=s.values.map((v,i)=>v==null?null:[x(i),y(v)]).filter(Boolean);if(!pts.length)return;
    if(s.area&&pts.length>1)g+=`<path d="M${pts[0][0]},${y(lo)} L${pts.map(p=>p.join(',')).join(' L')} L${pts[pts.length-1][0]},${y(lo)} Z" fill="${s.color}" opacity=".08"/>`;
    if(pts.length>1)g+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const e=pts[pts.length-1];g+=`<circle cx="${e[0]}" cy="${e[1]}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
  });
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(s=>s.name).join(' and '))} over time">${g}<line class="xh" y1="${pad.t}" y2="${H-pad.b}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/><g class="dots"></g><rect x="${pad.l}" y="0" width="${W-pad.l-pad.r}" height="${H}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  const svg=el.querySelector('svg'),tip=el.querySelector('.tip'),xh=svg.querySelector('.xh'),dots=svg.querySelector('.dots');
  svg.addEventListener('pointermove',ev=>{
    const r=svg.getBoundingClientRect(),px=(ev.clientX-r.left)*W/r.width;
    const i=n<2?0:clamp(Math.round((px-pad.l)/((W-pad.l-pad.r)/(n-1))),0,n-1);
    xh.setAttribute('x1',x(i));xh.setAttribute('x2',x(i));xh.setAttribute('visibility','visible');
    dots.innerHTML=series.map(s=>s.values[i]==null?'':`<circle cx="${x(i)}" cy="${y(s.values[i])}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('');
    tip.innerHTML=`<div class="t">${esc(series.tipTitle?series.tipTitle(i):labels[i])}</div>`+series.map(s=>s.values[i]==null?'':`<div class="r"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b class="num">${fmt(s.values[i])}</b></div>`).join('');
    tip.hidden=false;
    const left=x(i)*r.width/W,tw=tip.offsetWidth;
    tip.style.left=(left+12+tw>r.width?left-tw-12:left+12)+'px';tip.style.top='8px';
  });
  svg.addEventListener('pointerleave',()=>{tip.hidden=true;xh.setAttribute('visibility','hidden');dots.innerHTML='';});
}

const METRICS=[
  {k:'winpct',label:'Win rate',duo:true,fmt:v=>Math.round(v)+'%',min:0,max:100,ref:50},
  {k:'goals',label:'Goals / game',fmt:v=>v.toFixed(1)},
  {k:'saves',label:'Saves / game',fmt:v=>v.toFixed(1)},
  {k:'score',label:'Score / game',fmt:v=>Math.round(v)},
  {k:'shotpct',label:'Shooting %',fmt:v=>Math.round(v)+'%',min:0},
  {k:'demos',label:'Demos / game',fmt:v=>v.toFixed(1)}
];
function renderTrend(){
  const M=METRICS.find(m=>m.k===metric)||METRICS[0];
  const labels=sessions.map(s=>fmtDate(s.start));
  let series;
  if(M.duo){
    series=[{name:'Win rate',color:'var(--ink-2)',area:true,values:sessions.map(s=>100*s.matches.filter(m=>m.win).length/s.matches.length)}];
    $('trendLegend').innerHTML='<span><i style="background:var(--ink-2)"></i>Win rate per session</span><span><i style="background:var(--muted);height:1px"></i>50% line</span>';
  }else{
    series=PLAYERS.map((p,j)=>({name:p.short,color:p.color,values:sessions.map(s=>{const a=agg(s.matches)[j];if(!a.games)return null;return M.k==='shotpct'?a.shotpct:a[M.k]/a.games;})}));
    $('trendLegend').innerHTML=PLAYERS.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('');
  }
  series.ref=M.ref;
  series.tipTitle=i=>{const s=sessions[i],w=s.matches.filter(m=>m.win).length;return fmtDay(s.start)+' · '+w+'–'+(s.matches.length-w);};
  lineChart($('trend'),{labels,series,fmt:M.fmt,minY:M.min,maxY:M.max});
}
function renderMMR(){
  $('mmrSub').textContent=mmrPlaylist();
  $('mmrLegend').innerHTML=PLAYERS.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('');
  const rows=PLAYERS.map((p,j)=>mmrRows(j));
  if(rows.every(r=>!r.length)){$('mmrChart').innerHTML='<p class="note">No MMR logged for '+esc(mmrPlaylist())+' yet.</p>';return;}
  // One point per day that has a value, carrying the latest value logged that day.
  const days=[...new Set(rows.flat().map(r=>r.at.toDateString()))].map(d=>new Date(d)).sort((a,b)=>a-b);
  const labels=days.map(fmtDate);
  const series=PLAYERS.map((p,j)=>({name:p.short,color:p.color,values:days.map(d=>{const inDay=rows[j].filter(r=>r.at.toDateString()===d.toDateString());return inDay.length?inDay[inDay.length-1].v:null;})}));
  series.tipTitle=i=>fmtDay(days[i]);
  lineChart($('mmrChart'),{labels,series,fmt:v=>Math.round(v),height:210});
}

// ---------- goal map ----------
// Cold to hot: blue, through violet, to red. t runs 0..1.
const HEAT=[[47,111,214],[124,77,196],[214,51,57]];
function heatColor(t){
  t=clamp(t,0,1)*(HEAT.length-1);const i=Math.min(HEAT.length-2,Math.floor(t)),f=t-i;
  const c=HEAT[i].map((v,k)=>Math.round(v+(HEAT[i+1][k]-v)*f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// Goal-map markers drawn as little Rocket League balls: a grey sphere with the hex panel
// seams, ringed in the scorer's colour (neutral on the field view, where the heat carries colour).
function rlBallDefs(id){return `<defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".6" stop-color="#c3cad2"/><stop offset="1" stop-color="#7d8692"/></radialGradient></defs>`;}
function rlBall(x,y,r,ring,rw,id,tip,gid){
  const hex=[0,1,2,3,4,5].map(k=>{const a=Math.PI/3*k-Math.PI/2;return [Math.cos(a),Math.sin(a)];});
  const seam=hex.map(([c,s])=>`${(.38*c).toFixed(3)},${(.38*s).toFixed(3)}`).join(' ');
  const spokes=hex.map(([c,s])=>`M${(.38*c).toFixed(3)} ${(.38*s).toFixed(3)}L${(.92*c).toFixed(3)} ${(.92*s).toFixed(3)}`).join('');
  return `<g class="dot" data-g="${gid}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${r})"><title>${esc(tip)}</title>`+
    `<circle r="1" fill="url(#${id})"/><g fill="none" stroke="#3a424c" stroke-opacity=".55" stroke-width=".5" vector-effect="non-scaling-stroke"><polygon points="${seam}"/><path d="${spokes}"/></g>`+
    `<circle r="1" fill="none" stroke="${ring}" stroke-width="${rw}" vector-effect="non-scaling-stroke"/></g>`;
}
function renderMaps(list){
  let goals=list.flatMap(m=>(mapSide==='us'?m.ourGoals:m.theirGoals).map(g=>({...g,m})));
  if(mapSide==='us'&&mapWho!=='all')goals=goals.filter(g=>g.who===+mapWho);
  goals.forEach((g,k)=>g.k=k);
  const shots=goals.filter(g=>g.x!=null&&g.y!=null), hits=goals.filter(g=>g.ix!=null&&g.iz!=null);
  $('mapWho').style.visibility=mapSide==='us'&&PLAYERS.length>1?'visible':'hidden';
  const col=g=>g.who>=0?PLAYERS[g.who].color:'var(--opp)';
  const tip=g=>`${g.who>=0?PLAYERS[g.who].short:mapSide==='us'?'Us':'Opponent'}${g.assister?' (assist '+(PLAYERS.find(q=>q.name===g.assister)?.short||g.assister)+')':''}${g.defl?' · redirected by '+g.defl:''}${g.spd!=null?' · '+fSpd(g.spd):''} · ${g.m.us}–${g.m.them} ${g.m.win?'win':'loss'}, ${fmtDate(g.m.when)}`;
  // Whole pitch, their goal at the top. Goal lines at Y=±5120, nets 880 deep, corners cut 1152.
  const W=480,Y0=-6000,Y1=6000,H=Math.round(W*(Y1-Y0)/8192);
  const sx=x=>(x+4096)/8192*W,sy=y=>(Y1-y)/(Y1-Y0)*H,su=u=>u/8192*W;
  const cell=512,bins={};
  shots.forEach(g=>{const c=Math.floor((clamp(g.x,-4096,4095)+4096)/cell),r=Math.floor((clamp(g.y,-5120,5119)+5120)/cell);const k=c+','+r;bins[k]=(bins[k]||0)+1;});
  const bmax=Math.max(1,...Object.values(bins)),ch=1152;
  const ends=s=>{const g=5120*s,c=(5120-ch)*s,n=6000*s;return `L${sx(-4096)},${sy(c)} L${sx(-4096+ch)},${sy(g)} L${sx(-893)},${sy(g)} L${sx(-893)},${sy(n)} L${sx(893)},${sy(n)} L${sx(893)},${sy(g)} L${sx(4096-ch)},${sy(g)} L${sx(4096)},${sy(c)}`;};
  const outline=`M${sx(-4096)},${sy(0)} ${ends(1)} L${sx(4096)},${sy(-(5120-ch))} L${sx(4096-ch)},${sy(-5120)} L${sx(893)},${sy(-5120)} L${sx(893)},${sy(-6000)} L${sx(-893)},${sy(-6000)} L${sx(-893)},${sy(-5120)} L${sx(-4096+ch)},${sy(-5120)} L${sx(-4096)},${sy(-(5120-ch))} Z`;
  let f=`<path d="${outline}" fill="var(--pitch)"/>`;
  Object.entries(bins).forEach(([k,n])=>{const [c,r]=k.split(',').map(Number);
    f+=`<rect x="${sx(c*cell-4096)+.5}" y="${sy(-5120+(r+1)*cell)+.5}" width="${su(cell)-1}" height="${su(cell)-1}" rx="2" fill="${heatColor(n/bmax)}" opacity=".85"><title>${n} goal${n>1?'s':''} from here</title></rect>`;});
  const ln='stroke="var(--pitch-line)" stroke-width="1.5" fill="none"';
  f+=`<path d="${outline}" ${ln}/>`;
  f+=`<line x1="${sx(-4096)}" x2="${sx(4096)}" y1="${sy(0)}" y2="${sy(0)}" ${ln}/><circle cx="${sx(0)}" cy="${sy(0)}" r="${su(1000)}" ${ln}/>`;
  f+=`<rect x="${sx(-1800)}" y="${sy(5120)}" width="${su(3600)}" height="${su(1100)}" ${ln}/><rect x="${sx(-1800)}" y="${sy(-4020)}" width="${su(3600)}" height="${su(1100)}" ${ln}/>`;
  f+=`<text x="${W/2}" y="${sy(6000)-6}" text-anchor="middle">${mapSide==='us'?'Their goal':'Our goal'}</text><text x="${W/2}" y="${sy(-6000)+14}" text-anchor="middle">${mapSide==='us'?'Our goal':'Their goal'}</text>`;
  // Dots stay neutral here so they don't fight the blue-to-red heat; the net view carries who scored.
  shots.forEach(g=>{f+=rlBall(sx(clamp(g.x,-4096,4096)),sy(clamp(g.y,-5120,5120)),4.5,'#0b1017',1,'rlbF',tip(g),g.k);});
  $('fieldMap').innerHTML=`<svg viewBox="0 -18 ${W} ${H+36}" role="img" aria-label="Top-down field with ${shots.length} shot locations">${rlBallDefs('rlbF')}${f}</svg>`;
  // Front elevation of the goal, drawn like a technical drawing. Mouth 1786 x 642 uu, 880 deep (1 uu = 1 cm).
  const NW=460,ml=30,mr=58,mt=46,mb=66,iw=NW-ml-mr,ih=Math.round(iw*642/1786),NH=mt+ih+mb;
  const nx=x=>ml+(clamp(x,-893,893)+893)/1786*iw,nz=z=>mt+(642-clamp(z,0,642))/642*ih;
  const fM=uu=>IMP()?(uu/100*3.28084).toFixed(1)+' ft':(uu/100).toFixed(2)+' m';
  const dim='stroke="var(--muted)" stroke-width="1" fill="none"',fr=su=>su*iw/1786;   // fr: uu to px
  let n=`<defs><pattern id="netMesh" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8M0 0H8" stroke="var(--line)" stroke-width=".7"/></pattern></defs>`;
  n+=`<rect x="${nx(-893)}" y="${nz(642)}" width="${iw}" height="${ih}" fill="var(--surface-2)"/><rect x="${nx(-893)}" y="${nz(642)}" width="${iw}" height="${ih}" fill="url(#netMesh)"/>`;
  for(let i=1;i<3;i++)n+=`<line x1="${nx(-893+i*1786/3)}" x2="${nx(-893+i*1786/3)}" y1="${nz(642)}" y2="${nz(0)}" stroke="var(--line)" stroke-dasharray="3 4"/><line x1="${nx(-893)}" x2="${nx(893)}" y1="${nz(i*214)}" y2="${nz(i*214)}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
  const zones={};hits.forEach(g=>{const zc=clamp(Math.floor((g.ix+893)/(1786/3)),0,2),zr=clamp(Math.floor(g.iz/214),0,2);zones[zc+','+zr]=(zones[zc+','+zr]||0)+1;});
  const zmax=Math.max(1,...Object.values(zones)),labels=[];
  for(let c=0;c<3;c++)for(let r=0;r<3;r++){const v=zones[c+','+r]||0,pct=hits.length?Math.round(100*v/hits.length):0;
    const x0=nx(-893+c*1786/3),y0=nz((r+1)*214),zw=nx(-893+1786/3)-nx(-893),zh=nz(0)-nz(214);
    n+=`<rect x="${x0+1}" y="${y0+1}" width="${zw-2}" height="${zh-2}" fill="${heatColor(v/zmax)}" opacity="${hits.length?.6:0}"><title>${v} goals (${pct}%)</title></rect>`;
    if(hits.length)labels.push(`<text class="zone" x="${x0+zw/2}" y="${y0+zh/2+5}" text-anchor="middle" paint-order="stroke" stroke="rgba(11,16,23,.55)" stroke-width="3" fill="#fff" style="fill:#fff">${pct}%</text>`);}
  // Frame: posts and crossbar as hollow members outside the mouth, centreline, ground.
  const t=fr(34),L=nx(-893),R=nx(893),T=nz(642),G=nz(0);
  n+=`<path d="M${L-t},${G} V${T-t} H${R+t} V${G} H${R} V${T} H${L} V${G} Z" fill="var(--surface)" stroke="var(--ink-2)" stroke-width="1.5" stroke-linejoin="miter"/>`;
  n+=`<line x1="${NW/2}" x2="${NW/2}" y1="${T-t-12}" y2="${G+8}" stroke="var(--muted)" stroke-width=".8" stroke-dasharray="10 3 2 3"/><text x="${NW/2+4}" y="${T-t-14}" class="dimt">CL</text>`;
  n+=`<line x1="6" x2="${NW-6}" y1="${G}" y2="${G}" stroke="var(--ink-2)" stroke-width="1.5"/>`;
  for(let x=10;x<NW-6;x+=8)n+=`<line x1="${x}" x2="${x-5}" y1="${G+1}" y2="${G+6}" stroke="var(--line)" stroke-width=".8"/>`;
  // Width dimension under the goal, height dimension to the right, depth as a note.
  const wy=G+34,hx=R+t+26,tick=(x,y)=>`M${x-4},${y+4} L${x+4},${y-4}`;
  n+=`<path d="M${L},${G+10} V${wy+5} M${R},${G+10} V${wy+5} M${L},${wy} H${R} ${tick(L,wy)} ${tick(R,wy)}" ${dim}/>`;
  n+=`<text x="${NW/2}" y="${wy-5}" text-anchor="middle" class="dimt">${fM(1786)}  ·  1786 uu</text>`;
  n+=`<path d="M${R+t+6},${T} H${hx+5} M${R+t+6},${G} H${hx+5} M${hx},${T} V${G} ${tick(hx,T)} ${tick(hx,G)}" ${dim}/>`;
  n+=`<text transform="translate(${hx+13} ${(T+G)/2}) rotate(-90)" text-anchor="middle" class="dimt">${fM(642)} · 642 uu</text>`;
  n+=`<text x="${L-t}" y="${T-t-14}" class="dimt">CROSSBAR</text><text x="${R+t}" y="${T-t-14}" text-anchor="end" class="dimt">DEPTH ${fM(880)} · 880 uu</text>`;
  n+=`<text x="${L}" y="${NH-8}" class="dimt">L. POST</text><text x="${NW/2}" y="${NH-8}" text-anchor="middle" class="dimt">FRONT ELEVATION · GOAL MOUTH</text><text x="${R}" y="${NH-8}" text-anchor="end" class="dimt">R. POST</text>`;
  hits.forEach(g=>{n+=rlBall(nx(g.ix),nz(g.iz),6,col(g),2.2,'rlbN',tip(g),g.k);});
  n+=labels.join('');
  $('netMap').innerHTML=`<svg viewBox="0 0 ${NW} ${NH}" role="img" aria-label="Goal mouth with ${hits.length} impact points">${rlBallDefs('rlbN')}${n}</svg>`;
  $('fieldTitle').textContent=mapSide==='us'?'Where our goals were shot from':'Where their goals were shot from';
  $('netTitle').textContent=mapSide==='us'?'Where our goals hit the net':'Where their goals beat us';
  $('mapLegend').innerHTML=mapSide==='us'?PLAYERS.filter((p,j)=>mapWho==='all'||+mapWho===j).map(p=>`<span><i style="background:${p.color};height:8px;width:8px"></i>${esc(p.name)}</span>`).join(''):'<span><i style="background:var(--opp);height:8px;width:8px"></i>Opponents</span>';
  const top=Object.entries(zones).sort((a,b)=>b[1]-a[1])[0];
  const zname=k=>{const [c,r]=k.split(',').map(Number);return ['low','middle','high'][r]+' '+['left','centre','right'][c];};
  const sp=goals.filter(g=>g.spd!=null),avgSpd=sp.length?Math.round(sp.reduce((a,g)=>a+g.spd,0)/sp.length):null;
  const missing=goals.length-hits.length;
  $('mapNote').textContent=!goals.length?'No goals in this period.':
    `${goals.length} goals${avgSpd!=null?', average '+fSpd(avgSpd):''}.`+(top?` Most went in ${zname(top[0])} (${Math.round(100*top[1]/hits.length)}%).`:'')+
    (missing?` ${missing} goal${missing>1?'s were':' was'} recorded before positions were saved.`:'')+' The net is drawn as you would see it facing the goal.';
  G3.goals=goals.filter(g=>g.x!=null&&g.y!=null&&g.ix!=null&&g.iz!=null);G3.side=mapSide;draw3D();
}

// ---------- 3D goal map ----------
// A hand-rolled perspective view of the pitch (uu, z up). Each goal is an arc from where it was shot
// to where it crossed the goal line. The big view orbits on drag; hovering a ball on the flat maps
// plays that goal back in a small "replay" view and highlights it in the big one.
const G3={T:[0,3300,300],goals:[],side:'us',yaw:-0.5,pitch:0.42,zoom:1,auto:true,t0:performance.now(),focus:null,ft:0};
const RP={k:null,t:0};
const REDIR='#ff4d6d';   // redirect marker and the ball's path after it
function bez(a,b,n){const d=Math.hypot(b[0]-a[0],b[1]-a[1]),lift=Math.max(a[2],b[2])+Math.min(900,d*.09);
  return Array.from({length:n},(_,i)=>{const t=i/(n-1),u=1-t;return [u*a[0]+t*b[0],u*a[1]+t*b[1],u*u*a[2]+2*u*t*lift+t*t*b[2]];});}
// The ball's touches before a goal, oldest first: the last 3 touches when the recorder saved them,
// otherwise assist, the scorer's shot and the redirect where those are known.
function waypoints(g){
  const kind=(name,team)=>{const j=PLAYERS.findIndex(p=>p.name===name);return j>=0?'p'+j:team!=null&&team===g.scoreTeam?'mate':'opp';};
  if(g.touches&&g.touches.length)return g.touches.filter(t=>t.x!=null&&t.y!=null).map(t=>({p:[t.x,t.y,t.z!=null?t.z:93],name:t.name,kind:kind(t.name,t.team),other:t.team!=null&&g.scoreTeam!=null&&t.team!==g.scoreTeam}));
  const w=[];
  if(g.ax!=null&&g.ay!=null)w.push({p:[g.ax,g.ay,g.az!=null?g.az:93],name:g.assister,kind:kind(g.assister,g.scoreTeam),other:false});
  w.push({p:[g.x,g.y,g.z!=null?g.z:93],name:g.deflOnly?g.defl:g.scorer,kind:g.deflOnly?'opp':kind(g.scorer,g.scoreTeam),other:!!g.deflOnly});
  if(g.defl&&!g.deflOnly&&g.dx!=null&&g.dy!=null)w.push({p:[g.dx,g.dy,g.dz!=null?g.dz:93],name:g.defl,kind:'opp',other:true});
  return w;
}
// Points from the first touch to the net, 16 per leg. pts.marks: each touch's point index;
// pts.kink: the redirect (a last touch by the other team), if any.
function arcOf(g){
  const w=waypoints(g),b=[g.ix,5120,g.iz];if(!w.length)w.push({p:[g.x,g.y,93],name:g.scorer,kind:'mate'});
  let pts=[];const marks=[];
  w.forEach((t,i)=>{marks.push({i:pts.length?pts.length-1:0,...t});const nx=i+1<w.length?w[i+1].p:b,leg=bez(t.p,nx,16);pts=pts.concat(pts.length?leg.slice(1):leg);});
  pts.marks=marks;const last=w[w.length-1];if(last.other)pts.kink=marks[marks.length-1].i;
  return pts;
}
// Flight time for the replay: real distance over the goal's speed, squeezed into 0.9 to 2.2 s.
function flightMs(g,pts){let d=0;for(let i=1;i<pts.length;i++)d+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);
  const v=g.spd?g.spd/0.036:2000,legs=(pts.marks||[0]).length;return Math.max(900,Math.min(1500+700*legs,d/v*1000*1.6));}
function render3D(cv,V){
  const W=cv.clientWidth,H=cv.clientHeight,dpr=window.devicePixelRatio||1;if(!W||!H)return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const css=getComputedStyle(document.documentElement),tok=n=>css.getPropertyValue(n).trim();
  const ink=V.hud?'#8fdcff':tok('--ink-2'),muted=V.hud?'rgba(120,200,255,.55)':tok('--muted'),line=V.hud?'rgba(90,180,255,.28)':tok('--line'),pcol=PLAYERS.map((p,j)=>tok('--p'+(j+1))),opp=tok('--opp')||muted;
  const T=V.T,D=V.D,F=V.F,ca=Math.cos(V.yaw),sa=Math.sin(V.yaw),cb=Math.cos(V.pitch),sb=Math.sin(V.pitch);
  const P=([x,y,z])=>{x-=T[0];y-=T[1];z-=T[2];const x1=x*ca-y*sa,y1=x*sa+y*ca;const up=z*cb+y1*sb,dp=Math.max(300,y1*cb-z*sb+D);return [W/2+F*x1/dp,H*.55-F*up/dp,dp];};
  const path=(pts,close)=>{c.beginPath();pts.forEach((p,i)=>{const q=P(p);i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);});if(close)c.closePath();};
  const ch=1152,floor=[[-4096,-5120+ch],[-4096+ch,-5120],[4096-ch,-5120],[4096,-5120+ch],[4096,5120-ch],[4096-ch,5120],[-4096+ch,5120],[-4096,5120-ch]].map(([x,y])=>[x,y,0]);
  if(V.hud){c.fillStyle='#050b14';c.fillRect(0,0,W,H);}
  path(floor,true);c.fillStyle=V.hud?'rgba(20,60,110,.35)':(tok('--pitch')||'rgba(40,80,50,.3)');c.globalAlpha=V.hud?1:.55;c.fill();c.globalAlpha=1;c.strokeStyle=line;c.lineWidth=1.2;c.stroke();
  if(V.hud){c.lineWidth=.6;for(let x=-4096;x<=4096;x+=512){path([[x,-5120,0],[x,5120,0]]);c.stroke();}for(let y=-5120;y<=5120;y+=512){path([[-4096,y,0],[4096,y,0]]);c.stroke();}c.lineWidth=1.2;}
  path([[-4096,0,0],[4096,0,0]]);c.stroke();
  path(Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return [1000*Math.cos(a),1000*Math.sin(a),0];}));c.stroke();
  c.globalAlpha=.5;path([[-4096+ch,5120,0],[-4096+ch,5120,2044],[4096-ch,5120,2044],[4096-ch,5120,0]]);c.stroke();c.globalAlpha=1;
  [1,-1].forEach(sd=>{const g=5120*sd,b=6000*sd;c.strokeStyle=sd>0?ink:muted;c.lineWidth=sd>0?2:1.2;
    path([[-893,g,0],[-893,g,642],[893,g,642],[893,g,0]]);c.stroke();
    c.lineWidth=.8;path([[-893,g,642],[-893,b,642],[893,b,642],[893,g,642]]);c.stroke();path([[-893,b,0],[-893,b,642]]);c.stroke();path([[893,b,0],[893,b,642]]);c.stroke();path([[-893,b,0],[893,b,0]]);c.stroke();});
  c.font='11px '+(tok('--mono')||'monospace');c.textAlign='center';c.fillStyle=muted;
  if(!V.hud){const q=P([0,5120,800]);c.fillText(V.side==='us'?'Their goal':'Our goal',q[0],q[1]);}
  const ball=(x,y,r,col)=>{const gr=c.createRadialGradient(x-r*.35,y-r*.4,r*.1,x,y,r);gr.addColorStop(0,'#f4f6f8');gr.addColorStop(.6,'#c3cad2');gr.addColorStop(1,'#7d8692');
    c.fillStyle=gr;c.beginPath();c.arc(x,y,r,0,7);c.fill();c.strokeStyle=col;c.lineWidth=1.5;c.stroke();};
  const list=V.goals.map(g=>{const pts=arcOf(g);return {g,pts,depth:P(pts[pts.length>>1])[2]};}).sort((p,q)=>q.depth-p.depth);
  const fk=V.focus;
  list.forEach(({g,pts})=>{if(g.k===fk)return;const col=g.who>=0?pcol[g.who]:opp;
    c.globalAlpha=fk==null?.55:.1;c.strokeStyle=col;c.lineWidth=1.3;path(pts);c.stroke();
    const s=P(pts[0]);c.fillStyle=col;c.beginPath();c.arc(s[0],s[1],2,0,7);c.fill();
    if(pts.kink!=null){const q=P(pts[pts.kink]);c.strokeStyle=REDIR;c.lineWidth=1.2;c.beginPath();c.moveTo(q[0]-3,q[1]-3);c.lineTo(q[0]+3,q[1]+3);c.moveTo(q[0]+3,q[1]-3);c.lineTo(q[0]-3,q[1]+3);c.stroke();}
    const e=P(pts[pts.length-1]);c.globalAlpha=fk==null?1:.15;ball(e[0],e[1],Math.max(2.5,F*92/e[2]*.6),col);c.globalAlpha=1;});
  const it=fk==null?null:list.find(a=>a.g.k===fk);
  if(it){
    // Replay of one goal: dashed ghost path, glowing trail, ball at the head, drop line to the floor,
    // a crosshair where it was struck and a ring pulse where it went in.
    const {g,pts}=it,col=g.who>=0?pcol[g.who]:opp,dur=flightMs(g,pts);
    const Lx=pts.length-1,tl=(performance.now()-V.ft)%(dur+900),inA=false,el=tl,p=Math.min(1,el/dur),n=Math.max(1,Math.round(p*Lx));
    c.setLineDash([4,5]);c.strokeStyle=V.hud?'rgba(140,220,255,.45)':muted;c.lineWidth=1;path(pts);c.stroke();c.setLineDash([]);
    const s0=P(pts[0]),sp=P([pts[0][0],pts[0][1],0]);c.strokeStyle='#5fe1ff';c.lineWidth=1.2;
    c.beginPath();c.arc(sp[0],sp[1],9,0,7);c.moveTo(sp[0]-14,sp[1]);c.lineTo(sp[0]+14,sp[1]);c.moveTo(sp[0],sp[1]-8);c.lineTo(sp[0],sp[1]+8);c.stroke();
    c.save();c.shadowColor=col;c.shadowBlur=14;c.lineCap='round';
    const kk=pts.kink,kc=k=>k[0]==='p'?pcol[+k.slice(1)]:k==='opp'?REDIR:(V.hud?'#9fb4c8':muted);
    const segCol=i=>{let m=pts.marks[0];pts.marks.forEach(x=>{if(x.i<i)m=x;});return m.i===kk?REDIR:kc(m.kind);};
    for(let i=1;i<=n;i++){const a=P(pts[i-1]),b=P(pts[i]);c.globalAlpha=.25+.75*(i/n);c.strokeStyle=segCol(i);c.shadowColor=c.strokeStyle;c.lineWidth=1+3*(i/n);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
    c.restore();c.globalAlpha=1;
    const fi=p*Lx,i0=Math.floor(fi),i1=Math.min(Lx,i0+1),tt=fi-i0,hp=[0,1,2].map(d=>pts[i0][d]*(1-tt)+pts[i1][d]*tt),h=P(hp),fl=P([hp[0],hp[1],0]);
    c.setLineDash([2,3]);c.strokeStyle='rgba(95,225,255,.6)';c.beginPath();c.moveTo(h[0],h[1]);c.lineTo(fl[0],fl[1]);c.stroke();c.setLineDash([]);
    c.strokeStyle='rgba(95,225,255,.7)';c.beginPath();c.ellipse(fl[0],fl[1],7,3,0,0,7);c.stroke();
    if(!inA){c.save();c.shadowColor='#5fe1ff';c.shadowBlur=18;ball(h[0],h[1],Math.max(4,F*92/h[2]*.75),col);c.restore();}
    // Each touch: a ring and the player's name once the ball has reached it.
    pts.marks.forEach((m,mi)=>{if(m.i===kk||p*Lx<m.i-0.01)return;const q=P(pts[m.i]),cc=kc(m.kind);c.strokeStyle=cc;c.lineWidth=1.3;c.beginPath();c.arc(q[0],q[1],5,0,7);c.stroke();
      if(pts.marks.length>1||V.hud){c.font='bold 10px '+(tok('--mono')||'monospace');c.textAlign='left';c.fillStyle=cc;c.fillText(`${mi+1} · ${(PLAYERS.find(x=>x.name===m.name)?.short||m.name||'?').toUpperCase()}`,q[0]+8,q[1]-8);}});
    if(kk!=null&&!inA&&p*Lx>=kk){
      // Redirect: a diamond and a pulse where the other team touched it, with their name.
      const q=P(pts[kk]),age=Math.min(1,(p*Lx-kk)/8),rr=6+age*14;c.strokeStyle=REDIR;c.lineWidth=1.6;
      c.beginPath();c.moveTo(q[0],q[1]-7);c.lineTo(q[0]+7,q[1]);c.lineTo(q[0],q[1]+7);c.lineTo(q[0]-7,q[1]);c.closePath();c.stroke();
      c.globalAlpha=1-age;c.beginPath();c.arc(q[0],q[1],rr,0,7);c.stroke();c.globalAlpha=1;
      c.font='bold 10px '+(tok('--mono')||'monospace');c.textAlign='left';c.fillStyle=REDIR;
      c.fillText((kk===0?'REDIRECTED BY ':'REDIRECT · ')+String(g.defl||pts.marks[pts.marks.length-1].name).toUpperCase(),q[0]+10,q[1]-8);
    }
    if(!inA&&p>=1){const e=P(pts[Lx]),q=(el-dur)/900;c.strokeStyle=col;c.globalAlpha=1-q;c.lineWidth=2;c.beginPath();c.arc(e[0],e[1],6+q*28,0,7);c.stroke();c.globalAlpha=1;}
    if(V.hud){
      const kmh=g.spd,d=Math.hypot(g.ix-g.x,5120-g.y)/100,lbl=g.who>=0?PLAYERS[g.who].short.toUpperCase():(V.side==='us'?'US':'OPPONENT');
      const rows=[[`GOAL`,lbl],...(g.assister?[['ASSIST',(PLAYERS.find(q=>q.name===g.assister)?.short||g.assister).toUpperCase()]]:[]),...(g.defl?[['REDIRECT',g.defl.toUpperCase()]]:[]),['SPEED',kmh!=null?fSpd(kmh).toUpperCase():'—'],['RANGE',fLen(d).toUpperCase()],['IMPACT H',IMP()?(g.iz/100*3.28084).toFixed(1)+' FT':(g.iz/100).toFixed(2)+' M'],['T',(Math.min(el,dur)/1000).toFixed(2)+' S']];
      c.textAlign='left';c.font='10px '+(tok('--mono')||'monospace');
      rows.forEach(([k,v],i)=>{c.fillStyle='rgba(95,225,255,.6)';c.fillText(k,12,20+i*14);c.fillStyle='#d8f6ff';c.fillText(v,78,20+i*14);});
      c.strokeStyle='rgba(95,225,255,.7)';c.lineWidth=1.5;const br=(x,y,dx,dy)=>{c.beginPath();c.moveTo(x+dx*12,y);c.lineTo(x,y);c.lineTo(x,y+dy*12);c.stroke();};
      br(4,4,1,1);br(W-4,4,-1,1);br(4,H-4,1,-1);br(W-4,H-4,-1,-1);
      c.fillStyle='rgba(95,225,255,.07)';const sy=(performance.now()/12)%H;c.fillRect(0,sy,W,2);
      c.textAlign='right';c.fillStyle='rgba(95,225,255,.6)';c.fillText(fmtDate(g.m.when)+' · '+g.m.us+'–'+g.m.them+(g.m.win?' W':' L'),W-12,H-10);
    }
  }
}
function draw3D(){const cv=$('map3d');if(!cv)return;
  render3D(cv,{goals:G3.goals,side:G3.side,T:G3.T,D:11500,F:Math.min(cv.clientWidth,cv.clientHeight*1.6)*1.45*G3.zoom,yaw:G3.yaw,pitch:G3.pitch,focus:G3.focus,ft:G3.ft});
  $('map3dNote').textContent=G3.goals.length?`${G3.goals.length} goals with a shot and net position. Drag or use the knob to turn it, arrow keys to move, scroll to zoom. Hover a ball on the flat maps for a replay.`:'No goals with positions in this period.';
  syncKnob();
}
// The knob: its ring turns with the camera (N = looking at the attacked goal), the needle shows tilt.
function syncKnob(){const r=$('knobRing');if(!r)return;r.setAttribute('transform',`rotate(${(-G3.yaw*180/Math.PI).toFixed(1)} 50 50)`);
  const t=$('knobTilt');if(t)t.setAttribute('y2',(50-30*Math.sin(G3.pitch)).toFixed(1));}
function nudge3D(f){G3.auto=false;f();G3.pitch=Math.max(.05,Math.min(1.45,G3.pitch));G3.zoom=Math.max(.6,Math.min(3,G3.zoom));
  G3.T[0]=Math.max(-4096,Math.min(4096,G3.T[0]));G3.T[1]=Math.max(-5120,Math.min(6000,G3.T[1]));draw3D();}
function drawReplay(){
  const cv=$('replayCv'),g=G3.goals.find(x=>x.k===RP.k);if(!g)return;
  const wp=waypoints(g),xs=[g.ix].concat(wp.map(t=>t.p[0])),ys=[5120].concat(wp.map(t=>t.p[1]));
  const mid=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,300],dx=g.ix-g.x,dy=5120-g.y,span=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))+1800;
  const yaw=Math.atan2(dx,dy)+0.75+Math.sin((performance.now()-RP.t)/2500)*.12;
  render3D(cv,{hud:true,goals:[g],side:G3.side,T:mid,D:span*1.25,F:cv.clientWidth*1.05,yaw,pitch:.38,focus:g.k,ft:RP.t});
}
function showReplay(k,ev){
  if(!G3.goals.some(x=>x.k===+k))return;
  if(RP.k===+k){placeReplay(ev);return;}
  RP.k=+k;RP.t=performance.now();G3.focus=+k;G3.ft=RP.t;
  const r=$('replay');r.hidden=false;placeReplay(ev);loop3D();
}
function placeReplay(ev){const r=$('replay'),w=r.offsetWidth,h=r.offsetHeight;let x=ev.clientX+18,y=ev.clientY+18;
  if(x+w>innerWidth-8)x=ev.clientX-w-18;if(y+h>innerHeight-8)y=ev.clientY-h-18;r.style.left=Math.max(8,x)+'px';r.style.top=Math.max(8,y)+'px';}
function hideReplay(){RP.k=null;G3.focus=null;$('replay').hidden=true;draw3D();}
let looping=false;
function loop3D(){if(looping)return;looping=true;const step=()=>{if(RP.k==null&&!G3.auto){looping=false;return;}
  if(RP.k!=null)drawReplay();if(G3.seen&&document.visibilityState==='visible')draw3D();requestAnimationFrame(step);};requestAnimationFrame(step);}
(function(){
  const cv=$('map3d');if(!cv)return;let drag=null;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)G3.auto=false;
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw:G3.yaw,pitch:G3.pitch};G3.auto=false;cv.setPointerCapture(e.pointerId);});
  cv.addEventListener('pointermove',e=>{if(!drag)return;G3.yaw=drag.yaw-(e.clientX-drag.x)*.008;G3.pitch=Math.max(.05,Math.min(1.45,drag.pitch+(e.clientY-drag.y)*.006));draw3D();});
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{drag=null;}));
  cv.addEventListener('wheel',e=>{e.preventDefault();G3.auto=false;G3.zoom=Math.max(.6,Math.min(3,G3.zoom*Math.exp(-e.deltaY*.0015)));draw3D();},{passive:false});
  $('map3dReset').addEventListener('click',()=>{G3.yaw=-.5;G3.pitch=.42;G3.zoom=1;G3.T=[0,3300,300];draw3D();});
  // Arrow keys move the point the camera looks at, relative to where it's facing (Shift: faster).
  // The canvas takes focus on click or hover so the page doesn't scroll instead.
  cv.tabIndex=0;cv.addEventListener('pointerenter',()=>cv.focus({preventScroll:true}));
  cv.addEventListener('keydown',e=>{const st=e.shiftKey?900:300,fw=[Math.sin(G3.yaw),Math.cos(G3.yaw)],rt=[fw[1],-fw[0]];
    const mv={ArrowUp:[fw,1],ArrowDown:[fw,-1],ArrowRight:[rt,1],ArrowLeft:[rt,-1]}[e.key];
    if(mv){e.preventDefault();nudge3D(()=>{G3.T[0]+=mv[0][0]*mv[1]*st;G3.T[1]+=mv[0][1]*mv[1]*st;});return;}
    if(e.key==='+'||e.key==='='){e.preventDefault();nudge3D(()=>G3.zoom*=1.15);}
    if(e.key==='-'||e.key==='_'){e.preventDefault();nudge3D(()=>G3.zoom/=1.15);}});
  // Knob: drag the ring to orbit; buttons tilt and zoom.
  const kn=$('knob');let kd=null;const ang=e=>{const r=kn.getBoundingClientRect();return Math.atan2(e.clientX-(r.left+r.width/2),-(e.clientY-(r.top+r.height/2)));};
  kn.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;kd={a:ang(e),yaw:G3.yaw};kn.setPointerCapture(e.pointerId);G3.auto=false;});
  kn.addEventListener('pointermove',e=>{if(!kd)return;G3.yaw=kd.yaw-(ang(e)-kd.a);draw3D();});
  ['pointerup','pointercancel'].forEach(t=>kn.addEventListener(t,()=>{kd=null;}));
  const hold=(id,f)=>{let tm=null;const go=()=>{nudge3D(f);tm=setTimeout(go,90);};const stop=()=>{clearTimeout(tm);tm=null;};
    $(id).addEventListener('pointerdown',e=>{e.preventDefault();go();});['pointerup','pointerleave','pointercancel'].forEach(t=>$(id).addEventListener(t,stop));};
  hold('kTiltUp',()=>G3.pitch+=.06);hold('kTiltDn',()=>G3.pitch-=.06);hold('kRotL',()=>G3.yaw+=.08);hold('kRotR',()=>G3.yaw-=.08);
  hold('kZoomIn',()=>G3.zoom*=1.06);hold('kZoomOut',()=>G3.zoom/=1.06);
  window.addEventListener('resize',()=>draw3D());
  G3.seen=false;new IntersectionObserver(es=>{G3.seen=es[0].isIntersecting;if(G3.seen&&G3.auto)loop3D();}).observe(cv);
  // Slow sway until someone grabs it.
  const sway=t=>{if(!G3.auto)return;G3.yaw=-.5+Math.sin((t-G3.t0)/6000)*.6;requestAnimationFrame(sway);};
  requestAnimationFrame(sway);
})();

// ---------- playstyle ----------
function renderPlay(list){
  const A=agg(list),f=(v,d=0,u='')=>v==null?'–':v.toFixed(d)+u;
  $('split').innerHTML='<div class="split-row"><span></span><div class="legend"><span><i style="background:var(--ink-2)"></i>Ground</span><span><i style="background:var(--muted)"></i>Wall</span><span><i style="background:var(--p1)"></i>Air</span></div></div>'+
    PLAYERS.map((p,j)=>{const a=A[j];if(a.ground==null)return `<div class="split-row"><span class="tag ${p.tag}" style="padding:1px 8px"><i></i>${esc(p.short)}</span><span class="note">No movement data yet</span></div>`;
      return `<div class="split-row"><span class="tag ${p.tag}" style="padding:1px 8px"><i></i>${esc(p.short)}</span><div class="stack" title="Ground ${f(a.ground)}%, wall ${f(a.wall)}%, air ${f(a.air)}%">
      <div style="width:${a.ground}%;background:var(--ink-2)">${f(a.ground)}%</div><div style="width:${a.wall}%;background:var(--muted)">${f(a.wall)}%</div><div style="width:${a.air}%;background:${p.color}">${f(a.air)}%</div></div></div>`;}).join('');
  const rows=[['Hat tricks',a=>a.games?String(a.hat):'–'],['Win % with a hat trick',a=>a.hat?`<span title="${a.hatWins} won of ${a.hat}">${Math.round(100*a.hatWins/a.hat)}%</span>`:'–'],['Kickoff goals',a=>a.games?String(a.kickoff):'–'],['Counter goals',a=>a.timed?String(a.saveGoals):'–'],
    ...[1,2,3,4,5].map((n,i)=>[`Win % scoring ${n}${n<5?'':'+'} goal${n>1?'s':''}`,a=>{const b=a.byGoals&&a.byGoals[i];return b&&b.n?`<span title="${b.w} won of ${b.n}">${Math.round(100*b.w/b.n)}%</span> <small class="muted">${b.n}</small>`:'–';}]),['Avg speed',a=>fSpd(a.speed)],['Top speed',a=>fSpd(a.topSpeed)],['Distance driven',a=>fDist(a.dist,a.dist>=100?0:1)],['Distance / game',a=>a.dist==null?'–':fDist(a.dist/a.distGames,2)],['Avg boost held',a=>f(a.boost)],['Time supersonic',a=>f(a.ss,1,'%')],['Avg goal speed',a=>fSpd(a.gsAvg)],['Hardest goal',a=>fSpd(a.gsMax)],['Hardest hit',a=>fSpd(a.hardest)],['Bumps / game',a=>f(a.bumps,1)],['Boost pads / game',a=>f(a.pickups,1)],['Main car',a=>a.car?esc(a.car):'–'],['I Got No Boost',a=>a.noBoost==null?'–':`<span title="${fmtDur(a.noBoost/a.noBoostGames)} a game">${fmtDur(a.noBoost)}</span>`]];
  const koFor=list.reduce((s,m)=>s+m.ourGoals.filter(g=>g.ko).length,0),koAgainst=list.reduce((s,m)=>s+m.theirGoals.filter(g=>g.ko).length,0);
  const pct=ms=>ms.length?`<span title="${ms.filter(m=>m.win).length} won of ${ms.length}">${Math.round(100*ms.filter(m=>m.win).length/ms.length)}%</span> <small class="muted">${ms.length} games</small>`:'–';
  const teamRows=[['Win % when we score first',pct(list.filter(m=>m.first==='us'))],['Win % when they score first',pct(list.filter(m=>m.first==='them'))],
    ['Kickoff goals for',String(koFor)],['Kickoff goals against',String(koAgainst)],
    ...[1,2,3,4].map(n=>{const down=list.filter(m=>n<4?m.deficit===n:m.deficit>=4),won=down.filter(m=>m.win).length;
      return [`Comebacks from ${n}${n<4?'':'+'} goal${n>1?'s':''} down`,down.length?`<span title="Won ${won} of ${down.length} games where the biggest deficit was ${n}${n<4?'':' or more'}">${won}</span> <small class="muted">of ${down.length}</small>`:'0'];}),
    ...[1,2,3,4].map(n=>{const up=list.filter(m=>n<4?m.lead===n:m.lead>=4),lost=up.filter(m=>!m.win).length;
      return [`Blown ${n}${n<4?'':'+'} goal lead${n>1?'s':''}`,up.length?`<span title="Lost ${lost} of ${up.length} games where the biggest lead was ${n}${n<4?'':' or more'}">${lost}</span> <small class="muted">of ${up.length}</small>`:'0'];})];
  $('teamKv').innerHTML=list.length?'<div class="h">Team</div><div class="h v"></div>'+teamRows.map(r=>`<div>${r[0]}</div><div class="v">${r[1]}</div>`).join(''):'';
  $('koNote').textContent=list.length?`A kickoff goal is scored within about ${KICKOFF_SECS}s of play after the kickoff. A counter goal is scored within ${COUNTER_SECS}s of play after a save by the scoring team, in matches recorded since saves were timed.`:'';
  $('playKv').innerHTML='<div class="h">Stat</div>'+PLAYERS.map(p=>`<div class="h v">${esc(p.short)}</div>`).join('')+rows.map(r=>`<div>${r[0]}</div>`+A.map(a=>`<div class="v">${r[1](a)}</div>`).join('')).join('');
  renderGarage(A);
}

// ---------- car blueprints ----------
// Hand-drawn side profiles (not game art), facing right, ground at y=96. x0/x1/top are the body's
// extent for the dimension lines; hb is the in-game hitbox the body uses (length, width, height in uu).
const HITBOX={Octane:[118.0,84.2,36.2],Dominus:[127.9,83.3,31.3]};
const CAR_ART={
  Fennec:{hb:'Octane',x0:34,x1:226,top:33,wheels:[[66,80,16],[186,80,16]],
    body:'M36 80 L34 60 L40 44 L58 34 L150 33 L172 50 L218 55 Q226 57 226 66 L224 80 L206 80 A20 20 0 0 0 166 80 L86 80 A20 20 0 0 0 46 80 Z',
    lines:'M50 52 L60 39 L146 38 L164 52 Z M104 38 L104 52 L102 76 M164 52 L164 76 M58 34 L32 32 L34 38 L42 42 M86 77 L166 77 M178 53 L198 55 M214 60 L225 62 M34 50 L40 50 L40 56'},
  Octane:{hb:'Octane',x0:30,x1:228,top:23,wheels:[[70,78,18],[184,81,15]],
    body:'M36 80 C30 66 34 52 48 46 C64 38 76 26 104 24 C132 22 146 34 158 46 L206 52 C222 54 228 62 226 74 L222 80 L203 80 A19 19 0 0 0 165 80 L92 80 A22 22 0 0 0 48 80 Z',
    lines:'M66 46 C76 34 90 30 106 30 C126 30 138 38 148 47 Z M114 30 L114 47 L112 76 M92 77 L165 77 M214 58 L225 62 M34 60 L42 58 M30 76 L38 76'},
  Dominus:{hb:'Dominus',x0:26,x1:236,top:36,wheels:[[68,80,16],[196,80,16]],
    body:'M30 80 L28 62 L34 56 L80 52 C96 40 104 36 124 36 L146 36 C158 38 168 46 176 52 L230 58 Q236 60 236 70 L234 80 L216 80 A20 20 0 0 0 176 80 L88 80 A20 20 0 0 0 48 80 Z',
    lines:'M92 52 C102 42 110 40 124 40 L144 40 C154 42 160 47 166 52 Z M132 40 L132 52 L130 76 M88 77 L176 77 M28 56 L26 49 L46 49 L42 55 M226 62 L236 64 M186 56 L214 58'}
};
function carBlueprint(car,color){
  const c=CAR_ART[car];if(!c)return '';
  const [L,,H]=HITBOX[c.hb],R=c.x1+12,dim='stroke="var(--muted)" stroke-width=".8"';
  const wheels=c.wheels.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y}" r="${r*.6}"/><circle cx="${x}" cy="${y}" r="2.5"/>`+
    `<path d="M${x} ${y-r-4}V${y+r+4}M${x-r-4} ${y}H${x+r+4}" ${dim} stroke-dasharray="4 2 1 2"/>`).join('');
  return `<svg class="bp" viewBox="0 0 270 124" role="img" aria-label="Side view line drawing of the ${esc(car)}">
  <path d="M8 96H262" ${dim} stroke-dasharray="6 3"/>
  <g fill="none" stroke="var(--ink-2)" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">
    <path d="${c.lines}"/>${wheels}
  </g>
  <path d="${c.body}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
  <g ${dim} fill="none">
    <path d="M${c.x0} 100V114M${c.x1} 100V114M${c.x0} 110H${c.x1}M${c.x0-3} 113l6-6M${c.x1-3} 113l6-6"/>
    <path d="M${c.x1+4} 96H${R+4}M${c.x1+4-30} ${c.top}H${R+4}M${R} 96V${c.top}M${R-3} ${c.top+3}l6-6M${R-3} 99l6-6"/>
  </g>
  <g fill="var(--muted)" font-family="var(--mono)" font-size="8">
    <text x="${(c.x0+c.x1)/2}" y="107" text-anchor="middle">L ${L.toFixed(1)}</text>
    <text transform="translate(${R+9} ${(96+c.top)/2}) rotate(-90)" text-anchor="middle">H ${H.toFixed(1)}</text>
  </g>
</svg>`;
}
function renderGarage(A){
  $('garage').innerHTML=PLAYERS.map((p,j)=>{const car=A[j].car;if(!car)return '';
    const art=CAR_ART[car],hb=art&&HITBOX[art.hb];
    return `<figure class="car-card"><figcaption><span class="tag p${j+1}" style="padding:1px 8px"><i></i>${esc(p.short)}</span><b>${esc(car)}</b>`+
      (art?`<span class="muted">${art.hb} hitbox</span>`:'')+`</figcaption>`+
      (art?carBlueprint(car,p.color)+`<div class="car-dims num">L ${hb[0].toFixed(1)} · W ${hb[1].toFixed(1)} · H ${hb[2].toFixed(1)} uu</div>`
          :`<div class="note">No drawing for the ${esc(car)} yet.</div>`)+`</figure>`;}).join('');
}

// ---------- all-time records ----------
// Best single game or goal per player, across every playlist and the whole history.
function renderRecords(){
  const ms=DONE;
  const best=(j,val)=>{let b=null;ms.forEach(m=>{const v=val(m,j);if(v!=null&&(!b||v>b.v))b={v,m};});return b;};
  const goalBest=(j,val)=>{let b=null;ms.forEach(m=>m.ourGoals.filter(g=>g.who===j).forEach(g=>{const v=val(g);if(v!=null&&(!b||v>b.v))b={v,m};}));return b;};
  const line=k=>(m,j)=>m.lines[j]?m.lines[j][k]:null;
  const recs=[
    ['Longest goal',j=>goalBest(j,g=>g.x!=null&&g.y!=null?Math.hypot(g.x,5120-g.y)/100:null),v=>fLen(v)],
    ['Hardest goal',j=>goalBest(j,g=>g.spd),v=>fSpd(v)],
    ['Hardest hit',j=>best(j,line('hardest')),v=>fSpd(v)],
    ['Top speed',j=>best(j,line('topSpeed')),v=>fSpd(v)],
    ['Most goals',j=>best(j,line('goals')),v=>v],
    ['Most assists',j=>best(j,line('assists')),v=>v],
    ['Most saves',j=>best(j,line('saves')),v=>v],
    ['Most shots',j=>best(j,line('shots')),v=>v],
    ['Most demos',j=>best(j,line('demos')),v=>v],
    ['Most bumps',j=>best(j,line('bumps')),v=>v],
    ['Highest score',j=>best(j,line('score')),v=>v]];
  const cell=(rs,j,fmt)=>{const r=rs[j];return !r||!r.v?'<div class="v">–</div>':
    `<div class="v${leads(rs.map(x=>x&&x.v),j)?' best':''}" title="${esc(r.m.arena)}, ${r.m.us}–${r.m.them} ${r.m.win?'win':'loss'}">${fmt(r.v)}<small>${fmtDate(r.m.when)}</small></div>`;};
  $('recKv').innerHTML='<div class="h">Record</div>'+PLAYERS.map(p=>`<div class="h v">${esc(p.short)}</div>`).join('')+
    recs.map(([name,get,fmt])=>{const rs=PLAYERS.map((p,j)=>get(j));return `<div>${name}</div>`+rs.map((r,j)=>cell(rs,j,fmt)).join('');}).join('');
}

// Seconds as 45s, 12m 05s or 3h 04m.
function fmtDur(s){s=Math.round(s);if(s<60)return s+'s';const m=Math.floor(s/60);if(m<60)return m+'m '+String(s%60).padStart(2,'0')+'s';return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m';}

// ---------- crowd & drinks ----------
// Only matches saved by a widget that has the Watching row count here; older ones have no answer.
function crowdRow(label,sub,l){
  const w=l.filter(m=>m.win).length,pct=l.length?100*w/l.length:null;
  const sc=PLAYERS.map((p,j)=>{const v=l.map(m=>m.lines[j]).filter(Boolean);return v.length?p.short+' '+Math.round(v.reduce((a,x)=>a+x.score,0)/v.length):null;}).filter(Boolean).join(' · ');
  return `<div class="warm-row"><span class="warm-label">${esc(label)}<small>${esc(sub||sc||'No games')}</small></span>
    <div class="bar"><div class="track"><div class="fill" style="width:${pct==null?0:pct.toFixed(1)}%;background:${pct==null?'transparent':pct>=50?'var(--win)':'var(--loss)'}"></div></div>
    <span class="val">${pct==null?'–':Math.round(pct)+'%'}</span></div><span class="warm-rec num">${l.length?w+'–'+(l.length-w):''}</span></div>`;
}
function renderCrowd(list){
  const seen=list.filter(m=>m.spectators);
  const names=[...new Set([...SPECTATORS,...seen.flatMap(m=>m.spectators)])];
  $('crowdRows').innerHTML=seen.length
    ?names.map(n=>{const l=seen.filter(m=>m.spectators.includes(n));return crowdRow(n+' watching',l.length?null:'Not yet',l);}).join('')+
      crowdRow('Nobody watching',null,seen.filter(m=>!m.spectators.length))
    :'<p class="note">No games recorded with the Watching row yet. Tick who is watching on the widget and it fills in from the next match.</p>';
  const dk=list.filter(m=>m.drinks!=null);
  const B=[[0,0,'Sober'],[1,2,'1–2 drinks'],[3,4,'3–4 drinks'],[5,6,'5–6 drinks'],[7,99,'7+ drinks']];
  $('drinkRows').innerHTML=dk.length
    ?B.map(([a,b,label])=>{const l=dk.filter(m=>m.drinks>=a&&m.drinks<=b);
      const j=l.map(m=>m.lines[0]).filter(Boolean);
      const sub=j.length?`${PLAYERS[0].short} ${Math.round(j.reduce((s,x)=>s+x.score,0)/j.length)} · ${(j.reduce((s,x)=>s+x.goals,0)/j.length).toFixed(2)} goals`:'No games';
      return crowdRow(label,sub,l);}).join('')
    :`<p class="note">No drinks logged yet. Use + on ${esc(PLAYERS[0].short)}'s widget as the night goes on.</p>`;
}

// ---------- comebacks & leads ----------
// Margins move one goal at a time, so being down 3 at some point means passing through down 1 and 2.
function renderSwing(list){
  const l=list.filter(m=>m.swing);
  const row=n=>{const g=l.filter(m=>n<0?m.swing.lo<=n:m.swing.hi>=n),a=Math.abs(n);
    return crowdRow((n<0?'Down ':'Up ')+a+(a>1?' goals':' goal'),g.length+(g.length===1?' game':' games'),g);};
  $('behindRows').innerHTML=[-3,-2,-1].map(row).join('');
  $('aheadRows').innerHTML=[1,2,3].map(row).join('');
}

// ---------- match log ----------
// Opponent ranks aren't in the game's data, so link each opponent to their tracker.gg profile.
// PrimaryId looks like "Epic|<id>|0" or "Steam|<steamid>|0"; Steam profiles go by id, the rest by name.
function trackerUrl(p){
  const [plat,id]=String(p.primary_id||'').split('|'),k=(plat||'').toLowerCase();
  const base='https://rocketleague.tracker.network/rocket-league/profile/';
  const by=(seg,v)=>base+seg+'/'+encodeURIComponent(v)+'/overview';
  if(k==='steam'&&id&&id!=='0')return by('steam',id);
  if(k.startsWith('ps'))return by('psn',p.name);
  if(k.startsWith('xbox'))return by('xbl',p.name);
  if(k==='switch')return by('switch',p.name);
  return by('epic',p.name);
}
function renderLog(list){
  const rows=[...list].reverse().slice(0,15);
  $('logCount').textContent=list.length?'Latest '+rows.length+' of '+list.length:'';
  const line=L=>L?`${L.goals}·${L.assists}·${L.saves}`:'–';
  $('matchLog').innerHTML=`<thead><tr><th>When</th><th>Result</th><th>Score</th><th>Arena</th>`+PLAYERS.map(p=>`<th>${esc(p.short)} G·A·Sv</th>`).join('')+`<th>Top score</th><th>Opponents</th><th>Notes</th></tr></thead><tbody>`+
    rows.map(m=>{const L=m.lines;const top=L.reduce((b,l,j)=>l&&(b<0||l.score>L[b].score)?j:b,-1);
      return `<tr><td><a href="#m-${esc(m.guid)}" class="mlink" title="Open this match">${fmtDate(m.when)} ${fmtTime(m.when)}</a></td><td><span class="pill ${m.win?'w':'l'}">${m.win?'W':'L'}</span></td><td>${m.us}–${m.them}${m.ot?' <span class="muted">OT</span>':''}</td><td>${esc(m.arena)}</td>${L.map(l=>`<td>${line(l)}</td>`).join('')}<td>${top<0?'–':`<span class="tag ${PLAYERS[top].tag}" style="padding:0 7px"><i></i>${esc(PLAYERS[top].short)} ${L[top].score}</span>`}</td><td class="opps">${m.opps.length?m.opps.map(o=>`<a href="${esc(o.url)}" target="_blank" rel="noopener" title="View ${esc(o.name)} on tracker.gg">${esc(o.name)}</a>`).join('<br>'):'–'}</td><td class="notes">${notes(m)}</td></tr>`;}).join('')+'</tbody>';
}

function notes(m){
  const out=[];
  if(m.ff)out.push(`<span class="chip" title="Ended early: ${m.win?'they':'we'} forfeited or quit">${m.win?'They forfeited':'Forfeit'}</span>`);
  if(m.replay)out.push('<span class="chip">Replay</span>');
  const us=m.left.filter(x=>x.ours).length,them=m.left.length-us;
  if(them)out.push(`<span class="chip" title="${esc(m.left.filter(x=>!x.ours).map(x=>x.name).join(', '))}">Opponent quit</span>`);
  if(us)out.push(`<span class="chip" title="${esc(m.left.filter(x=>x.ours).map(x=>x.name).join(', '))}">Teammate quit</span>`);
  return out.join(' ')||'<span class="muted">–</span>';
}

// ---------- wiring ----------
function syncButtons(){
  document.querySelectorAll('#period button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===period));
  document.querySelectorAll('#mode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===mode));
  document.querySelectorAll('#metric button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===metric));
}
function renderPeriod(){renderRecords();const list=inPeriod();renderSummary(list);renderCmp(list);renderMaps(list);renderPlay(list);renderCrowd(list);renderSwing(list);renderLog(list);syncButtons();}
// ---------- warm-ups ----------
// A night is every match with gaps under 90 minutes. Its warm-ups are the Casual Doubles games
// played before the first Ranked Doubles game; the ranked games that night are what follows.
function nights(){
  const out=[];
  DONE.forEach(m=>{const n=out[out.length-1];
    if(n&&m.when-n.end<90*6e4){n.matches.push(m);n.end=new Date(m.when.getTime()+m.dur*1000);}
    else out.push({start:m.when,end:new Date(m.when.getTime()+m.dur*1000),matches:[m]});});
  return out.map(n=>{
    const first=n.matches.findIndex(m=>m.playlist===RANKED);
    return {...n,warm:n.matches.filter((m,i)=>m.playlist===WARM&&(first<0||i<first)),ranked:n.matches.filter(m=>m.playlist===RANKED)};
  });
}
function renderWarmups(){
  const N=nights().filter(n=>n.ranked.length);
  const wl=l=>{const w=l.filter(m=>m.win).length;return {w,l:l.length-w,n:l.length};};
  const groups=[
    {k:'won',label:'Won the warm-ups',test:r=>r.n&&r.w>r.l},
    {k:'even',label:'Split the warm-ups',test:r=>r.n&&r.w===r.l},
    {k:'lost',label:'Lost the warm-ups',test:r=>r.n&&r.w<r.l},
    {k:'none',label:'No warm-up',test:r=>!r.n}
  ].map(g=>{const ns=N.filter(n=>g.test(wl(n.warm)));const r=wl(ns.flatMap(n=>n.ranked));return {...g,nights:ns.length,...r,pct:r.n?100*r.w/r.n:null};});
  $('warmRows').innerHTML=groups.map(g=>`<div class="warm-row"><span class="warm-label">${g.label}<small>${g.nights} night${g.nights===1?'':'s'}</small></span>
    <div class="bar"><div class="track"><div class="fill" style="width:${g.pct==null?0:g.pct.toFixed(1)}%;background:${g.pct==null?'transparent':g.pct>=50?'var(--win)':'var(--loss)'}"></div></div>
    <span class="val">${g.pct==null?'–':Math.round(g.pct)+'%'}</span></div><span class="warm-rec num">${g.n?g.w+'–'+g.l:''}</span></div>`).join('');
  const won=groups[0],lost=groups[2];
  $('warmTake').textContent=won.nights>=3&&lost.nights>=3
    ?`After winning the warm-ups you win ${Math.round(won.pct)}% of ranked games that night, and ${Math.round(lost.pct)}% after losing them.`
    :`Not enough nights yet to compare. This fills in after at least three nights of won and three of lost warm-ups (${won.nights} and ${lost.nights} so far).`;
  const recent=N.filter(n=>n.warm.length).slice(-8).reverse();
  $('warmLog').innerHTML='<thead><tr><th>Night</th><th>Warm-ups</th><th>Ranked after</th><th>MMR</th></tr></thead><tbody>'+
    (recent.length?recent.map(n=>{const a=wl(n.warm),b=wl(n.ranked);
      const d=PLAYERS.map((p,j)=>{const x=mmrAt(j,n.start.getTime()),y=mmrAt(j,n.end.getTime()+30*6e4);return x!=null&&y!=null?p.short+' '+sign(y-x):null;}).filter(Boolean).join(', ');
      return `<tr><td>${fmtDay(n.start)}</td><td><span class="pill ${a.w>a.l?'w':a.w<a.l?'l':''}">${a.w}–${a.l}</span></td><td><span class="pill ${b.w>b.l?'w':b.w<b.l?'l':''}">${b.w}–${b.l}</span></td><td>${esc(d||'–')}</td></tr>`;}).join('')
    :'<tr><td colspan="4" class="muted">No nights with warm-ups and ranked games yet.</td></tr>')+'</tbody>';
}

function renderAll(){
  build();
  if(!ALL.length){$('banner').hidden=false;$('banner').textContent='No finished matches for this playlist yet.';return;}
  renderPeriod();renderLastSession();renderStrip();renderTrend();renderMMR();renderWarmups();
}
$('units').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;units=b.dataset.u;saveUi();syncUnits();renderAll();});
function syncUnits(){$('units').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.u===units)));}
syncUnits();
$('period').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;period=b.dataset.p;saveUi();renderPeriod();});
$('mode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;mode=b.dataset.m;saveUi();renderCmp(inPeriod());syncButtons();});
$('metric').innerHTML=METRICS.map(m=>`<button type="button" data-k="${m.k}">${m.label}</button>`).join('');
$('metric').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;metric=b.dataset.k;saveUi();syncButtons();renderTrend();});
$('playlist').addEventListener('change',e=>{playlist=e.target.value;saveUi();renderAll();});
$('mapSide').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;mapSide=b.dataset.s;document.querySelectorAll('#mapSide button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderMaps(inPeriod());});
$('mapWho').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;mapWho=b.dataset.w;document.querySelectorAll('#mapWho button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderMaps(inPeriod());});

$('mmrForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const v=parseInt($('mmrVal').value,10),who=+$('mmrWho').value;
  if(!(v>0&&v<3000)){$('mmrNote').textContent='Enter an MMR between 1 and 2999.';return;}
  const row={player:PLAYERS[who].name,playlist:mmrPlaylist(),mmr:v};
  if(SAMPLE){RAW.mmr.push({...row,logged_at:new Date(NOW).toISOString()});$('mmrNote').textContent=`Added ${v} for ${PLAYERS[who].name} to the sample data (not saved).`;}
  else{
    try{const r=await fetch('/api/mmr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)});
      if(!r.ok)throw new Error((await r.json()).error||r.status);
      RAW.mmr.push({...row,logged_at:new Date().toISOString()});$('mmrNote').textContent=`Saved ${v} for ${PLAYERS[who].name}: ${rankOf(v)}.`;}
    catch(err){$('mmrNote').textContent='Could not save: '+err.message;return;}
  }
  $('mmrVal').value='';renderMMR();renderSummary(inPeriod());
});

function parseCsv(text){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}
    else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;}
  if(cell||row.length){row.push(cell);rows.push(row);}
  const head=(rows.shift()||[]).map(h=>h.replace(/^﻿/,'').trim());
  return rows.filter(r=>r.length>1).map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]])));
}
$('importForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const files=[...$('importFiles').files];if(!files.length){$('importNote').textContent='Choose matches.jsonl and/or mmr.csv first.';return;}
  if(SAMPLE&&location.protocol==='file:'){return;}
  const body={matches:[],mmr:[]};let bad=0;
  for(const f of files){
    const text=(await f.text()).replace(/^﻿/,'');
    if(/\.csv$/i.test(f.name)){const rows=parseCsv(text);if(rows.length&&'mmr' in rows[0])body.mmr.push(...rows);else bad++;}
    else text.split(/\r?\n/).forEach(l=>{l=l.trim();if(!l)return;try{body.matches.push(JSON.parse(l));}catch(err){bad++;}});
  }
  $('importNote').textContent='Uploading…';
  try{const r=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);
    $('importNote').textContent=`Added ${j.matches} match record${j.matches===1?'':'s'} and ${j.mmr} MMR value${j.mmr===1?'':'s'}.`+(bad?` Skipped ${bad} line${bad>1?'s':''} that could not be read.`:'');
    await load();}
  catch(err){$('importNote').textContent='Upload failed: '+err.message;}
});

let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(ALL.length){renderTrend();renderMMR();}},150);});

async function load(){
  let data=null;
  try{const r=await fetch('/api/data',{cache:'no-store'});if(r.ok)data=await r.json();}catch(e){}
  // Never swap real stats for sample data because a request failed: keep what's on screen,
  // or on first load keep the loading screen up and retry.
  if(!data){
    if(document.body.classList.contains('is-loading')){$('loaderText').textContent='Can\'t reach the stats server yet. Retrying…';setTimeout(load,5000);}
    return;
  }
  // Up to four players, one fixed colour each (--p1 to --p4).
  const names=(data&&data.players&&data.players.length?data.players:['jay29ID','Kobra Kelvin']).slice(0,4);
  PLAYERS=names.map((n,j)=>({name:n,short:(s=>s?s[0].toUpperCase()+s.slice(1):n)(n.split(/\s+/)[0].replace(/\d+.*$/,'')),color:`var(--p${j+1})`,tag:'p'+(j+1)}));
  document.documentElement.style.setProperty('--n',PLAYERS.length);
  const shorts=PLAYERS.map(p=>p.short);
  $('title').textContent=shorts.length>1?shorts.slice(0,-1).join(', ')+' & '+shorts[shorts.length-1]:shorts[0];
  document.title=$('title').textContent+' Stats';
  $('playerTags').innerHTML=PLAYERS.map(p=>`<span class="tag ${p.tag}"><i></i>${esc(p.name)}</span>`).join('');
  $('drinkWho').textContent=`How many drinks ${PLAYERS[0].short} had`;
  const who=$('mmrWho').value;
  $('mmrWho').innerHTML=PLAYERS.map((p,j)=>`<option value="${j}">${esc(p.name)}</option>`).join('');
  if(who)$('mmrWho').value=who;
  if(mapWho!=='all'&&+mapWho>=PLAYERS.length)mapWho='all';
  $('mapWho').innerHTML=`<button type="button" data-w="all">${PLAYERS.length===2?'Both':'All'}</button>`+PLAYERS.map((p,j)=>`<button type="button" data-w="${j}">${esc(p.short)}</button>`).join('');
  document.querySelectorAll('#mapWho button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.w===mapWho));
  const real=data&&data.matches&&data.matches.some(r=>r&&(r.result==='Win'||r.result==='Loss'));
  SAMPLE=!real;
  RAW=real?{matches:data.matches,mmr:data.mmr||[]}:makeSample(names);
  if(real&&!RAW.mmr)RAW.mmr=[];
  $('dataBadge').hidden=!SAMPLE;
  $('banner').hidden=!SAMPLE;
  $('banner').textContent=SAMPLE?'No matches have been uploaded yet, so this shows sample data. It switches to your real stats as soon as the recorder sends the first finished match.':'';
  renderAll();
  const first=document.body.classList.contains('is-loading');
  document.body.classList.remove('is-loading');
  if(first)matchFromHash();
}
// ---------- match detail ----------
// Opened from the match log (or a #m-<guid> link): the whole scoreboard and goal-by-goal story.
function openMatch(guid){
  const m=DONE.find(x=>String(x.guid)===guid)||ALL.find(x=>String(x.guid)===guid);if(!m)return false;
  const L=m.lines,cols=[['Score','score',0],['Goals','goals',0],['Assists','assists',0],['Saves','saves',0],['Shots','shots',0],['Demos','demos',0],['Touches','touches',0]];
  const extra=[['Avg speed',l=>fSpd(l.speed)],['Top speed',l=>fSpd(l.topSpeed)],['Avg boost',l=>l.boost==null?'–':Math.round(l.boost)],['Supersonic',l=>l.ss==null?'–':l.ss.toFixed(1)+'%'],['Distance',l=>fDist(l.dist,2)],['Car',l=>l.car?esc(l.car):'–']];
  const head=`<tr><th></th>${PLAYERS.map((p,j)=>`<th class="v"><span class="tag p${j+1}" style="padding:0 7px"><i></i>${esc(p.short)}</span></th>`).join('')}</tr>`;
  const body=cols.map(([lab,k])=>`<tr><td>${lab}</td>${L.map(l=>`<td class="v">${l?l[k]:'–'}</td>`).join('')}</tr>`).join('')+
    extra.map(([lab,f])=>`<tr><td>${lab}</td>${L.map(l=>`<td class="v">${l?f(l):'–'}</td>`).join('')}</tr>`).join('');
  let a=0,b=0;
  const story=m.goals.map(g=>{g.ours?a++:b++;const who=g.who>=0?PLAYERS[g.who].short:g.ours?'Us':esc(g.scorer&&g.scorer!=='Opponent'?g.scorer:'Opponent');
    const as=g.assister?` <span class="muted">(assist ${esc(PLAYERS.find(p=>p.name===g.assister)?.short||g.assister)})</span>`:'';
    return `<li class="${g.ours?'us':'them'}"><b class="num">${a}–${b}</b> ${who}${as}${g.spd!=null?` <span class="muted">· ${fSpd(g.spd)}</span>`:''}${g.ko?' <span class="chip">Kickoff</span>':''}${g.defl?` <span class="chip" title="Last touched by ${esc(g.defl)} before it went in">Redirected by ${esc(g.defl)}</span>`:''}</li>`;}).join('');
  $('matchTitle').innerHTML=`<span class="pill ${m.win?'w':'l'}">${m.win?'W':'L'}</span> ${m.us}–${m.them}${m.ot?' <span class="muted">OT</span>':''} on ${esc(m.arena)}`;
  $('matchBody').innerHTML=`<p class="muted">${fmtDate(m.when)} ${fmtTime(m.when)} · ${esc(m.playlist)}${m.secs?' · '+fmtDur(m.secs):''}</p>`+
    (m.ff||m.replay||m.left.length?`<div class="mnotes">${notes(m)}</div>`:'')+
    `<table class="lines mtable num"><thead>${head}</thead><tbody>${body}</tbody></table>`+
    `<h3>Goals</h3>${story?`<ol class="story">${story}</ol>`:'<p class="muted">No goal details for this match.</p>'}`+
    `<h3>Opponents</h3><p>${m.opps.length?m.opps.map(o=>`<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>`).join(' · '):'<span class="muted">Not recorded</span>'}</p>`;
  const d=$('matchDlg');if(!d.open){if(d.showModal)d.showModal();else d.setAttribute('open','');}
  return true;
}
function matchFromHash(){const h=location.hash;if(h.startsWith('#m-'))openMatch(decodeURIComponent(h.slice(3)));}
window.addEventListener('hashchange',matchFromHash);
$('matchClose').addEventListener('click',()=>$('matchDlg').close());
$('matchDlg').addEventListener('click',e=>{if(e.target===$('matchDlg'))$('matchDlg').close();});
$('matchDlg').addEventListener('close',()=>{if(location.hash.startsWith('#m-'))history.replaceState(null,'',location.pathname+location.search);});
$('matchLog').addEventListener('click',e=>{const a=e.target.closest('a.mlink');if(!a)return;e.preventDefault();history.replaceState(null,'',a.getAttribute('href'));matchFromHash();});
// Hovering a ball on one goal map lights up the same goal on the other.
['fieldMap','netMap'].forEach(id=>{
  $(id).addEventListener('mouseover',e=>{const d=e.target.closest('.dot');if(!d)return;const k=d.dataset.g;
    document.querySelectorAll('#fieldMap,#netMap').forEach(el=>el.classList.add('linking'));
    document.querySelectorAll(`#fieldMap .dot[data-g="${k}"],#netMap .dot[data-g="${k}"]`).forEach(el=>{el.classList.add('lit');if(el!==d)el.parentNode.appendChild(el);});
    if(matchMedia('(hover: hover)').matches)showReplay(k,e);});
  $(id).addEventListener('mousemove',e=>{if(RP.k!=null&&e.target.closest('.dot'))placeReplay(e);});
  $(id).addEventListener('mouseout',e=>{const d=e.target.closest('.dot');if(!d)return;const to=e.relatedTarget&&e.relatedTarget.closest?e.relatedTarget.closest('.dot'):null;if(to===d)return;
    document.querySelectorAll('#fieldMap,#netMap').forEach(el=>el.classList.remove('linking'));
    document.querySelectorAll('.dot.lit').forEach(el=>el.classList.remove('lit'));hideReplay();});
});

// ---------- version and update log ----------
// Add a release at the top whenever something visible changes (dashboard or widget).
const CHANGELOG=[
  {v:'1.6',date:'2026-10-14',items:[
    'Arena background: a drawn pitch with boost pads over a random wallpaper on each visit',
    'Goal map pins are now little Rocket League balls',
    'Loading screen while your stats load, instead of briefly showing sample data',
    'Goal mouth on the goal map drawn as a technical diagram with real dimensions',
    'Assisted goals replay the pass first, then the shot. New games save the last 3 touches before every goal and replay them all',
    'Goals the other team redirected are marked, with a red redirect point in the 3D replay',
    'Hover a ball on the goal map for a 3D replay of that goal',
    '3D goal map: arrow keys move the camera, and a control knob turns, tilts and zooms it',
    '3D goal map you can drag to rotate, showing every goal from shot to net',
    'Click a match in the match log to see its full stats and goal-by-goal story',
    'Hover a ball on either goal map to light up the same goal on the other one',
    'Win % for each of you by goals scored in the game: 1, 2, 3, 4 and 5+',
    'Comebacks: wins after being 1, 2, 3 or 4+ goals down',
    'Blown leads: losses after being 1, 2, 3 or 4+ goals up',
    'km/h or mph toggle at the top switches every unit: speeds to mph, distances to miles, lengths to yards',
    'Distance driven, in total and per game',
    'Technical drawing of each of your main cars under Playstyle, with its hitbox size',
    'Version number and this update log',
    'Main car shows Fennec instead of the game\'s internal name "Grain"',
    'Kickoff goals fixed: they showed 0 because the game\'s goal timer includes the countdown. New games are timed from the kickoff exactly',
    'Win % when we score first vs when they score first',
    'Hat tricks and win % with a hat trick',
    'Kickoff goals per player, and for and against as a team',
    'All-time records: longest and hardest goal, hardest hit, top speed and single-game highs',
    'Average speed and top speed in Playstyle',
    'Forfeited games now count as wins and losses (tagged in the match log)']},
  {v:'1.5',date:'2026-10-09',items:['Opponents column in the match log, each linking to their tracker.gg profile']},
  {v:'1.4',date:'2026-10-03',items:['Goals against sometimes show the Mortal Kombat "oops" GIF']},
  {v:'1.3',date:'2026-09-30',items:['Long team names fit inside the widget\'s match box']},
  {v:'1.2',date:'2026-09-28',items:[
    'Widget themes: Cyber, Rocket League and Classic',
    'Watching and drinks are shared live between both widgets',
    'Goal map fixes: no more doubled goals, and goals are credited to the scorer',
    'Main car, I Got No Boost and Boost pads per game now work',
    'Bumps column, live boost meters and speedometer on the widget']},
  {v:'1.1',date:'2026-09-28',items:[
    'Widget: session record, GIF on every goal, Check updates, tray icon, spectators and drinks',
    'Type MMR pop-up, Last game period, Warm-Ups panel, rank badges',
    'Whole-pitch goal map and I Got No Boost stat',
    'Script-based setup replaces the exe']},
  {v:'1.0',date:'2026-09-27',items:['Dashboard goes live: recorder uploads, player stats, trends, MMR, goal map and match log','Widget updates itself from the site']}];
function renderChanges(){
  $('verBtn').textContent='v'+CHANGELOG[0].v;
  $('verBtn').title='What\'s new in v'+CHANGELOG[0].v;
  $('changesBody').innerHTML=CHANGELOG.map(r=>`<section class="rel"><h3>v${esc(r.v)}<span>${fmtDate(new Date(r.date+'T12:00:00'))}</span></h3><ul>${r.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
}
$('verBtn').addEventListener('click',()=>{const d=$('changes');if(d.showModal)d.showModal();else d.setAttribute('open','');});
$('changesClose').addEventListener('click',()=>$('changes').close());
$('changes').addEventListener('click',e=>{if(e.target===$('changes'))$('changes').close();});
renderChanges();

load();
// New matches arrive from the recorder a few seconds after each game; pick them up without a reload.
setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
})();
