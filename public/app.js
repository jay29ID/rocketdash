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
  // Sample touches: a wandering ball, touched by whoever, with each goal finished near the right net.
  const sampleTouches=(pl,goals,dur,my)=>{const f=my===1?-1:1,out=[];let bx=0,by=0,t=3;const ns=pl.map(p=>p.name);
    const gs=goals.map(g=>({t:+g.goal_time,ours:g.ours,who:g.scorer})).sort((a,b)=>a.t-b.t);goals.forEach(g=>g.at=g.goal_time);let gi=0;
    while(t<dur){const g=gs[gi];if(g&&t>=g.t-2){const sgn=g.ours?1:-1,who=ns.includes(g.who)?g.who:ns[g.ours?0:2+(gi%2)]||ns[0];
        out.push({t:+(g.t-1.2).toFixed(1),p:who,k:g.ours?my:1-my,x:Math.round(-f*norm(0,700)),y:Math.round(f*sgn*norm(3900,500)),z:93});bx=0;by=0;t=g.t+4;gi++;continue;}
      bx=clamp(bx+norm(0,1300),-3900,3900);by=clamp(by+norm(0,1800),-4900,4900);const j=Math.floor(rnd()*ns.length);
      out.push({t:+t.toFixed(1),p:ns[j],k:pl[j].team,x:Math.round(bx),y:Math.round(by),z:Math.round(clamp(norm(150,200),93,1500))});t+=.4+rnd()*2.2;}
    return out;};
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
      const lineup=prof.map((p,j)=>{
        const L=lines[j],shots=L.goals+pois(Math.max(.4,p.sh-p.g)),saves=pois(p.sv*(them>2?1.25:1)),demos=pois(p.d),touches=Math.max(8,Math.round(norm(p.t,5)));
        const air=+clamp(norm(p.air,1.8),1,20).toFixed(1),wall=+clamp(norm(p.wall,2.5),3,25).toFixed(1);
        return {name:names[j],team:my,tracked:true,goals:L.goals,assists:L.assists,shots,saves,demos,touches,
          score:100*L.goals+50*L.assists+50*saves+20*shots+15*demos+2*touches+Math.floor(rnd()*40),
          car_touches:pois(p.bump),boost_pickups:Math.round(clamp(norm(j?34:29,6),8,70)),loadout:{Car:j?'Fennec':'Octane'},avg_boost:Math.round(clamp(norm(p.boost,5),20,70)),pct_supersonic:+clamp(norm(p.ss,3),3,35).toFixed(1),pct_zero_boost:+clamp(norm(j?9:7,3),1,25).toFixed(1),zero_boost_fixed:true,
          avg_speed:Math.round(clamp(norm(j?1380:1320,60),1100,1600)),max_speed:2300,pct_air:air,pct_wall:wall,pct_ground:+(100-air-wall).toFixed(1),hardest_hit:Math.round(clamp(norm(p.gs+25,15),60,160))};
      });
      // Two opponents, and now and then one of them redirects one of our shots on its way in.
      const foes=[pick(['Zephyr','BallChaser99','nxtLvl','Mochi','RocketRalph','ghostpepper']),pick(['Tidal','Vex','sir_flips','Kiwi','B0ost','Nova'])];
      const opp=foes.map(n=>({name:n,team:1-my,tracked:false,platform:'Epic',goals:0,shots:0}));
      for(let g=0;g<them;g++)opp[g%2].goals++;
      const miss=lineup.reduce((a,p)=>a+p.saves,0)+pois(1.6);opp.forEach((o,i)=>o.shots=o.goals+(i?Math.floor(miss/2):Math.ceil(miss/2)));
      const players=[...lineup,...opp];
      // Saves: a shot from their side and the touch that kept it out, in world units (they attack -f).
      const saves=[];lineup.forEach(pl=>{for(let q=0;q<(pl.saves||0);q++){
        const sh={x:clamp(norm(0,1700),-3600,3600),y:clamp(norm(2300,1100),200,4700),z:clamp(norm(150,150),93,900)},tg={x:clamp(norm(0,420),-800,800),z:clamp(norm(260,150),93,600)},u=.55+rnd()*.4;
        const w=(x,y,z)=>({X:Math.round(-f*x),Y:Math.round(-f*y),Z:Math.round(z)});
        saves.push({saver:pl.name,team:my,ours:true,kind:rnd()<.15?'EpicSave':'Save',shooter:pick(foes),shot_from:w(sh.x,sh.y,sh.z),shot_speed:Math.round(clamp(norm(2400,500),1200,4000)),
          save_at:w(sh.x+(tg.x-sh.x)*u,sh.y+(5120-sh.y)*u,sh.z+(tg.z-sh.z)*u)});}});
      goals.forEach(g=>{if(g.ours&&rnd()<.14){const s=g.shot_from,ix=g.impact.X,f=Math.sign(g.impact.Y)||1;
        g.scorer_from=s;g.last_touch=pick(foes);g.shot_from={X:Math.round(s.X+(ix-s.X)*.6+norm(0,250)),Y:Math.round(s.Y+(f*5120-s.Y)*.6),Z:Math.round(clamp(norm(260,140),60,700))};}
        // Newer recorders save the last 3 touches; give the sample's assisted goals some.
        if(g.ours&&g.assist_from&&rnd()<.7){const t=[{player:g.assister,team:my,location:g.assist_from},{player:g.scorer,team:my,location:g.scorer_from||g.shot_from}];
          if(g.last_touch)t.push({player:g.last_touch,team:1-my,location:g.shot_from});g.touches=t.slice(-3);}});
      matches.push({match_guid:'sample-'+si+'-'+k,started_at:new Date(t).toISOString(),duration_seconds:dur,playlist:warm?'Casual Doubles':'Ranked Doubles',arena:pick(arenas),
        overtime:ot,my_team:my,result:win?'Win':'Loss',team_score:us,opponent_score:them,goals,saves,players,
        replay_created:rnd()<.2?new Date(t+dur*1000).toISOString():null,
        kickoffs:us+them+1,touch_log:sampleTouches(players,goals,dur,my),players_left:rnd()<.08?[{name:'Opponent',team:1-my}]:[],spectators:crowd,drinks:{[names[0]]:Math.floor(k*.7)}});
      t+=(dur+60+Math.floor(rnd()*90))*1000;
    }
    rating=rating.map((v,j)=>Math.round(v+w*(8.5+j)+norm(0,6)));
    names.forEach((nm,j)=>mmr.push({logged_at:new Date(t).toISOString(),player:nm,playlist:'Ranked Doubles',mmr:rating[j]}));
  });
  sampleExtras(matches,mmr,names);
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
let ALL=[], DONE=[], sessions=[], NOW=Date.now(), FACED={};
const SPECTATORS=['Morgan','Chance','Nick'];
let party='duo', period='30', mode='avg', metric='winpct', playlist=null, units='metric', mapSide='us', mapWho='all';
let hmTheme='classic',g3Theme='classic',look='classic';
try{const s=JSON.parse(localStorage.getItem('rl-duo-ui')||'{}');if(s.hm)hmTheme=s.hm;if(s.g3)g3Theme=s.g3;if(s.look)look=s.look;if(s.period)period=s.period;if(s.mode)mode=s.mode;if(s.metric)metric=s.metric;if(s.playlist)playlist=s.playlist;if(s.units)units=s.units;if(s.party)party=s.party;}catch(e){}
const saveUi=()=>{try{localStorage.setItem('rl-duo-ui',JSON.stringify({party,period,mode,metric,playlist,units,hm:hmTheme,g3:g3Theme,look}))}catch(e){}};

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
  const opp=myTeam==null?[]:rows.filter(x=>x&&num(x.team)!=null&&num(x.team)!==myTeam);
  // Our saves for the defense map, turned so our goal is at the bottom. Only matches recorded since
  // saves were tracked have a saves list. Rocket League's X is left-handed, so X turns with Y.
  const defSaves=Array.isArray(r.saves)?r.saves.filter(s=>s&&(s.ours!=null?s.ours:myTeam!=null&&num(s.team)===myTeam)).map(s=>{
    const f=num(s.team)===1?-1:1,l=s.save_at||s.location,who=s.saver||s.player;
    return {who:PLAYERS.findIndex(p=>p.name===who),epic:!!s.epic||/epic/i.test(s.kind||''),x:co(l,'X')!=null?-f*co(l,'X'):null,y:co(l,'Y')!=null?f*co(l,'Y'):null};
  }):null;
  // The game sends a second, empty GoalScored for most goals (no goal time, no scorer), so a match
  // stored twice as many goals as were scored. Real goals always have a goal time.
  const rawGoals=(r.goals||[]).filter(Boolean), timed=rawGoals.some(g=>+g.goal_time>0);
  const teamOf={};(r.players||[]).forEach(p=>{if(p&&p.name)teamOf[p.name]=num(p.team);});
  const goals=rawGoals.filter(g=>!timed||+g.goal_time>0).map(g=>{
    // f turns every goal into one attacking +Y. Rocket League's axes are left-handed (+X is the
    // shooter's left facing +Y), so X is negated too, or the maps come out mirrored.
    const team=num(g.team), f=team===1?-1:1, i=g.impact;
    // The game reports about a third of impact points with Y on the wrong end (a team 0 goal at
    // Y=-5300 shot from Y=+4800), so the impact is turned using its own Y sign, not the team's.
    const fi=co(i,'Y')?Math.sign(co(i,'Y')):f;
    // Redirect: the game's last touch belongs to the other team from the scorer. Then shot_from is
    // where that player touched it, and scorer_from (newer recorders) is where the scorer hit it.
    const lt=g.last_touch, defl=lt&&g.scorer&&lt!==g.scorer&&teamOf[lt]!=null&&team!=null&&teamOf[lt]!==team?String(lt):null;
    const s=defl&&g.scorer_from?g.scorer_from:g.shot_from, dp=defl?g.shot_from:null;
    const ours=g.ours!=null?!!g.ours:(myTeam!=null&&team===myTeam);
    // Credit the goal to whoever the game credits; the last hit can be an opponent's deflection.
    const who=ours?PLAYERS.findIndex(p=>p.name===(PLAYERS.some(q=>q.name===g.scorer)?g.scorer:g.shot_from_player)):-1;
    return {ours,who,scorer:g.scorer||null,assister:g.assister||null,ko:isKickoffGoal(g),spd:num(g.speed)!=null?Math.round(+g.speed):null,
      z:co(s,'Z'),x:co(s,'X')!=null?-f*co(s,'X'):null,y:co(s,'Y')!=null?f*co(s,'Y'):null,
      ix:co(i,'X')!=null?-fi*co(i,'X'):null,iz:co(i,'Z'),
      ax:co(g.assist_from,'X')!=null?-f*co(g.assist_from,'X'):null,ay:co(g.assist_from,'Y')!=null?f*co(g.assist_from,'Y'):null,az:co(g.assist_from,'Z'),
      touches:Array.isArray(g.touches)?g.touches.filter(t=>t&&t.location).map(t=>({name:t.player?String(t.player):'',team:num(t.team),x:-f*co(t.location,'X'),y:f*co(t.location,'Y'),z:co(t.location,'Z')})):null,scoreTeam:team,
      defl,dx:co(dp,'X')!=null?-f*co(dp,'X'):null,dy:co(dp,'Y')!=null?f*co(dp,'Y'):null,dz:co(dp,'Z'),deflOnly:!!defl&&!g.scorer_from};
  });
  // Saves (recorders from 2026-10-14): turned so the shot travels toward +Y, our goal at the top.
  // Where it was heading is projected along the shot-to-save line; it's a straight-line estimate.
  const saves=(r.saves||[]).filter(s=>s&&s.save_at).map(s=>{
    const team=num(s.team), fs=team===0?-1:1, X=o=>co(o,'X')!=null?-fs*co(o,'X'):null, Y=o=>co(o,'Y')!=null?fs*co(o,'Y'):null;
    const sv=s.save_at, sh=s.shot_from, o={save:true,ours:s.ours!=null?!!s.ours:(myTeam!=null&&team===myTeam),scorer:s.saver||null,shooter:s.shooter||null,epic:/epic/i.test(s.kind||''),
      who:PLAYERS.findIndex(p=>p.name===s.saver),spd:toKmh(num(s.shot_speed)),x:X(sh),y:Y(sh),z:co(sh,'Z'),sx:X(sv),sy:Y(sv),sz:co(sv,'Z'),scoreTeam:team,touches:null};
    if(o.sx==null||o.sy==null)return null;
    let px=o.sx,pz=o.sz!=null?o.sz:93;
    if(o.x!=null&&o.y!=null&&o.sy>o.y+50){const t=(5120-o.y)/(o.sy-o.y);px=o.x+t*(o.sx-o.x);pz=(o.z!=null?o.z:93)+t*(pz-(o.z!=null?o.z:93));}
    o.ix=clamp(px,-800,800);o.iz=clamp(pz,93,600);return o;}).filter(Boolean);
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
    ourGoals:goals.filter(g=>g.ours),theirGoals:goals.filter(g=>!g.ours),ourSaves:saves.filter(g=>g.ours),defSaves,
    oppShots:opp.length?opp.reduce((a,x)=>a+(num(x.shots)||0),0):null,oppGoals:opp.reduce((a,x)=>a+(num(x.goals)||0),0),
    replay:!!r.replay_created,left,opps,ff:!!r.ff,raw:r,
    // Every ball touch (recorders from 2026-10-14), turned so our team attacks +Y, for the timelapse.
    tl:Array.isArray(r.touch_log)&&r.touch_log.length>4?(f=>r.touch_log.filter(t=>t&&t.t!=null).map(t=>({t:+t.t,p:String(t.p||''),k:num(t.k),x:-f*(+t.x||0),y:f*(+t.y||0),z:+t.z||0})).sort((a,b)=>a.t-b.t))(myTeam===1?-1:1):null,
    goalAt:rawGoals.filter(g=>g&&+g.goal_time>0&&g.at!=null).map(g=>({t:+g.at,ours:g.ours!=null?!!g.ours:(myTeam!=null&&num(g.team)===myTeam),who:g.scorer||''})),
    spectators:Array.isArray(r.spectators)?r.spectators.map(String):null,
    drinks:r.drinks&&num(r.drinks[PLAYERS[0].name])!=null?num(r.drinks[PLAYERS[0].name]):null};
}

function build(){
  const done=RAW.matches.map(forfeit).filter(r=>r&&(r.result==='Win'||r.result==='Loss')&&r.started_at).map(toMatch).filter(m=>!isNaN(m.when));
  done.sort((a,b)=>a.when-b.when);
  // Duo: at least two of us in the game. Solo: just one of us (solo queue, 1v1, or with someone else).
  const withUs=m=>m.lines.filter(Boolean).length;
  const kept=party==='all'?done:done.filter(m=>party==='solo'?withUs(m)===1:withUs(m)>=2);
  done.length=0;kept.forEach(m=>done.push(m));
  document.querySelectorAll('#party button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p===party)));
  const counts={};done.forEach(m=>counts[m.playlist]=(counts[m.playlist]||0)+1);
  const lists=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  if(playlist!=='All'&&!counts[playlist])playlist=counts['Ranked Doubles']?'Ranked Doubles':'All';
  $('playlist').innerHTML=`<option value="All">All playlists (${done.length})</option>`+lists.map(l=>`<option value="${esc(l)}">${esc(plName(l))} (${counts[l]})</option>`).join('');
  $('playlist').value=playlist;
  DONE=done;
  // Every opponent we've played, across all playlists, with our record against them.
  FACED={};done.forEach(m=>m.opps.forEach(o=>{const k=o.name.toLowerCase(),f=FACED[k]||(FACED[k]={n:0,w:0,list:[]});f.n++;if(m.win)f.w++;f.list.push(m);}));
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
function fieldMap(pts,noun,tip,top,bottom){
  // Whole pitch, the attacked goal at the top. Goal lines at Y=±5120, nets 880 deep, corners cut 1152.
  const W=480,Y0=-6000,Y1=6000,H=Math.round(W*(Y1-Y0)/8192);
  const sx=x=>(x+4096)/8192*W,sy=y=>(Y1-y)/(Y1-Y0)*H,su=u=>u/8192*W;
  const cell=512,bins={};
  pts.forEach(g=>{const c=Math.floor((clamp(g.x,-4096,4095)+4096)/cell),r=Math.floor((clamp(g.y,-5120,5119)+5120)/cell);const k=c+','+r;bins[k]=(bins[k]||0)+1;});
  const bmax=Math.max(1,...Object.values(bins)),ch=1152;
  const ends=s=>{const g=5120*s,c=(5120-ch)*s,n=6000*s;return `L${sx(-4096)},${sy(c)} L${sx(-4096+ch)},${sy(g)} L${sx(-893)},${sy(g)} L${sx(-893)},${sy(n)} L${sx(893)},${sy(n)} L${sx(893)},${sy(g)} L${sx(4096-ch)},${sy(g)} L${sx(4096)},${sy(c)}`;};
  const outline=`M${sx(-4096)},${sy(0)} ${ends(1)} L${sx(4096)},${sy(-(5120-ch))} L${sx(4096-ch)},${sy(-5120)} L${sx(893)},${sy(-5120)} L${sx(893)},${sy(-6000)} L${sx(-893)},${sy(-6000)} L${sx(-893)},${sy(-5120)} L${sx(-4096+ch)},${sy(-5120)} L${sx(-4096)},${sy(-(5120-ch))} Z`;
  let f=`<path d="${outline}" fill="var(--pitch)"/>`;
  Object.entries(bins).forEach(([k,n])=>{const [c,r]=k.split(',').map(Number);
    f+=`<rect x="${sx(c*cell-4096)+.5}" y="${sy(-5120+(r+1)*cell)+.5}" width="${su(cell)-1}" height="${su(cell)-1}" rx="2" fill="${heatColor(n/bmax)}" opacity=".85"><title>${n} ${noun}${n>1?'s':''} from here</title></rect>`;});
  const ln='stroke="var(--pitch-line)" stroke-width="1.5" fill="none"';
  f+=`<path d="${outline}" ${ln}/>`;
  f+=`<line x1="${sx(-4096)}" x2="${sx(4096)}" y1="${sy(0)}" y2="${sy(0)}" ${ln}/><circle cx="${sx(0)}" cy="${sy(0)}" r="${su(1000)}" ${ln}/>`;
  f+=`<rect x="${sx(-1800)}" y="${sy(5120)}" width="${su(3600)}" height="${su(1100)}" ${ln}/><rect x="${sx(-1800)}" y="${sy(-4020)}" width="${su(3600)}" height="${su(1100)}" ${ln}/>`;
  f+=`<text x="${W/2}" y="${sy(6000)-6}" text-anchor="middle">${top}</text><text x="${W/2}" y="${sy(-6000)+14}" text-anchor="middle">${bottom}</text>`;
  // Pins stay neutral so they don't fight the blue-to-red heat.
  pts.forEach(g=>{f+=rlBall(sx(clamp(g.x,-4096,4096)),sy(clamp(g.y,-5120,5120)),4.5,'#0b1017',1,'rlb-'+noun,tip(g),g.k);});
  return `<svg viewBox="0 -18 ${W} ${H+36}" role="img" aria-label="Top-down field with ${pts.length} ${noun} locations">${rlBallDefs('rlb-'+noun)}${f}</svg>`;
}
// Cold to hot: blue, through violet, to red. t runs 0..1.
const HEAT_C=[[47,111,214],[124,77,196],[214,51,57]],HEAT_NEON=[[52,12,100],[165,45,235],[57,255,20]],HEAT_NIGHT=[[38,38,42],[120,120,126],[214,52,48]];
function heatColor(t){const HEAT=hmTheme==='neon'?HEAT_NEON:hmTheme==='night'?HEAT_NIGHT:HEAT_C;
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
  const SV=mapSide==='saves';
  let goals=list.flatMap(m=>(SV?m.ourSaves:mapSide==='us'?m.ourGoals:m.theirGoals).map(g=>({...g,m})));
  if(mapSide!=='them'&&mapWho!=='all')goals=goals.filter(g=>g.who===+mapWho);
  goals.forEach((g,k)=>g.k=k);
  // The field shows where each shot came from; for saves, where we kept it out.
  const fx=g=>SV?g.sx:g.x,fy=g=>SV?g.sy:g.y;
  const shots=goals.filter(g=>fx(g)!=null&&fy(g)!=null), hits=goals.filter(g=>g.ix!=null&&g.iz!=null);
  $('mapWho').style.visibility=mapSide!=='them'&&PLAYERS.length>1?'visible':'hidden';
  const col=g=>g.who>=0?PLAYERS[g.who].color:'var(--opp)';
  const tip=g=>SV?`${g.who>=0?PLAYERS[g.who].short:'Us'} ${g.epic?'epic save':'save'}${g.shooter?' · shot by '+g.shooter:''}${g.spd!=null?' · '+fSpd(g.spd):''} · ${g.m.us}–${g.m.them} ${g.m.win?'win':'loss'}, ${fmtDate(g.m.when)}`:`${g.who>=0?PLAYERS[g.who].short:mapSide==='us'?'Us':'Opponent'}${g.assister?' (assist '+(PLAYERS.find(q=>q.name===g.assister)?.short||g.assister)+')':''}${g.defl?' · redirected by '+g.defl:''}${g.spd!=null?' · '+fSpd(g.spd):''} · ${g.m.us}–${g.m.them} ${g.m.win?'win':'loss'}, ${fmtDate(g.m.when)}`;
  // Whole pitch, their goal at the top. Goal lines at Y=±5120, nets 880 deep, corners cut 1152.
  const W=480,Y0=-6000,Y1=6000,H=Math.round(W*(Y1-Y0)/8192);
  const sx=x=>(x+4096)/8192*W,sy=y=>(Y1-y)/(Y1-Y0)*H,su=u=>u/8192*W;
  const cell=512,bins={};
  shots.forEach(g=>{const c=Math.floor((clamp(fx(g),-4096,4095)+4096)/cell),r=Math.floor((clamp(fy(g),-5120,5119)+5120)/cell);const k=c+','+r;bins[k]=(bins[k]||0)+1;});
  const bmax=Math.max(1,...Object.values(bins)),ch=1152;
  const ends=s=>{const g=5120*s,c=(5120-ch)*s,n=6000*s;return `L${sx(-4096)},${sy(c)} L${sx(-4096+ch)},${sy(g)} L${sx(-893)},${sy(g)} L${sx(-893)},${sy(n)} L${sx(893)},${sy(n)} L${sx(893)},${sy(g)} L${sx(4096-ch)},${sy(g)} L${sx(4096)},${sy(c)}`;};
  const outline=`M${sx(-4096)},${sy(0)} ${ends(1)} L${sx(4096)},${sy(-(5120-ch))} L${sx(4096-ch)},${sy(-5120)} L${sx(893)},${sy(-5120)} L${sx(893)},${sy(-6000)} L${sx(-893)},${sy(-6000)} L${sx(-893)},${sy(-5120)} L${sx(-4096+ch)},${sy(-5120)} L${sx(-4096)},${sy(-(5120-ch))} Z`;
  let f=`<path d="${outline}" fill="var(--pitch)"/>`;
  Object.entries(bins).forEach(([k,n])=>{const [c,r]=k.split(',').map(Number);
    f+=`<rect x="${sx(c*cell-4096)+.5}" y="${sy(-5120+(r+1)*cell)+.5}" width="${su(cell)-1}" height="${su(cell)-1}" rx="2" fill="${heatColor(n/bmax)}" opacity=".85"><title>${n} ${SV?'save':'goal'}${n>1?'s':''} ${SV?'made':'from'} here</title></rect>`;});
  const ln='stroke="var(--pitch-line)" stroke-width="1.5" fill="none"';
  f+=`<path d="${outline}" ${ln}/>`;
  f+=`<line x1="${sx(-4096)}" x2="${sx(4096)}" y1="${sy(0)}" y2="${sy(0)}" ${ln}/><circle cx="${sx(0)}" cy="${sy(0)}" r="${su(1000)}" ${ln}/>`;
  f+=`<rect x="${sx(-1800)}" y="${sy(5120)}" width="${su(3600)}" height="${su(1100)}" ${ln}/><rect x="${sx(-1800)}" y="${sy(-4020)}" width="${su(3600)}" height="${su(1100)}" ${ln}/>`;
  f+=`<text x="${W/2}" y="${sy(6000)-6}" text-anchor="middle">${mapSide==='us'?'Their goal':'Our goal'}</text><text x="${W/2}" y="${sy(-6000)+14}" text-anchor="middle">${mapSide==='us'?'Our goal':'Their goal'}</text>`;
  // Saves: a faint line back to where the shot came from.
  if(SV)shots.forEach(g=>{if(g.x!=null&&g.y!=null)f+=`<line x1="${sx(clamp(g.x,-4096,4096))}" y1="${sy(clamp(g.y,-5120,5120))}" x2="${sx(clamp(g.sx,-4096,4096))}" y2="${sy(clamp(g.sy,-5120,5120))}" stroke="var(--opp)" stroke-width="1" stroke-dasharray="3 3" opacity=".55"/><circle cx="${sx(clamp(g.x,-4096,4096))}" cy="${sy(clamp(g.y,-5120,5120))}" r="2" fill="var(--opp)" opacity=".7"/>`;});
  // Dots stay neutral here so they don't fight the blue-to-red heat; the net view carries who scored.
  shots.forEach(g=>{f+=rlBall(sx(clamp(fx(g),-4096,4096)),sy(clamp(fy(g),-5120,5120)),4.5,SV?col(g):'#0b1017',SV?1.6:1,'rlbF',tip(g),g.k);});
  $('fieldMap').innerHTML=`<svg viewBox="0 -18 ${W} ${H+36}" role="img" aria-label="Top-down field with ${shots.length} ${SV?'save':'shot'} locations">${rlBallDefs('rlbF')}${f}</svg>`;
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
  $('fieldTitle').textContent=SV?'Where we made our saves':mapSide==='us'?'Where our goals were shot from':'Where their goals were shot from';
  $('netTitle').textContent=SV?'Where the saved shots were heading':mapSide==='us'?'Where our goals hit the net':'Where their goals beat us';
  $('mapLegend').innerHTML=mapSide!=='them'?PLAYERS.filter((p,j)=>mapWho==='all'||+mapWho===j).map(p=>`<span><i style="background:${p.color};height:8px;width:8px"></i>${esc(p.name)}</span>`).join(''):'<span><i style="background:var(--opp);height:8px;width:8px"></i>Opponents</span>';
  const top=Object.entries(zones).sort((a,b)=>b[1]-a[1])[0];
  const zname=k=>{const [c,r]=k.split(',').map(Number);return ['low','middle','high'][r]+' '+['left','centre','right'][c];};
  const sp=goals.filter(g=>g.spd!=null),avgSpd=sp.length?Math.round(sp.reduce((a,g)=>a+g.spd,0)/sp.length):null;
  const missing=goals.length-hits.length;
  $('mapNote').textContent=SV?(!goals.length?'No saves with positions yet. The widget records them from its next update on.':`${goals.length} saves${avgSpd!=null?', shots averaging '+fSpd(avgSpd):''}.`+(top?` Most were heading ${zname(top[0])} (${Math.round(100*top[1]/hits.length)}%).`:'')+' Dashed lines lead back to the shot. Where a shot was heading is estimated from the shot and the save in a straight line.'):
    !goals.length?'No goals in this period.':
    `${goals.length} goals${avgSpd!=null?', average '+fSpd(avgSpd):''}.`+(top?` Most went in ${zname(top[0])} (${Math.round(100*top[1]/hits.length)}%).`:'')+
    (missing?` ${missing} goal${missing>1?'s were':' was'} recorded before positions were saved.`:'')+' The net is drawn as you would see it facing the goal.';
  $('map3dTitle').textContent=SV?'In 3D: every save, from the shot to the save':'In 3D: every goal from shot to net';
  G3.goals=goals.filter(g=>(SV?g.sx!=null:g.x!=null&&g.y!=null)&&g.ix!=null&&g.iz!=null);G3.side=mapSide;draw3D();
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
  if(g.save){const w=[];if(g.x!=null&&g.y!=null)w.push({p:[g.x,g.y,g.z!=null?g.z:93],name:g.shooter,kind:'opp',other:false,label:'SHOT · '+String(g.shooter||'?').toUpperCase()});
    w.push({p:[g.sx,g.sy,g.sz!=null?g.sz:93],name:g.scorer,kind:g.who>=0?'p'+g.who:'mate',other:false,save:true,label:(g.epic?'EPIC SAVE · ':'SAVE · ')+String(g.who>=0?PLAYERS[g.who].short:g.scorer||'?').toUpperCase()});return w;}
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
  // A save ends with the ball knocked back out the way it came.
  const w=waypoints(g),b=g.save?(g.x!=null?[g.sx+(g.x-g.sx)*.35,g.sy+(g.y-g.sy)*.35,Math.max(93,(g.sz||93)+350)]:[g.sx*.85,g.sy-1400,Math.max(93,(g.sz||93)+300)]):[g.ix,5120,g.iz];if(!w.length)w.push({p:[g.x,g.y,93],name:g.scorer,kind:'mate'});
  let pts=[];const marks=[];
  w.forEach((t,i)=>{marks.push({i:pts.length?pts.length-1:0,...t});const nx=i+1<w.length?w[i+1].p:b,leg=bez(t.p,nx,16);pts=pts.concat(pts.length?leg.slice(1):leg);});
  pts.marks=marks;const last=w[w.length-1];if(last.other)pts.kink=marks[marks.length-1].i;
  return pts;
}
// Flight time for the replay: real distance over the goal's speed, squeezed into 0.9 to 2.2 s.
function flightMs(g,pts){let d=0;for(let i=1;i<pts.length;i++)d+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);
  const v=g.spd?g.spd/0.036:2000,legs=(pts.marks||[0]).length;return Math.max(900,Math.min(1500+700*legs,d/v*1000*1.6));}
// 3D colour themes: the cyan HUD and a neon one (black, fluorescent green and purple).
const PAL3={classic:{ink:'#8fdcff',muted:'rgba(120,200,255,.55)',line:'rgba(90,180,255,.28)',bg:'#050b14',floor:'rgba(20,60,110,.35)',ghost:'rgba(140,220,255,.45)',acc:'#5fe1ff',accA:a=>`rgba(95,225,255,${a})`,text:'#d8f6ff',mate:'#9fb4c8'},
  neon:{ink:'#39ff88',muted:'rgba(57,255,136,.55)',line:'rgba(57,255,20,.2)',bg:'#020203',floor:'rgba(110,30,190,.24)',ghost:'rgba(192,77,255,.5)',acc:'#c04dff',accA:a=>`rgba(192,77,255,${a})`,text:'#eaffe4',mate:'#b9a3d6',
    pcol:['#39ff14','#c04dff','#00f0ff','#ffe600'],opp:'#ff2bd6'},
  night:{ink:'#d4d4d6',muted:'rgba(200,200,204,.5)',line:'rgba(200,200,204,.16)',bg:'#070708',floor:'rgba(60,60,66,.32)',ghost:'rgba(224,68,62,.45)',acc:'#e0443e',accA:a=>`rgba(224,68,62,${a})`,text:'#ededee',mate:'#9a9a9e',
    pcol:['#e6e6e8','#e0443e','#9a9a9e','#a83a36'],opp:'#6c6c72'}};
function render3D(cv,V){
  const W=cv.clientWidth,H=cv.clientHeight,dpr=window.devicePixelRatio||1;if(!W||!H)return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const css=getComputedStyle(document.documentElement),tok=n=>css.getPropertyValue(n).trim();
  const K=PAL3[V.theme]||PAL3.classic,NE=!!K.pcol,HU=V.hud||NE;
  const ink=HU?K.ink:tok('--ink-2'),muted=HU?K.muted:tok('--muted'),line=HU?K.line:tok('--line'),pcol=PLAYERS.map((p,j)=>NE?K.pcol[j%4]:tok('--p'+(j+1))),opp=NE?K.opp:(tok('--opp')||muted);
  const T=V.T,D=V.D,F=V.F,ca=Math.cos(V.yaw),sa=Math.sin(V.yaw),cb=Math.cos(V.pitch),sb=Math.sin(V.pitch);
  const P=([x,y,z])=>{x-=T[0];y-=T[1];z-=T[2];const x1=x*ca-y*sa,y1=x*sa+y*ca;const up=z*cb+y1*sb,dp=Math.max(300,y1*cb-z*sb+D);return [W/2+F*x1/dp,H*.55-F*up/dp,dp];};
  const path=(pts,close)=>{c.beginPath();pts.forEach((p,i)=>{const q=P(p);i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);});if(close)c.closePath();};
  const ch=1152,floor=[[-4096,-5120+ch],[-4096+ch,-5120],[4096-ch,-5120],[4096,-5120+ch],[4096,5120-ch],[4096-ch,5120],[-4096+ch,5120],[-4096,5120-ch]].map(([x,y])=>[x,y,0]);
  if(HU){c.fillStyle=K.bg;c.fillRect(0,0,W,H);}
  path(floor,true);c.fillStyle=HU?K.floor:(tok('--pitch')||'rgba(40,80,50,.3)');c.globalAlpha=HU?1:.55;c.fill();c.globalAlpha=1;c.strokeStyle=line;c.lineWidth=1.2;c.stroke();
  if(HU){c.lineWidth=.6;for(let x=-4096;x<=4096;x+=512){path([[x,-5120,0],[x,5120,0]]);c.stroke();}for(let y=-5120;y<=5120;y+=512){path([[-4096,y,0],[4096,y,0]]);c.stroke();}c.lineWidth=1.2;}
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
  if(!V.hud){cv._P=P;cv._list=list;}   // kept for hover hit-testing on the big view
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
    c.setLineDash([4,5]);c.strokeStyle=HU?K.ghost:muted;c.lineWidth=1;path(pts);c.stroke();c.setLineDash([]);
    const s0=P(pts[0]),sp=P([pts[0][0],pts[0][1],0]);c.strokeStyle=K.acc;c.lineWidth=1.2;
    c.beginPath();c.arc(sp[0],sp[1],9,0,7);c.moveTo(sp[0]-14,sp[1]);c.lineTo(sp[0]+14,sp[1]);c.moveTo(sp[0],sp[1]-8);c.lineTo(sp[0],sp[1]+8);c.stroke();
    c.save();c.shadowColor=col;c.shadowBlur=14;c.lineCap='round';
    const kk=pts.kink,kc=k=>k[0]==='p'?pcol[+k.slice(1)]:k==='opp'?REDIR:(HU?K.mate:muted);
    const segCol=i=>{let m=pts.marks[0];pts.marks.forEach(x=>{if(x.i<i)m=x;});return m.i===kk?REDIR:kc(m.kind);};
    for(let i=1;i<=n;i++){const a=P(pts[i-1]),b=P(pts[i]);c.globalAlpha=.25+.75*(i/n);c.strokeStyle=segCol(i);c.shadowColor=c.strokeStyle;c.lineWidth=1+3*(i/n);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
    c.restore();c.globalAlpha=1;
    const fi=p*Lx,i0=Math.floor(fi),i1=Math.min(Lx,i0+1),tt=fi-i0,hp=[0,1,2].map(d=>pts[i0][d]*(1-tt)+pts[i1][d]*tt),h=P(hp),fl=P([hp[0],hp[1],0]);
    c.setLineDash([2,3]);c.strokeStyle=K.accA(.6);c.beginPath();c.moveTo(h[0],h[1]);c.lineTo(fl[0],fl[1]);c.stroke();c.setLineDash([]);
    c.strokeStyle=K.accA(.7);c.beginPath();c.ellipse(fl[0],fl[1],7,3,0,0,7);c.stroke();
    if(!inA){c.save();c.shadowColor=K.acc;c.shadowBlur=18;ball(h[0],h[1],Math.max(4,F*92/h[2]*.75),col);c.restore();}
    // Each touch: a ring and the player's name once the ball has reached it.
    pts.marks.forEach((m,mi)=>{if(m.i===kk||p*Lx<m.i-0.01)return;const q=P(pts[m.i]),cc=kc(m.kind);c.strokeStyle=cc;c.lineWidth=1.3;c.beginPath();c.arc(q[0],q[1],5,0,7);c.stroke();
      if(pts.marks.length>1||V.hud){c.font='bold 10px '+(tok('--mono')||'monospace');c.textAlign='left';c.fillStyle=cc;c.fillText(m.label||`${mi+1} · ${(PLAYERS.find(x=>x.name===m.name)?.short||m.name||'?').toUpperCase()}`,q[0]+8,q[1]-8);}});
    // Saves: a dashed line from the save to where the shot was heading, with a cross on the goal line.
    if(g.save){const sm=pts.marks.find(m=>m.save);if(sm&&p*Lx>=sm.i){const a=P(pts[sm.i]),e=P([g.ix,5120,g.iz]);c.setLineDash([3,4]);c.strokeStyle=REDIR;c.globalAlpha=.8;c.lineWidth=1.2;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(e[0],e[1]);c.stroke();c.setLineDash([]);
      c.beginPath();c.moveTo(e[0]-4,e[1]-4);c.lineTo(e[0]+4,e[1]+4);c.moveTo(e[0]+4,e[1]-4);c.lineTo(e[0]-4,e[1]+4);c.stroke();c.globalAlpha=1;if(V.hud){c.font='bold 10px '+(tok('--mono')||'monospace');c.textAlign='left';c.fillStyle=REDIR;c.textAlign='center';c.fillText('WAS HEADING HERE',e[0],e[1]+16);}}}
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
      const kmh=g.spd,d=g.save?0:Math.hypot(g.ix-g.x,5120-g.y)/100,lbl=g.who>=0?PLAYERS[g.who].short.toUpperCase():(V.side==='them'?'OPPONENT':'US');
      const rows=g.save?[[g.epic?'EPIC SAVE':'SAVE',lbl],['SHOT BY',String(g.shooter||'—').toUpperCase()],['SHOT SPD',kmh!=null?fSpd(kmh).toUpperCase():'—'],['FROM LINE',fLen(Math.max(0,5120-g.sy)/100).toUpperCase()],['SAVE H',IMP()?((g.sz||93)/100*3.28084).toFixed(1)+' FT':((g.sz||93)/100).toFixed(2)+' M'],['T',(Math.min(el,dur)/1000).toFixed(2)+' S']]:[[`GOAL`,lbl],...(g.assister?[['ASSIST',(PLAYERS.find(q=>q.name===g.assister)?.short||g.assister).toUpperCase()]]:[]),...(g.defl?[['REDIRECT',g.defl.toUpperCase()]]:[]),['SPEED',kmh!=null?fSpd(kmh).toUpperCase():'—'],['RANGE',fLen(d).toUpperCase()],['IMPACT H',IMP()?(g.iz/100*3.28084).toFixed(1)+' FT':(g.iz/100).toFixed(2)+' M'],['T',(Math.min(el,dur)/1000).toFixed(2)+' S']];
      c.textAlign='left';c.font='10px '+(tok('--mono')||'monospace');
      rows.forEach(([k,v],i)=>{c.fillStyle=K.accA(.6);c.fillText(k,12,20+i*14);c.fillStyle=K.text;c.fillText(v,78,20+i*14);});
      c.strokeStyle=K.accA(.7);c.lineWidth=1.5;const br=(x,y,dx,dy)=>{c.beginPath();c.moveTo(x+dx*12,y);c.lineTo(x,y);c.lineTo(x,y+dy*12);c.stroke();};
      br(4,4,1,1);br(W-4,4,-1,1);br(4,H-4,1,-1);br(W-4,H-4,-1,-1);
      c.fillStyle=K.accA(.07);const sy=(performance.now()/12)%H;c.fillRect(0,sy,W,2);
      c.textAlign='right';c.fillStyle=K.accA(.6);c.fillText(fmtDate(g.m.when)+' · '+g.m.us+'–'+g.m.them+(g.m.win?' W':' L'),W-12,H-10);
    }
  }
}
// The mini 3D map under the goal mouth, in the replay's HUD style: a slow turntable of every goal,
// and the replay of whichever ball is hovered. A click jumps to the full view.
const MINI={seen:false,on:false};
function drawMini(){const cv=$('mini3d');if(!cv||!cv.clientWidth)return;const t=performance.now();
  if(RP.k!=null)return drawReplay();
  render3D(cv,{hud:true,theme:g3Theme,goals:G3.goals,side:G3.side,T:[0,2400,300],D:13000,F:Math.min(cv.clientWidth,cv.clientHeight*1.7)*1.25,
    yaw:MINI.still?-.5:-.5+t/9000,pitch:.55,focus:G3.focus,ft:G3.ft});
  if(G3.focus!=null)return;
  // Idle frame: corner brackets, a scan line and a readout, like the replay.
  const K=PAL3[g3Theme]||PAL3.classic;
  const c=cv.getContext('2d'),W=cv.clientWidth,H=cv.clientHeight,n=G3.goals.length;
  c.strokeStyle=K.accA(.7);c.lineWidth=1.5;const br=(x,y,dx,dy)=>{c.beginPath();c.moveTo(x+dx*12,y);c.lineTo(x,y);c.lineTo(x,y+dy*12);c.stroke();};
  br(4,4,1,1);br(W-4,4,-1,1);br(4,H-4,1,-1);br(W-4,H-4,-1,-1);
  c.fillStyle=K.accA(.07);c.fillRect(0,(t/12)%H,W,2);
  c.font='10px '+(getComputedStyle(document.documentElement).getPropertyValue('--mono').trim()||'monospace');c.textAlign='left';
  c.fillStyle=K.accA(.6);c.fillText(G3.side==='saves'?'SAVES':G3.side==='them'?'AGAINST':'GOALS',12,20);c.fillStyle=K.text;c.fillText(String(n),78,20);
  c.fillStyle=K.accA(.6);c.fillText('STATUS',12,34);c.fillStyle=K.text;c.fillText(n?'HOVER A BALL':'NO DATA',78,34);}
function miniLoop(){if(MINI.on)return;MINI.on=true;const step=()=>{if(!MINI.seen||document.visibilityState!=='visible'||MINI.still){MINI.on=false;return;}drawMini();requestAnimationFrame(step);};requestAnimationFrame(step);}
function draw3D(){const cv=$('map3d');if(!cv)return;
  render3D(cv,{theme:g3Theme,goals:G3.goals,side:G3.side,T:G3.T,D:11500,F:Math.min(cv.clientWidth,cv.clientHeight*1.6)*1.45*G3.zoom,yaw:G3.yaw,pitch:G3.pitch,focus:G3.focus,ft:G3.ft});
  const nm=G3.side==='saves'?'saves with a position':'goals with a shot and net position';
  $('map3dNote').textContent=G3.goals.length?`${G3.goals.length} ${nm}. Drag or use the knob to turn it, arrow keys to move, scroll to zoom. Hover a goal here or a ball on the flat maps to replay it, here and in the mini map.`+(G3.pad&&G3.pad()?` Controller found: ${G3.pad().id.replace(/\s*\(.*$/,'').slice(0,40)}${G3.pad().std?'':' (non-standard layout)'}. Left stick moves, right stick turns, triggers zoom, A or RB next goal, LB previous, B stops, Y resets.`:''):`No ${G3.side==='saves'?'saves':'goals'} with positions in this period.`;
  syncKnob();if(MINI.still||!MINI.on)drawMini();
}
// The knob: its ring turns with the camera (N = looking at the attacked goal), the needle shows tilt.
function syncKnob(){const r=$('knobRing');if(!r)return;r.setAttribute('transform',`rotate(${(-G3.yaw*180/Math.PI).toFixed(1)} 50 50)`);
  const t=$('knobTilt');if(t)t.setAttribute('y2',(50-30*Math.sin(G3.pitch)).toFixed(1));}
function nudge3D(f){G3.auto=false;f();G3.pitch=Math.max(.05,Math.min(1.45,G3.pitch));G3.zoom=Math.max(.6,Math.min(3,G3.zoom));
  G3.T[0]=Math.max(-4096,Math.min(4096,G3.T[0]));G3.T[1]=Math.max(-5120,Math.min(6000,G3.T[1]));draw3D();}
function drawReplay(){
  const cv=$('mini3d'),g=G3.goals.find(x=>x.k===RP.k);if(!cv||!cv.clientWidth||!g)return;
  const wp=waypoints(g),xs=[g.ix].concat(wp.map(t=>t.p[0])),ys=[5120].concat(wp.map(t=>t.p[1])),ox=g.x!=null?g.x:wp[0].p[0],oy=g.y!=null?g.y:wp[0].p[1]-1500;
  const mid=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,300],dx=g.ix-ox,dy=5120-oy,span=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))+1800;
  const yaw=Math.atan2(dx,dy)+0.75+Math.sin((performance.now()-RP.t)/2500)*.12;
  render3D(cv,{hud:true,theme:g3Theme,goals:[g],side:G3.side,T:mid,D:span*1.25,F:Math.min(cv.clientWidth,cv.clientHeight*1.6)*1.05,yaw,pitch:.38,focus:g.k,ft:RP.t});
}
function showReplay(k,ev){
  if(!G3.goals.some(x=>x.k===+k))return;
  if(RP.k===+k)return;
  RP.k=+k;RP.t=performance.now();G3.focus=+k;G3.ft=RP.t;loop3D();
}
function placeReplay(){}
function hideReplay(){RP.k=null;G3.focus=null;draw3D();drawMini();}
let looping=false;
function loop3D(){if(looping)return;looping=true;const step=()=>{if(RP.k==null&&!G3.auto){looping=false;return;}
  if(RP.k!=null)drawReplay();if(G3.seen&&document.visibilityState==='visible')draw3D();requestAnimationFrame(step);};requestAnimationFrame(step);}
(function(){
  const cv=$('map3d');if(!cv)return;let drag=null;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)G3.auto=false;
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw:G3.yaw,pitch:G3.pitch};G3.auto=false;cv.setPointerCapture(e.pointerId);});
  cv.addEventListener('pointermove',e=>{if(!drag)return;G3.yaw=drag.yaw-(e.clientX-drag.x)*.008;G3.pitch=Math.max(.05,Math.min(1.45,drag.pitch+(e.clientY-drag.y)*.006));draw3D();});
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{drag=null;}));
  // Hovering a goal's path or ball in the big view plays its replay, with the same magnetic catch.
  let hov=null;
  cv.addEventListener('pointermove',e=>{if(drag||e.pointerType!=='mouse'||!cv._P||!cv._list)return;
    const rc=cv.getBoundingClientRect(),mx=e.clientX-rc.left,my=e.clientY-rc.top;let best=null,bd=1e9;
    for(const {g,pts} of cv._list){for(let i=0;i<pts.length;i+=3){const q=cv._P(pts[i]),d=Math.hypot(q[0]-mx,q[1]-my);if(d<bd){bd=d;best=g;}}
      const q=cv._P(pts[pts.length-1]),d=Math.hypot(q[0]-mx,q[1]-my)*.7;if(d<bd){bd=d;best=g;}}
    if(hov!=null&&best&&best.k!==hov){const h=cv._list.find(x=>x.g.k===hov);if(h){let hd=1e9;h.pts.forEach(p=>{const q=cv._P(p);hd=Math.min(hd,Math.hypot(q[0]-mx,q[1]-my));});if(hd<=22&&bd>hd*.6){best=h.g;bd=hd;}}}
    if(!best||bd>(hov!=null?22:14)){if(hov!=null){hov=null;cv.style.cursor='';hideReplay();}return;}
    if(hov!==best.k){hov=best.k;cv.style.cursor='pointer';RP.k=null;}
    showReplay(best.k,e);});
  cv.addEventListener('pointerleave',()=>{if(hov!=null){hov=null;cv.style.cursor='';hideReplay();}});
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
  {const mc=$('mini3d');if(mc){MINI.still=matchMedia('(prefers-reduced-motion: reduce)').matches;
    new IntersectionObserver(es=>{MINI.seen=es[0].isIntersecting;if(MINI.seen){drawMini();miniLoop();}}).observe(mc);
    $('mini3dBtn').addEventListener('click',()=>cv.scrollIntoView({behavior:'smooth',block:'center'}));
    window.addEventListener('resize',drawMini);}}
  G3.seen=false;new IntersectionObserver(es=>{G3.seen=es[0].isIntersecting;if(G3.seen&&G3.auto)loop3D();}).observe(cv);
  // Game controller (any pad the browser maps to the standard layout): left stick moves the camera,
  // right stick turns and tilts, triggers zoom, A / RB next goal, LB previous, B stops, Y resets.
  // Browsers only reveal a pad after a button is pressed while the page is open.
  const PAD={on:false,prev:[],k:-1,miss:0,id:'',std:true};
  const dz=v=>Math.abs(v)<.18?0:(v-Math.sign(v)*.18)/.82;
  const focusGoal=step=>{const n=G3.goals.length;if(!n)return;PAD.k=((PAD.k+step)%n+n)%n;const g=G3.goals[PAD.k];
    G3.auto=false;G3.focus=g.k;G3.ft=performance.now();
    const w=waypoints(g),p0=w.length?w[0].p:[g.x,g.y,93];G3.T=[(p0[0]+g.ix)/2,(p0[1]+5120)/2,300];};
  // Wireless pads and adapters often show up as extra entries (a headset, a dongle with no axes) or
  // without the standard layout, so pick the most controller-like one and map loosely when needed.
  const pickPad=()=>{const all=[...(navigator.getGamepads?navigator.getGamepads():[])].filter(x=>x&&x.connected!==false&&x.axes&&x.axes.length>=2&&x.buttons&&x.buttons.length>=4);
    return all.sort((a,b)=>(b.mapping==='standard')-(a.mapping==='standard')||b.timestamp-a.timestamp)[0]||null;};
  const read=gp=>{const ax=gp.axes,B=gp.buttons,v=i=>B[i]?(B[i].value||(B[i].pressed?1:0)):0,bt=B.map(b=>!!b&&(b.pressed||b.value>.5));
    if(gp.mapping==='standard')return {ax:[ax[0],ax[1],ax[2],ax[3]],bt,lt:v(6),rt:v(7)};
    // Non-standard: right stick is usually axes 2/3, or 3/4 when a trigger sits on axis 2, or 2/5 (PlayStation pads).
    const n=ax.length,trig=x=>x!=null&&Math.abs(x+1)<.05;let r=[2,3],lt=0,rt=0;
    if(n>=6&&trig(ax[3])&&trig(ax[4])){r=[2,5];lt=(ax[3]+1)/2;rt=(ax[4]+1)/2;}
    else if(n>=5&&trig(ax[2])){r=[3,4];lt=(ax[2]+1)/2;rt=n>5?(ax[5]+1)/2:0;}
    return {ax:[ax[0],ax[1],ax[r[0]]||0,ax[r[1]]||0],bt,lt:Math.max(lt,v(6)),rt:Math.max(rt,v(7))};};
  const padLoop=()=>{const gp=pickPad();
    if(!gp){if(++PAD.miss>120){PAD.on=false;draw3D();return;}requestAnimationFrame(padLoop);return;}   // ride out brief Bluetooth drop-outs
    PAD.miss=0;if(gp.id!==PAD.id||(gp.mapping==='standard')!==PAD.std){PAD.id=gp.id;PAD.std=gp.mapping==='standard';draw3D();}
    const {ax,bt,lt,rt}=read(gp),hit=i=>bt[i]&&!PAD.prev[i];
    if(document.visibilityState==='visible'){
      // Any button while the 3D map is off screen brings it into view.
      if(!G3.seen){if(bt.some((b,i)=>b&&!PAD.prev[i]))$('map3d').scrollIntoView({behavior:'smooth',block:'center'});}
      else{
      const lx=dz(ax[0]||0)+(bt[15]?1:0)-(bt[14]?1:0),ly=dz(ax[1]||0)+(bt[13]?1:0)-(bt[12]?1:0),rx=dz(ax[2]||0),ry=dz(ax[3]||0),zm=rt-lt;
      const moved=lx||ly||rx||ry||Math.abs(zm)>.05;
      if(moved){G3.auto=false;const fw=[Math.sin(G3.yaw),Math.cos(G3.yaw)],rgt=[fw[1],-fw[0]],st=bt[10]?110:45;
        G3.T[0]+=(rgt[0]*lx-fw[0]*ly)*st;G3.T[1]+=(rgt[1]*lx-fw[1]*ly)*st;G3.yaw-=rx*.04;G3.pitch+=ry*.025;G3.zoom*=Math.exp(zm*.03);}
      if(hit(0)||hit(5))focusGoal(1);if(hit(4))focusGoal(-1);
      if(hit(1)){G3.focus=null;PAD.k=-1;}
      if(hit(3)){G3.yaw=-.5;G3.pitch=.42;G3.zoom=1;G3.T=[0,3300,300];G3.focus=null;PAD.k=-1;}
      if(moved||G3.focus!=null||bt.some(Boolean))nudge3D(()=>{});}
    }
    PAD.prev=bt;requestAnimationFrame(padLoop);};
  const startPad=()=>{if(PAD.on||!pickPad())return;PAD.on=true;PAD.miss=0;draw3D();requestAnimationFrame(padLoop);};
  window.addEventListener('gamepadconnected',startPad);
  // Some browsers never fire the event for a pad that was already paired, so also check now and then.
  setInterval(startPad,1000);
  G3.pad=()=>PAD.on?PAD:null;
  // Slow sway until someone grabs it.
  const sway=t=>{if(!G3.auto)return;G3.yaw=-.5+Math.sin((t-G3.t0)/6000)*.6;requestAnimationFrame(sway);};
  requestAnimationFrame(sway);
})();

// ---------- defense ----------
function renderDefense(list){
  const sl=list.filter(m=>m.defSaves),saves=sl.flatMap(m=>m.defSaves.map(s=>({...s,m}))),pts=saves.filter(s=>s.x!=null&&s.y!=null);
  const tip=s=>`${s.who>=0?PLAYERS[s.who].short:'Us'}${s.epic?' · epic save':''} · ${s.m.us}–${s.m.them} ${s.m.win?'win':'loss'}, ${fmtDate(s.m.when)}`;
  $('saveMap').innerHTML=fieldMap(pts,'save',tip,'Their goal','Our goal');
  const ol=list.filter(m=>m.oppShots!=null),shots=ol.reduce((a,m)=>a+m.oppShots,0),goals=ol.reduce((a,m)=>a+m.oppGoals,0);
  $('defCallouts').innerHTML=[['Opponent shots / game',ol.length?(shots/ol.length).toFixed(1):'–'],['Opponent shooting %',shots?Math.round(100*goals/shots)+'%':'–']]
    .map(c=>`<div class="callout"><span class="k">${c[0]}</span><span class="v num">${c[1]}</span></div>`).join('');
  // Our box is the rectangle drawn in front of our goal.
  const box=pts.filter(s=>s.y<=-4020&&Math.abs(s.x)<=1800).length;
  const by=PLAYERS.map((p,j)=>{const n=saves.filter(s=>s.who===j).length;return n?p.short+' '+n:null;}).filter(Boolean).join(', ');
  $('saveNote').textContent=!sl.length?'No saves recorded with positions in this period yet.':
    `${saves.length} save${saves.length===1?'':'s'} in ${sl.length} game${sl.length===1?'':'s'}${by?' ('+by+')':''}.`+(pts.length?` ${Math.round(100*box/pts.length)}% were inside our box.`:'');
}

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
  renderDayStreaks();
}
// Days played in a row, and the longest break, across every playlist.
function renderDayStreaks(){const el=$('dayStreaks');if(!el)return;
  const key=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const days=[...new Set(DONE.map(m=>key(m.when)))].sort((a,b)=>a-b);
  if(!days.length){el.innerHTML='';return;}
  const diff=(a,b)=>Math.round((b-a)/DAY);   // whole days (rounding absorbs daylight-saving hours)
  let run=1,best={n:1,a:days[0],b:days[0]},gap={n:0,a:null,b:null},s=days[0];
  for(let i=1;i<days.length;i++){const d=diff(days[i-1],days[i]);
    if(d===1){run++;}else{run=1;s=days[i];if(d-1>gap.n)gap={n:d-1,a:days[i-1],b:days[i]};}
    if(run>best.n)best={n:run,a:s,b:days[i]};}
  const today=key(new Date(NOW)),last=days[days.length-1],since=diff(last,today);
  let cur=0;if(since<=1){cur=1;for(let i=days.length-1;i>0&&diff(days[i-1],days[i])===1;i--)cur++;}
  const f=t=>fmtDate(new Date(t)),pl=n=>n+' day'+(n===1?'':'s');
  el.innerHTML=[['Most days in a row',pl(best.n),best.n>1?`${f(best.a)} to ${f(best.b)}`:f(best.a)],
    ['Longest break',gap.n?pl(gap.n):'–',gap.n?`${f(gap.a)} to ${f(gap.b)}`:'never missed a day'],
    since<=1?['Current run',pl(cur),since===0?'played today':'played yesterday']:['Days since we played',pl(since),'last on '+f(last)]]
    .map(c=>`<div class="callout"><span class="k">${c[0]}</span><span class="v num">${c[1]}</span><span class="muted small">${c[2]}</span></div>`).join('');}

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
      return `<tr><td><a href="#m-${esc(m.guid)}" class="mlink" title="Open this match">${fmtDate(m.when)} ${fmtTime(m.when)}</a></td><td><span class="pill ${m.win?'w':'l'}">${m.win?'W':'L'}</span></td><td>${m.us}–${m.them}${m.ot?' <span class="muted">OT</span>':''}</td><td>${esc(m.arena)}</td>${L.map(l=>`<td>${line(l)}</td>`).join('')}<td>${top<0?'–':`<span class="tag ${PLAYERS[top].tag}" style="padding:0 7px"><i></i>${esc(PLAYERS[top].short)} ${L[top].score}</span>`}</td><td class="opps">${m.opps.length?m.opps.map(o=>`<a href="${esc(o.url)}" target="_blank" rel="noopener" title="View ${esc(o.name)} on tracker.gg">${esc(o.name)}</a>${facedBadge(o.name)}`).join('<br>'):'–'}</td><td class="notes">${notes(m)}</td></tr>`;}).join('')+'</tbody>';
}

// "Played before" badge: how many games against this opponent and our record, shown from the 2nd meeting.
function facedBadge(name,long){const f=FACED[String(name).toLowerCase()];if(!f||f.n<2)return '';const l=f.n-f.w;
  const tip=`Played ${f.n} times: ${f.w} won, ${l} lost. Last: ${f.list.slice(-3).reverse().map(m=>`${m.win?'W':'L'} ${m.us}–${m.them} ${fmtDate(m.when)}`).join(', ')}`;
  return ` <span class="faced ${f.w>l?'up':f.w<l?'down':''}" title="${esc(tip)}">${long?`played ${f.n}×, `:`×${f.n} `}${f.w}–${l}</span>`;}
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
function renderPeriod(){renderRecords();const list=inPeriod();renderSummary(list);renderCmp(list);renderMaps(list);renderDefense(list);renderPlay(list);renderCrowd(list);renderSwing(list);renderLog(list);syncButtons();renderInsights(list);}
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

// Header calendar: this month, Monday first, days with a game lit. No numbers, just the marks.
function renderCal(){const el=$('hcal');if(!el)return;const now=new Date(NOW),y=now.getFullYear(),mo=now.getMonth();
  const played={};DONE.forEach(m=>{const k=m.when.toDateString();played[k]=(played[k]||0)+1;});
  const first=(new Date(y,mo,1).getDay()+6)%7,days=new Date(y,mo+1,0).getDate();let h='<i class="x"></i>'.repeat(first);
  for(let d=1;d<=days;d++){const dt=new Date(y,mo,d),n=played[dt.toDateString()];
    h+=`<i class="${n?'on':''}${dt.toDateString()===now.toDateString()?' today':''}"${n?` title="${esc(fmtDay(dt))}: ${n} game${n>1?'s':''}"`:''}></i>`;}
  el.innerHTML=h;el.setAttribute('aria-label',`${now.toLocaleDateString('en-US',{month:'long'})}: played on ${Object.keys(played).filter(k=>{const d=new Date(k);return d.getMonth()===mo&&d.getFullYear()===y;}).length} days`);}
function renderAll(){
  build();
  if(!ALL.length){$('banner').hidden=false;$('banner').textContent=party==='solo'&&!DONE.length?'No solo games yet. The widget saves every game it sees, so games with just one of us show up here from now on.':party==='duo'&&!DONE.length?'No games with both of us yet.':'No finished matches for this playlist yet.';return;}
  $('banner').hidden=!SAMPLE;if(!SAMPLE)$('banner').textContent='';
  renderCal();renderPeriod();renderLastSession();renderStrip();renderTrend();renderMMR();renderWarmups();renderMotion();
}
$('units').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;units=b.dataset.u;saveUi();syncUnits();renderAll();});
function syncUnits(){$('units').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.u===units)));}
syncUnits();
$('period').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;period=b.dataset.p;saveUi();renderPeriod();});
$('mode').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;mode=b.dataset.m;saveUi();renderCmp(inPeriod());syncButtons();});
$('metric').innerHTML=METRICS.map(m=>`<button type="button" data-k="${m.k}">${m.label}</button>`).join('');
$('metric').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;metric=b.dataset.k;saveUi();syncButtons();renderTrend();});
$('party').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;party=b.dataset.p;saveUi();renderAll();});
$('playlist').addEventListener('change',e=>{playlist=e.target.value;saveUi();renderAll();});
// Look of the heatmaps and of the 3D maps, each picked on its own and remembered.
function applyThemes(){document.documentElement.classList.toggle('neon',look==='neon');document.documentElement.classList.toggle('night',look==='night');
  document.body.classList.toggle('hm-night',hmTheme==='night');document.body.classList.toggle('g3-night',g3Theme==='night');
  const tb=$('themeBtn');if(tb){tb.dataset.t=look;tb.title='Theme: '+look[0].toUpperCase()+look.slice(1);}
  document.querySelectorAll('#lookTheme button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===look));
  document.body.classList.toggle('hm-neon',hmTheme==='neon');document.body.classList.toggle('g3-neon',g3Theme==='neon');
  document.querySelectorAll('#hmTheme button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===hmTheme));
  document.querySelectorAll('#g3Theme button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===g3Theme));}
applyThemes();
// The global Look switch themes the whole page and sets both map looks to match; each map can still be changed after.
$('lookTheme').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||!b.dataset.t)return;closeWheel();look=hmTheme=g3Theme=b.dataset.t;saveUi();applyThemes();renderAll();draw3D();drawMini();if(ART.m)artStart(ART.m);});
// Theme icon: opens a round four-way picker. The fourth slot is kept for a theme still to come.
function closeWheel(){const w=$('themeWheel');if(w)w.hidden=true;const t=$('themeBtn');if(t)t.setAttribute('aria-expanded','false');}
$('themeBtn').addEventListener('click',e=>{e.stopPropagation();const w=$('themeWheel'),open=w.hidden;w.hidden=!open;$('themeBtn').setAttribute('aria-expanded',String(open));});
document.addEventListener('click',e=>{if(!e.target.closest('#themeWheel,#themeBtn'))closeWheel();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeWheel();});
$('hmTheme').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;hmTheme=b.dataset.t;saveUi();applyThemes();renderAll();});
$('g3Theme').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;g3Theme=b.dataset.t;saveUi();applyThemes();draw3D();drawMini();});
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

// ---------- player pictures ----------
// Each player's picture replaces the colour square in their tags, ringed in their colour.
let AV={};
function applyAvatars(){const root=document.documentElement;
  PLAYERS.forEach((p,j)=>{const u=AV[p.name];if(u)root.style.setProperty('--av'+(j+1),`url("${u}")`);else root.style.removeProperty('--av'+(j+1));root.classList.toggle('has-av'+(j+1),!!u);});
  for(let j=PLAYERS.length;j<4;j++){root.classList.remove('has-av'+(j+1));root.style.removeProperty('--av'+(j+1));}}
// Crop to a square and shrink to 256 px in the browser, so uploads stay small.
function squareImage(file){return new Promise((ok,fail)=>{const u=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{const n=Math.min(im.naturalWidth,im.naturalHeight),c=document.createElement('canvas');c.width=c.height=256;
    c.getContext('2d').drawImage(im,(im.naturalWidth-n)/2,(im.naturalHeight-n)/2,n,n,0,0,256,256);URL.revokeObjectURL(u);
    let d=c.toDataURL('image/webp',.86);if(!d.startsWith('data:image/webp'))d=c.toDataURL('image/jpeg',.88);ok(d);};
  im.onerror=()=>{URL.revokeObjectURL(u);fail(new Error('That file isn\'t a picture this browser can read.'));};im.src=u;});}
async function postAvatar(body){const r=await fetch('/api/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Upload failed');AV=j.avatars||{};applyAvatars();}
(function(){const menu=document.createElement('div');menu.className='avmenu';menu.hidden=true;document.body.appendChild(menu);
  const pick=document.createElement('input');pick.type='file';pick.accept='image/png,image/jpeg,image/webp,image/gif';pick.hidden=true;document.body.appendChild(pick);
  let who=null;const close=()=>{menu.hidden=true;};
  document.addEventListener('click',e=>{const b=e.target.closest('#playerTags .avbtn');
    if(b){e.stopPropagation();if(!menu.hidden&&who===PLAYERS[+b.dataset.j]){close();return;}who=PLAYERS[+b.dataset.j];const r=b.getBoundingClientRect();
      menu.innerHTML=`<b>${esc(who.name)}</b><button type="button" data-a="up">${AV[who.name]?'Change picture':'Upload picture'}</button>`+(AV[who.name]?'<button type="button" data-a="rm">Remove picture</button>':'')+'<span class="avmsg"></span>';
      menu.style.left=Math.max(8,Math.min(innerWidth-220,r.left))+'px';menu.style.top=(r.bottom+6+scrollY)+'px';menu.hidden=false;return;}
    if(!menu.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  menu.addEventListener('click',async e=>{const a=e.target.closest('button[data-a]');if(!a||!who)return;
    if(a.dataset.a==='up')pick.click();
    if(a.dataset.a==='rm'){try{await postAvatar({player:who.name,remove:true});close();}catch(x){menu.querySelector('.avmsg').textContent=x.message;}}});
  pick.addEventListener('change',async()=>{const f=pick.files[0];pick.value='';if(!f||!who)return;const msg=menu.querySelector('.avmsg');
    try{if(msg)msg.textContent='Uploading…';await postAvatar({player:who.name,image:await squareImage(f)});close();}catch(x){if(msg)msg.textContent=x.message;}});
})();

// ---------- time since each player's last goal ----------
let LASTGOAL=[];
function tickSince(){const now=Date.now();
  document.querySelectorAll('#playerTags .since').forEach(el=>{const t=LASTGOAL[+el.dataset.j];
    if(t==null){sinceSet(el,'No goals yet');return;}
    let s=Math.max(0,Math.floor((now-t)/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;
    const pad=n=>String(n).padStart(2,'0');
    sinceSet(el,(d?d+'d ':'')+(d||h?pad(h)+'h ':'')+pad(m)+'m '+pad(s)+'s');
    el.title='Last goal '+new Date(t).toLocaleString();});}
// Two lines the width of the name card: the time in a green pill, "since last goal" under it
// in purple digital type stretched to the same width. Sizes are refit only when the length changes.
function sinceSet(el,txt){
  if(!el.firstChild||el.firstChild.className!=='sp')el.innerHTML='<b class="sp"></b><i class="sl">since last goal</i>';
  const sp=el.firstChild,sl=el.lastChild;sp.textContent=txt;
  if(el._len===txt.length&&el._w===el.clientWidth)return;el._len=txt.length;el._w=el.clientWidth;
  const fit=(node,max)=>{node.style.fontSize='20px';const cs=getComputedStyle(node),padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
    const r=document.createRange();r.selectNodeContents(node);const w=r.getBoundingClientRect().width;const room=el.clientWidth-padX;
    if(w&&room>0)node.style.fontSize=Math.min(max,20*room/w).toFixed(2)+'px';};
  fit(sp,14);
  // The caption matches the time's text width, not the pill's.
  const r=document.createRange();r.selectNodeContents(sp);const tw=r.getBoundingClientRect().width;
  sl.style.fontSize='20px';sl.style.padding='0';const r2=document.createRange();r2.selectNodeContents(sl);const cw=r2.getBoundingClientRect().width;
  if(tw&&cw)sl.style.fontSize=(20*tw/cw).toFixed(2)+'px';}
setInterval(tickSince,1000);
if(document.fonts)document.fonts.ready.then(()=>{document.querySelectorAll('#playerTags .since').forEach(el=>el._len=null);tickSince();});

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
  $('playerTags').innerHTML=PLAYERS.map((p,j)=>`<span class="ptag"><button type="button" class="tag ${p.tag} avbtn" data-j="${j}" title="Set ${esc(p.short)}'s picture"><i></i>${esc(p.name)}</button><span class="since num" data-j="${j}"></span></span>`).join('');
  AV=data.avatars||{};applyAvatars();
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
  // When each player last scored: match start plus the goal's time in the match (every playlist).
  LASTGOAL=PLAYERS.map(p=>{let t=null;(RAW.matches||[]).forEach(m=>{const st=Date.parse(m&&m.started_at);if(!st)return;
    (m.goals||[]).forEach(g=>{if(g&&g.scorer===p.name&&+g.goal_time>0){const at=st+g.goal_time*1000;if(t==null||at>t)t=at;}});});return t;});
  tickSince();
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
    (m.tl?`<h3>Timelapse</h3>${tlMarkup('tl')}<p class="muted" style="margin:4px 0 0">Each car is drawn where it touched the ball, gliding between its touches, since the game doesn't send positions in between. We attack to the right.</p>`:'')+
    `<h3>Opponents</h3><p>${m.opps.length?m.opps.map(o=>`<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>${facedBadge(o.name,true)}`).join(' · '):'<span class="muted">Not recorded</span>'}</p>`;
  const d=$('matchDlg');if(!d.open){if(d.showModal)d.showModal();else d.setAttribute('open','');}
  if(m.tl)startTimelapse(m,'tl',()=>$('matchDlg').open);
  return true;
}
// ---------- touch timelapse ----------
// The Stats API has no car positions, only where each touch happened. Each car glides from one of
// its touches to the next; if it went a long time without touching the ball it fades until the next one.
const tlMarkup=pre=>`<div class="tlapse"><canvas id="${pre}Cv"></canvas><div class="tlbar"><button type="button" id="${pre}Play" class="chipbtn">Pause</button><input type="range" id="${pre}Pos" min="0" max="1000" value="0" aria-label="Match time"><span id="${pre}Time" class="num muted"></span><div class="seg" id="${pre}Speed"><button type="button" data-x="10">10×</button><button type="button" data-x="30" aria-pressed="true">30×</button><button type="button" data-x="60">60×</button></div></div></div>`;
// One player per canvas: the match dialog ('tl') and the dashboard panel ('tlp') each run their own.
const TLS={};
function startTimelapse(m,pre,alive){const TL=TLS[pre]||(TLS[pre]={x:30,raf:0});TL.m=m;TL.t=m.tl[0].t;TL.play=true;TL.alive=alive;
  $(pre+'Play').textContent='Pause';
  $(pre+'Play').onclick=()=>{TL.play=!TL.play;$(pre+'Play').textContent=TL.play?'Pause':'Play';runTimelapse(pre);};
  $(pre+'Pos').oninput=e=>{const a=TL.m.tl[0].t,b=TL.m.tl[TL.m.tl.length-1].t;TL.t=a+(b-a)*e.target.value/1000;drawTimelapse(pre);};
  $(pre+'Speed').onclick=e=>{const b=e.target.closest('button');if(!b)return;TL.x=+b.dataset.x;$(pre+'Speed').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));};
  $(pre+'Speed').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.x===TL.x));
  runTimelapse(pre);}
function runTimelapse(pre){const TL=TLS[pre];if(!TL||!TL.m)return;cancelAnimationFrame(TL.raf);TL.last=performance.now();
  const m=TL.m,step=now=>{if(!TL.alive()||TL.m!==m||!$(pre+'Cv')){TL.raf=0;return;}
    if(TL.play){TL.t+=(now-TL.last)/1000*TL.x;const end=m.tl[m.tl.length-1].t+2;if(TL.t>end)TL.t=m.tl[0].t;}
    TL.last=now;drawTimelapse(pre);TL.raf=requestAnimationFrame(step);};TL.raf=requestAnimationFrame(step);}
function drawTimelapse(pre){const TL=TLS[pre],m=TL&&TL.m,cv=$(pre+'Cv');if(!m||!cv)return;
  const W=cv.clientWidth,H=cv.clientHeight,dpr=window.devicePixelRatio||1;if(!W||!H)return;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const css=getComputedStyle(document.documentElement),tok=n=>css.getPropertyValue(n).trim();
  // Landscape pitch: our attack runs left to right, so the shooter's right (+x) is down the screen.
  const sc=Math.min((W-20)/12000,(H-20)/8192),X=y=>W/2+y*sc,Y=x=>H/2+x*sc,ch=1152;
  c.fillStyle=tok('--pitch');c.strokeStyle=tok('--pitch-line');c.lineWidth=1.5;
  const fl=[[-4096,-5120+ch],[-4096+ch,-5120],[4096-ch,-5120],[4096,-5120+ch],[4096,5120-ch],[4096-ch,5120],[-4096+ch,5120],[-4096,5120-ch]];
  c.beginPath();fl.forEach(([x,y],i)=>i?c.lineTo(X(y),Y(x)):c.moveTo(X(y),Y(x)));c.closePath();c.fill();c.stroke();
  c.beginPath();c.moveTo(X(0),Y(-4096));c.lineTo(X(0),Y(4096));c.stroke();c.beginPath();c.arc(X(0),Y(0),1000*sc,0,7);c.stroke();
  [[1,tok('--win')],[-1,tok('--muted')]].forEach(([sd,col])=>{c.strokeStyle=col;c.lineWidth=2;c.strokeRect(Math.min(X(5120*sd),X(6000*sd)),Y(-893),880*sc,1786*sc);});
  const t=TL.t,tl=m.tl,col=p=>{const j=PLAYERS.findIndex(q=>q.name===p);return j>=0?tok('--p'+(j+1)):tok('--opp');};
  // Ball: along the touches in order.
  let i=0;while(i<tl.length-1&&tl[i+1].t<=t)i++;const a=tl[i],b=tl[Math.min(i+1,tl.length-1)],u=b.t>a.t?Math.min(1,Math.max(0,(t-a.t)/(b.t-a.t))):0;
  // Cars: each player's previous and next touch.
  const names=[...new Set(tl.map(x=>x.p))];c.font='600 11px '+(tok('--display')||'sans-serif');c.textAlign='center';
  names.forEach(p=>{const mine=tl.filter(x=>x.p===p);let k=-1;for(let q=0;q<mine.length;q++)if(mine[q].t<=t)k=q;
    if(k<0)return;const A=mine[k],B=mine[k+1]||A,gap=B.t-A.t,w=gap>0?Math.min(1,(t-A.t)/gap):0,cx=A.x+(B.x-A.x)*w,cy=A.y+(B.y-A.y)*w,cc=col(p);
    const fade=gap>12&&w>.15&&w<.85?.35:1;
    c.globalAlpha=.35*fade;c.strokeStyle=cc;c.lineWidth=1.5;c.beginPath();mine.slice(Math.max(0,k-4),k+1).forEach((q,n)=>n?c.lineTo(X(q.y),Y(q.x)):c.moveTo(X(q.y),Y(q.x)));c.lineTo(X(cy),Y(cx));c.stroke();
    c.globalAlpha=fade;c.fillStyle=cc;c.beginPath();c.arc(X(cy),Y(cx),6,0,7);c.fill();c.strokeStyle=tok('--surface');c.lineWidth=1.5;c.stroke();
    const j=PLAYERS.findIndex(q=>q.name===p);c.fillStyle=tok('--ink');c.fillText(j>=0?PLAYERS[j].short:p.slice(0,10),X(cy),Y(cx)-10);c.globalAlpha=1;});
  const bx=a.x+(b.x-a.x)*u,by=a.y+(b.y-a.y)*u;c.fillStyle='#f4f6f8';c.strokeStyle='#7d8692';c.lineWidth=1;c.beginPath();c.arc(X(by),Y(bx),4,0,7);c.fill();c.stroke();
  const sc0=m.goalAt.filter(g=>g.t<=t);const us=sc0.filter(g=>g.ours).length,them=sc0.length-us,last=sc0[sc0.length-1];
  c.textAlign='left';c.font='600 13px '+(tok('--mono')||'monospace');c.fillStyle=tok('--ink');c.fillText(`${us}–${them}`,10,18);
  if(last&&t-last.t<6){c.globalAlpha=1-(t-last.t)/6;c.textAlign='center';c.font='700 22px '+(tok('--display')||'sans-serif');c.fillStyle=last.ours?tok('--win'):tok('--loss');
    const j=PLAYERS.findIndex(q=>q.name===last.who);c.fillText('GOAL'+(j>=0?' · '+PLAYERS[j].short.toUpperCase():''),W/2,H/2-30);c.globalAlpha=1;}
  const a0=tl[0].t,b0=tl[tl.length-1].t;$(pre+'Pos').value=Math.round(1000*Math.min(1,(t-a0)/((b0-a0)||1)));
  $(pre+'Time').textContent=fmtDur(Math.max(0,Math.round(t-a0)))+' / '+fmtDur(Math.round(b0-a0));}
// ---------- dashboard panels: timelapse and spirograph ----------
const MOT={tlg:null,seen:false,obs:false};
const ART={m:null,i:0,n:6,raf:0,seen:false,segs:[],W:0};
const motionMatches=()=>ALL.filter(m=>m.tl&&m.tl.length>1).slice().sort((a,b)=>b.when-a.when);
const mLabel=m=>`${m.win?'W':'L'} ${m.us}–${m.them} · ${fmtDate(m.when)} ${fmtTime(m.when)} · ${m.arena}`;
function fillPick(sel,list){const keep=sel.value;sel.innerHTML=list.map(m=>`<option value="${esc(m.guid)}">${esc(mLabel(m))}</option>`).join('');
  if(list.some(m=>String(m.guid)===keep))sel.value=keep;sel.disabled=!list.length;}
function renderMotion(){
  const list=motionMatches(),pick=sel=>list.find(m=>String(m.guid)===sel.value)||list[0];
  fillPick($('tlpMatch'),list);fillPick($('artMatch'),list);
  if(!MOT.obs){MOT.obs=true;
    new IntersectionObserver(es=>{MOT.seen=es[0].isIntersecting;if(MOT.seen&&TLS.tlp&&!TLS.tlp.raf)runTimelapse('tlp');}).observe($('tlpBody'));
    new IntersectionObserver(es=>{ART.seen=es[0].isIntersecting;if(ART.seen)artRun();}).observe($('artCv'));
    $('tlpMatch').onchange=()=>{MOT.tlg=null;renderMotion();};
    $('artMatch').onchange=()=>{ART.m=null;renderMotion();};
    $('artRedraw').onclick=()=>{if(ART.m)artStart(ART.m);};
    $('artSym').onclick=e=>{const b=e.target.closest('button');if(!b)return;ART.n=+b.dataset.n;$('artSym').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));if(ART.m)artStart(ART.m);};
    let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(ART.m&&$('artCv').clientWidth!==ART.W)artPaint(true);},200);});}
  if(!list.length){MOT.tlg=null;ART.m=null;
    $('tlpBody').innerHTML='<p class="muted">No games with touch data yet. Click Check updates on the widget, then play a game.</p>';
    const cv=$('artCv');cv.getContext('2d').clearRect(0,0,cv.width,cv.height);$('artKey').textContent='Needs a game with touch data.';return;}
  const tm=pick($('tlpMatch'));
  if(MOT.tlg!==tm.guid){MOT.tlg=tm.guid;$('tlpBody').innerHTML=tlMarkup('tlp');startTimelapse(tm,'tlp',()=>MOT.seen);}
  const am=pick($("artMatch"));if(!ART.m||ART.m.guid!==am.guid)artStart(am);
}
// A spirograph per thing on the pitch: the ball and every car each trace one continuous hypotrochoid
// through the match. The pen goes round once every few seconds of game time; how far up the pitch
// it was (towards their goal = wider) sets the big circle, how high off the ground sets the little
// rolling circle, and side to side nudges the angle. Goals leave a ring. Petals sets how fast the little circle spins.
function artSegments(m){
  const tl=m.tl,t0=tl[0].t,t1=tl[tl.length-1].t,col=p=>{const j=PLAYERS.findIndex(q=>q.name===p);return j>=0?'--p'+(j+1):'--opp';};
  const track=pts=>t=>{let i=0;while(i<pts.length-1&&pts[i+1].t<=t)i++;const A=pts[i],B=pts[Math.min(i+1,pts.length-1)];
    let u=B.t>A.t?clamp((t-A.t)/(B.t-A.t),0,1):0;u=u*u*(3-2*u);return {x:A.x+(B.x-A.x)*u,y:A.y+(B.y-A.y)*u,z:(A.z||0)+((B.z||0)-(A.z||0))*u};};
  const ents=[{at:track(tl),c:'--ball',R:.5,Ry:.16,r:.14,rz:.22,k:ART.n+.3,a:.4,w:.9}];
  [...new Set(tl.map(x=>x.p))].forEach((p,n)=>{const mine=tl.filter(x=>x.p===p);if(mine.length<2)return;
    ents.push({at:track(mine),c:col(p),R:.28+.06*(n%3),Ry:.14,r:.2,rz:.1,k:(n%2?-1:1)*(ART.n*.7+.17*n+.12),a:.3,w:.8});});
  const P=14,dt=1/24,out=[];
  for(let a=t0;a<t1;a+=1){const b=Math.min(t1,a+1);
    ents.forEach(e=>{const pts=[];for(let t=a;t<=b+1e-6;t+=dt){const s=e.at(t),th=2*Math.PI*(t-t0)/P+.5*s.x/4096,
        R=e.R+e.Ry*s.y/5120,r=e.r+e.rz*Math.min(1,s.z/1800);
        pts.push([R*Math.cos(th)+r*Math.cos(e.k*th),R*Math.sin(th)+r*Math.sin(e.k*th)]);}
      out.push({t:a,c:e.c,a:e.a,w:e.w,pts});});}
  (m.goalAt||[]).forEach((g,n)=>out.push({t:g.t,ring:.97-n*.018,c:g.ours?'--win':'--loss',a:.8,w:1.6}));
  return out.sort((a,b)=>a.t-b.t);}
function artStart(m){ART.m=m;ART.segs=artSegments(m);ART.i=0;artPaint(true);
  const names=[...new Set(m.tl.map(x=>x.p))],ours=PLAYERS.filter(p=>names.includes(p.name));
  $('artKey').innerHTML=ours.map(p=>`<span class="akey"><i style="background:var(--p${PLAYERS.indexOf(p)+1})"></i>${esc(p.short)}</span>`).join('')+
    (names.some(n=>!PLAYERS.some(p=>p.name===n))?'<span class="akey"><i style="background:var(--opp)"></i>Opponents</span>':'')+
    `<span class="num">${m.tl.length} touches</span>`;
  artRun();}
function artPaint(clear){const cv=$('artCv'),W=cv.clientWidth,dpr=window.devicePixelRatio||1;if(!W)return;
  if(clear||ART.W!==W){ART.W=W;cv.width=cv.height=Math.round(W*dpr);const c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
    const n=ART.i;ART.i=0;artDraw(n);}}
function artDraw(upto){const cv=$('artCv'),c=cv.getContext('2d'),S=cv.width/2,R=S*.9;if(!S)return;
  const css=getComputedStyle(document.documentElement),cache={},tok=n=>cache[n]||(cache[n]=css.getPropertyValue(n).trim()||'#fff');
  c.save();c.globalCompositeOperation='lighter';c.lineJoin='round';const dpr=cv.width/(ART.W||1);
  for(;ART.i<Math.min(upto,ART.segs.length);ART.i++){const g=ART.segs[ART.i];c.strokeStyle=tok(g.c);c.globalAlpha=g.a;c.lineWidth=g.w*dpr;
    if(g.ring){c.beginPath();c.arc(S,S,g.ring*R,0,2*Math.PI);c.stroke();continue;}
    c.beginPath();g.pts.forEach(([x,y],q)=>q?c.lineTo(S+R*x,S+R*y):c.moveTo(S+R*x,S+R*y));c.stroke();}
  c.restore();}
function artRun(){cancelAnimationFrame(ART.raf);ART.raf=0;if(!ART.m||!ART.seen)return;
  const per=Math.max(1,ART.segs.length/(12*60)),step=()=>{if(!ART.seen||ART.i>=ART.segs.length){ART.raf=0;return;}
    if(ART.W!==$('artCv').clientWidth)artPaint(false);artDraw(ART.i+per);ART.raf=requestAnimationFrame(step);};
  ART.raf=requestAnimationFrame(step);}
// ---------- insight panels ----------
// Shot map, demo rivalries, kickoffs, touch heatmaps, momentum, trophy case, post hits, MMR per
// session, boost at goals against, duo synergy and hardest shots. Each is its own panel in
// index.html, so the layout system makes them movable.

const IN={shotWho:'all',touchWho:0,postSide:'us',momG:null,mmrS:null,fastSide:'us'};
const pIx=n=>PLAYERS.findIndex(p=>p.name===n);
const pShort=n=>{const j=pIx(n);return j>=0?PLAYERS[j].short:n;};
const ourTeam=m=>num(m.raw&&m.raw.my_team);
// World point turned so the given team attacks +Y (left-handed axes: X turns with Y).
const turn=(o,team)=>{const f=team===1?-1:1;return {x:-f*(+o.x||0),y:f*(+o.y||0),z:+o.z||0};};
const iPct=(a,b)=>b?Math.round(100*a/b)+'%':'–';
const segHtml=(id,opts,cur)=>`<div class="seg" id="${id}" role="group">${opts.map(([v,l])=>`<button type="button" data-v="${esc(v)}" aria-pressed="${String(v)===String(cur)}">${esc(l)}</button>`).join('')}</div>`;
const needNote=what=>`<p class="note">${what} needs games recorded after you click <b>Check updates</b> on the widget.</p>`;
const callouts=rows=>`<div class="callouts">${rows.map(c=>`<div class="callout"><span class="k">${esc(c[0])}</span><span class="v num">${c[1]}</span>${c[2]?`<span class="muted small">${c[2]}</span>`:''}</div>`).join('')}</div>`;
const tagOf=j=>j>=0?`<span class="tag p${j+1}"><i></i>${esc(PLAYERS[j].short)}</span>`:'<span class="muted">Opponent</span>';

// Half pitch, their goal at the top (y 0..5120 shown, plus the net).
function halfPitch(W,inner){
  const Y0=-400,Y1=6000,H=Math.round(W*(Y1-Y0)/8192),sx=x=>(x+4096)/8192*W,sy=y=>(Y1-y)/(Y1-Y0)*H,su=u=>u/8192*W,ch=1152;
  const ln='stroke="var(--pitch-line)" stroke-width="1.5" fill="none"';
  const out=`M${sx(-4096)},${sy(Y0)} L${sx(-4096)},${sy(5120-ch)} L${sx(-4096+ch)},${sy(5120)} L${sx(-893)},${sy(5120)} L${sx(-893)},${sy(6000)} L${sx(893)},${sy(6000)} L${sx(893)},${sy(5120)} L${sx(4096-ch)},${sy(5120)} L${sx(4096)},${sy(5120-ch)} L${sx(4096)},${sy(Y0)}`;
  const base=`<path d="${out} Z" fill="var(--pitch)"/><path d="${out}" ${ln}/><line x1="${sx(-4096)}" x2="${sx(4096)}" y1="${sy(0)}" y2="${sy(0)}" ${ln}/><path d="M${sx(-1000)},${sy(0)} A${su(1000)},${su(1000)} 0 0 0 ${sx(1000)},${sy(0)}" ${ln}/><rect x="${sx(-1800)}" y="${sy(5120)}" width="${su(3600)}" height="${su(1100)}" ${ln}/>`;
  return {W,H,sx,sy,su,svg:body=>`<svg viewBox="0 0 ${W} ${H}" role="img">${base}${inner||''}${body}</svg>`};
}

// 1. Shot map with misses ---------------------------------------------------------------
function shotsOf(m){
  const r=m.raw||{},my=ourTeam(m);if(!Array.isArray(r.shot_log)||my==null)return null;
  const gat=(m.goalAt||[]).filter(g=>g.ours);
  return r.shot_log.filter(s=>s&&num(s.k)===my&&s.x!=null&&s.y!=null).map(s=>{const p=turn(s,my);
    const goal=gat.some(g=>g.who===s.p&&g.t-s.t>=-1&&g.t-s.t<=6);return {...p,who:pIx(s.p),goal,m};});
}
const ZONES=[['Box',4020,5200,1800],['Close',2560,4020],['Mid',0,2560],['Own half',-6000,0]];
function renderShots(list){
  const el=$('shotBody');if(!el)return;
  const sl=list.filter(m=>shotsOf(m)),who=IN.shotWho;
  let shots=sl.flatMap(shotsOf);
  // Older games: goals only (no misses known), drawn so the map is never empty.
  const old=list.filter(m=>!shotsOf(m)).flatMap(m=>m.ourGoals.filter(g=>g.x!=null).map(g=>({x:g.x,y:g.y,who:g.who,goal:true,m,old:true})));
  if(who!=='all'){shots=shots.filter(s=>s.who===+who);}
  const oldF=who==='all'?old:old.filter(s=>s.who===+who);
  const P=halfPitch(480);
  let z='',zl='';
  // Zones: box (centre), then bands up the pitch; centre vs wings split at |x|=1800 except the box.
  const zs=[];ZONES.forEach(([n,y0,y1,w])=>{if(w)zs.push({n,y0,y1,x0:-w,x1:w});else{zs.push({n:n+' centre',y0,y1,x0:-1800,x1:1800});zs.push({n:n+' left',y0,y1,x0:-4096,x1:-1800});zs.push({n:n+' right',y0,y1,x0:1800,x1:4096});}});
  zs.forEach(q=>{const inq=shots.filter(s=>s.y>=q.y0&&s.y<q.y1&&s.x>=q.x0&&s.x<q.x1&&!(q.n!=='Box'&&s.y>=4020&&Math.abs(s.x)<=1800)),g=inq.filter(s=>s.goal).length;
    if(!inq.length)return;const yt=Math.min(q.y1,5120),yb=Math.max(q.y0,-400);
    z+=`<rect x="${P.sx(q.x0)}" y="${P.sy(yt)}" width="${P.su(q.x1-q.x0)}" height="${P.sy(yb)-P.sy(yt)}" fill="${heatColor(inq.length?g/inq.length*1.6:0)}" opacity=".22"><title>${esc(q.n)}: ${g} of ${inq.length} shots scored</title></rect>`;zl+=
      `<text x="${P.sx((q.x0+q.x1)/2)}" y="${(P.sy(yt)+P.sy(yb))/2+4}" text-anchor="middle" class="ztxt">${iPct(g,inq.length)} <tspan class="muted">${g}/${inq.length}</tspan></text>`;});
  const dot=s=>{const c=s.who>=0?PLAYERS[s.who].color:'var(--muted)';return `<circle cx="${P.sx(clamp(s.x,-4096,4096)).toFixed(1)}" cy="${P.sy(clamp(s.y,-400,5120)).toFixed(1)}" r="${s.goal?4.5:4}" fill="${s.goal?c:'none'}" stroke="${c}" stroke-width="1.6" opacity="${s.old?.45:.9}"><title>${s.who>=0?esc(PLAYERS[s.who].short):''} ${s.goal?'goal':'miss'} · ${fmtDate(s.m.when)}</title></circle>`;};
  const shown=shots.concat(oldF).filter(s=>s.y>=-400);
  const g=shots.filter(s=>s.goal).length;
  el.innerHTML=`<div class="maps"><div class="map-col">${P.svg(z+shown.map(dot).join('')+zl)}<div class="skey"><span><i class="g"></i>Goal</span><span><i></i>Missed or saved</span>${PLAYERS.map(p=>`<span><i class="g" style="background:${p.color};border-color:${p.color}"></i>${esc(p.short)}</span>`).join('')}</div></div>`+
    `<div class="map-col">${callouts([['Shots tracked',shots.length,`${sl.length} game${sl.length===1?'':'s'}`],['Scored',iPct(g,shots.length),`${g} goal${g===1?'':'s'}`],['Shots from own half',shots.filter(s=>s.y<0).length]])}`+
    (sl.length?`<p class="map-note">Each zone shows how many of the shots from there went in. Shots are placed where the shooter hit the ball.</p>`:needNote('The miss map'))+
    (oldF.length?`<p class="map-note">Faded dots are goals from older games, where misses weren't recorded.</p>`:'')+`</div></div>`;
}

// 2. Demo rivalries ----------------------------------------------------------------------
function renderDemos(list){
  const el=$('demoBody');if(!el)return;
  const dl=list.filter(m=>Array.isArray(m.raw&&m.raw.demo_log)&&ourTeam(m)!=null);
  const by={},on={};let revenge=0,given=0,taken=0;
  dl.forEach(m=>{const my=ourTeam(m),owed={};m.raw.demo_log.forEach(d=>{if(!d||!d.by||!d.v)return;
    const ours=num(d.bk)===my;
    if(ours){given++;on[d.v]=(on[d.v]||0)+1;if(owed[d.v]){revenge++;owed[d.v]--;}}
    else if(num(d.vk)===my){taken++;by[d.by]=(by[d.by]||0)+1;owed[d.by]=(owed[d.by]||0)+1;}});});
  // Per player, every game: demos dealt and times demolished (recorders since boost tracking).
  const rows=PLAYERS.map((p,j)=>{let d=0,t=0,n=0;list.forEach(m=>{const r=(m.raw.players||[]).find(x=>x&&x.name===p.name);if(!r)return;d+=num(r.demos)||0;if(num(r.times_demolished)!=null){t+=+r.times_demolished;n++;}});return {j,d,t:n?t:null};});
  const top=(o,n)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n);
  const lst=(arr,empty)=>arr.length?`<ol class="rank">${arr.map(([n,c])=>`<li><span>${esc(n)}</span><b class="num">${c}</b></li>`).join('')}</ol>`:`<p class="muted small">${empty}</p>`;
  el.innerHTML=`<table class="lines num"><thead><tr><th>Player</th><th>Demos</th><th>Demoed</th><th>Ratio</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${tagOf(r.j)}</td><td>${r.d}</td><td>${r.t==null?'–':r.t}</td><td>${r.t?(r.d/r.t).toFixed(2):'–'}</td></tr>`).join('')}</tbody></table>`+
    (dl.length?`<div class="two"><div><h3>Our favourite victims</h3>${lst(top(on,5),'No demos yet.')}</div><div><h3>Who demos us most</h3>${lst(top(by,5),'Nobody yet.')}</div></div>`+
      callouts([['Demos dealt',given],['Demos taken',taken],['Revenge demos',revenge,'paid back in the same game']]):needNote('Who demoed whom'));
}

// 3. Kickoff battles ---------------------------------------------------------------------
function renderKicks(list){
  const el=$('kickBody');if(!el)return;
  const kl=list.filter(m=>Array.isArray(m.raw&&m.raw.kickoff_log)&&ourTeam(m)!=null);
  const ks=kl.flatMap(m=>m.raw.kickoff_log.filter(Boolean).map(k=>({...k,ours:num(k.k)===ourTeam(m),who:pIx(k.p),m})));
  const ours=ks.filter(k=>k.ours),waits=ks.map(k=>+k.wait).filter(v=>v>0&&v<8);
  const kg=list.flatMap(m=>m.goals.filter(g=>g.ko)),kgf=kg.filter(g=>g.ours).length;
  const per=PLAYERS.map((p,j)=>({j,n:ks.filter(k=>k.who===j).length}));
  // A kickoff "leads to a goal" when the next goal comes within 10 seconds of the first touch.
  let lead=[0,0];kl.forEach(m=>m.raw.kickoff_log.forEach(k=>{if(!k)return;const g=(m.goalAt||[]).find(g=>g.t>=k.t&&g.t-k.t<=10);if(g)lead[g.ours?0:1]++;}));
  el.innerHTML=callouts([['Kickoff goals',`${kgf}–${kg.length-kgf}`,'for and against, every game'],
      ['First touch',ks.length?iPct(ours.length,ks.length):'–',ks.length?`${ours.length} of ${ks.length} kickoffs`:''],
      ['Goal within 10 s',ks.length?`${lead[0]}–${lead[1]}`:'–',ks.length?'after the first touch':'']])+
    (ks.length?`<h3>Who goes for it</h3><div class="bars">${per.map(r=>`<div class="bar"><span>${tagOf(r.j)}</span><span class="track"><i style="width:${ks.length?100*r.n/ks.length:0}%;background:${PLAYERS[r.j].color}"></i></span><b class="num">${iPct(r.n,ks.length)}</b></div>`).join('')}</div>`+
      `<p class="map-note">Share of all kickoffs where that player touched the ball first.${waits.length?` First touch comes ${ (waits.reduce((a,b)=>a+b,0)/waits.length).toFixed(1)} s after the countdown on average.`:''}</p>`:needNote('First-touch stats'));
}

// 4. Touch heatmaps ----------------------------------------------------------------------
function renderTouches(list){
  const el=$('touchBody');if(!el)return;
  const tl=list.filter(m=>m.tl);
  if(!tl.length){el.innerHTML=needNote('The touch heatmap');return;}
  const j=Math.min(IN.touchWho,PLAYERS.length-1),nm=PLAYERS[j].name;
  const pts=tl.flatMap(m=>m.tl.filter(t=>t.p===nm));
  const W=480,H=Math.round(W*12000/8192),sx=x=>(x+4096)/8192*W,sy=y=>(6000-y)/12000*H,cell=384,bins={};
  pts.forEach(t=>{const c=Math.floor((clamp(t.x,-4096,4095)+4096)/cell),r=Math.floor((clamp(t.y,-5120,5119)+5120)/cell);bins[c+','+r]=(bins[c+','+r]||0)+1;});
  const mx=Math.max(1,...Object.values(bins));
  const P=fieldMapShell(W,H,sx,sy);
  let f='';Object.entries(bins).forEach(([k,n])=>{const [c,r]=k.split(',').map(Number);f+=`<rect x="${sx(c*cell-4096)}" y="${sy(-5120+(r+1)*cell)}" width="${cell/8192*W+.6}" height="${cell/8192*W+.6}" fill="${heatColor(Math.sqrt(n/mx))}" opacity=".8" shape-rendering="crispEdges"><title>${n} touch${n>1?'es':''}</title></rect>`;});
  const third=(a,b)=>pts.filter(t=>t.y>=a&&t.y<b).length;
  const ax=pts.reduce((a,t)=>a+t.x,0)/(pts.length||1),ay=pts.reduce((a,t)=>a+t.y,0)/(pts.length||1);
  const avg=pts.length?`<circle cx="${sx(ax)}" cy="${sy(ay)}" r="7" fill="none" stroke="var(--ink)" stroke-width="2"/><circle cx="${sx(ax)}" cy="${sy(ay)}" r="2" fill="var(--ink)"/>`:'';
  el.innerHTML=`<div class="panel-tools">${segHtml('touchWho',PLAYERS.map((p,k)=>[k,p.short]),j)}</div><div class="maps"><div class="map-col">${P(f+avg)}<div class="heat-key"><span>Few</span><span class="ramp"></span><span>Many</span></div></div>`+
    `<div class="map-col">${callouts([['Attacking third',iPct(third(1707,99999),pts.length)],['Middle third',iPct(third(-1707,1707),pts.length)],['Defensive third',iPct(third(-99999,-1707),pts.length)]])}`+
    `<p class="map-note">${pts.length} touches by ${esc(PLAYERS[j].name)} in ${tl.length} game${tl.length===1?'':'s'}. The ring marks the average touch spot. We attack upwards.</p></div></div>`;
}
function fieldMapShell(W,H,sx,sy){const su=u=>u/8192*W,ch=1152,ln='stroke="var(--pitch-line)" stroke-width="1.5" fill="none"';
  const o=`M${sx(-4096)},${sy(5120-ch)} L${sx(-4096+ch)},${sy(5120)} L${sx(4096-ch)},${sy(5120)} L${sx(4096)},${sy(5120-ch)} L${sx(4096)},${sy(-5120+ch)} L${sx(4096-ch)},${sy(-5120)} L${sx(-4096+ch)},${sy(-5120)} L${sx(-4096)},${sy(-5120+ch)} Z`;
  return body=>`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Touch heatmap"><path d="${o}" fill="var(--pitch)"/>${body}<path d="${o}" ${ln}/><line x1="${sx(-4096)}" x2="${sx(4096)}" y1="${sy(0)}" y2="${sy(0)}" ${ln}/><circle cx="${sx(0)}" cy="${sy(0)}" r="${su(1000)}" ${ln}/>`+
    `<rect x="${sx(-893)}" y="${sy(6000)}" width="${su(1786)}" height="${sy(5120)-sy(6000)}" stroke="var(--win)" stroke-width="2" fill="none"/><rect x="${sx(-893)}" y="${sy(-5120)}" width="${su(1786)}" height="${sy(-6000)-sy(-5120)}" stroke="var(--muted)" stroke-width="2" fill="none"/></svg>`;}

// 5. Momentum ----------------------------------------------------------------------------
function renderMomentum(list){
  const el=$('momBody');if(!el)return;
  const ml=ALL.filter(m=>Array.isArray(m.raw&&m.raw.momentum)&&m.raw.momentum.length>20&&ourTeam(m)!=null).slice().sort((a,b)=>b.when-a.when);
  const sel=$('momMatch');fillPick(sel,ml);
  if(!ml.length){el.innerHTML=needNote('The momentum graph');return;}
  const m=ml.find(x=>String(x.guid)===sel.value)||ml[0],my=ourTeam(m),raw=m.raw.momentum.filter(Boolean).sort((a,b)=>a.t-b.t);
  // Pressure: +1 while we touched it last, -1 while they did, weighted by ball speed, smoothed over ~8 s.
  let e=0;const pts=raw.map(s=>{const v=(num(s.k)===my?1:-1)*(.35+.65*Math.min(1,(+s.s||0)/2300));e=e+(v-e)*.12;return [+s.t,e];});
  const t0=pts[0][0],t1=pts[pts.length-1][0],W=640,H=200,pad=24,x=t=>pad+(t-t0)/((t1-t0)||1)*(W-2*pad),y=v=>H/2-v*(H/2-14);
  const line=pts.map(p=>`${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  const area=`M${x(t0)},${y(0)} L${line.split(' ').join(' L')} L${x(t1)},${y(0)} Z`;
  const goals=(m.goalAt||[]).map(g=>`<line x1="${x(g.t)}" x2="${x(g.t)}" y1="10" y2="${H-10}" stroke="${g.ours?'var(--win)':'var(--loss)'}" stroke-dasharray="3 3"/><text x="${x(g.t)}" y="${g.ours?10:H-2}" text-anchor="middle" class="momg" fill="${g.ours?'var(--win)':'var(--loss)'}">${g.ours?esc(pShort(g.who)):'them'}</text>`).join('');
  let ticks='';for(let mn=0;mn*60<=t1-t0;mn++)ticks+=`<text x="${x(t0+mn*60)}" y="${H+12}" text-anchor="middle" class="momg" fill="var(--muted)">${mn}m</text>`;
  const share=pts.filter(p=>p[1]>0).length/pts.length;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H+16}" role="img" aria-label="Pressure over the match"><defs><clipPath id="momUp"><rect x="0" y="0" width="${W}" height="${H/2}"/></clipPath><clipPath id="momDn"><rect x="0" y="${H/2}" width="${W}" height="${H/2}"/></clipPath></defs>`+
    `<path d="${area}" fill="var(--win)" opacity=".35" clip-path="url(#momUp)"/><path d="${area}" fill="var(--loss)" opacity=".35" clip-path="url(#momDn)"/><line x1="${pad}" x2="${W-pad}" y1="${H/2}" y2="${H/2}" stroke="var(--grid)"/>${ticks}<polyline points="${line}" fill="none" stroke="var(--ink-2)" stroke-width="1.5"/>${goals}</svg>`+
    `<p class="map-note">Above the line we had the ball last, below they did; faster ball means a bigger swing. We had it ${Math.round(100*share)}% of the time in ${esc(m.arena)}, ${m.us}–${m.them} ${m.win?'win':'loss'}.</p>`;
}

// 6. Trophy case -------------------------------------------------------------------------
const TROPHIES={AerialGoal:'Aerial goal',BicycleGoal:'Bicycle goal',BicycleHit:'Bicycle hit',LongGoal:'Long goal',TurtleGoal:'Turtle goal',BackwardsGoal:'Backwards goal',PoolShot:'Pool shot',OvertimeGoal:'Overtime goal',
  HatTrick:'Hat trick',Playmaker:'Playmaker',Savior:'Savior',EpicSave:'Epic save',Demolish:'Demolition',Demolition:'Demolition',Juggle:'Juggle',HighFive:'High five',LowFive:'Low five',FirstTouch:'First touch',
  Center:'Centre',CenterBall:'Centre',Clear:'Clearance',ClearBall:'Clearance',MVP:'MVP',Swish:'Swish',HoopsSwishGoal:'Swish goal',BreakoutDamage:'Breakout damage',UltraDamage:'Ultra damage',Fifty:'50/50',
  AerialHit:'Aerial hit',Shot:'Shot',Save:'Save',Goal:'Goal',Assist:'Assist',Win:'Win'};
const BORING=new Set(['Shot','Save','Goal','Assist','Win','Shot on Goal']);
function renderTrophies(){
  const el=$('trophyBody');if(!el)return;
  const tot=PLAYERS.map(()=>({}));let n=0;
  DONE.forEach(m=>(m.raw.players||[]).forEach(r=>{const j=r&&pIx(r.name);if(j==null||j<0||!r.statfeed||typeof r.statfeed!=='object')return;n++;
    Object.entries(r.statfeed).forEach(([k,v])=>{const key=TROPHIES[k]||k.replace(/([a-z])([A-Z])/g,'$1 $2');if(BORING.has(k)||BORING.has(key))return;tot[j][key]=(tot[j][key]||0)+(+v||0);});}));
  const keys=[...new Set(tot.flatMap(o=>Object.keys(o)))].sort((a,b)=>PLAYERS.reduce((s,p,j)=>s+(tot[j][b]||0),0)-PLAYERS.reduce((s,p,j)=>s+(tot[j][a]||0),0));
  if(!keys.length){el.innerHTML='<p class="note">No special plays recorded yet.</p>';return;}
  el.innerHTML=`<div class="trophies">${keys.map(k=>{const best=Math.max(...PLAYERS.map((p,j)=>tot[j][k]||0));
    return `<div class="trophy"><span class="tname">${esc(k)}</span><span class="tcounts">${PLAYERS.map((p,j)=>`<span class="tc${(tot[j][k]||0)===best&&best>0?' top':''}" style="--c:${p.color}"><i></i><b class="num">${tot[j][k]||0}</b></span>`).join('')}</span></div>`;}).join('')}</div>`+
    `<p class="map-note">All time, from the game's own feed (the pop-ups you see in game). The leader on each one is lit.</p>`;
}

// 7. Post and crossbar hits --------------------------------------------------------------
function renderPosts(list){
  const el=$('postBody');if(!el)return;
  const side=IN.postSide;
  const pl=list.filter(m=>Array.isArray(m.raw&&m.raw.post_log)&&ourTeam(m)!=null);
  const hits=pl.flatMap(m=>{const my=ourTeam(m);return m.raw.post_log.filter(h=>h&&h.x!=null).map(h=>{const ours=num(h.k)===my,att=ours?my:1-my,p=turn(h,att);return {...p,ours,who:pIx(h.p),m};});}).filter(h=>side==='us'?h.ours:!h.ours);
  const W=480,H=230,sx=x=>W/2-x/1100*(W/2),sz=z=>H-14-z/760*(H-30);
  let g=`<rect x="${sx(893)}" y="${sz(642)}" width="${sx(-893)-sx(893)}" height="${sz(0)-sz(642)}" fill="var(--pitch)" opacity=".6"/>`;
  for(let i=1;i<8;i++){g+=`<line x1="${sx(893-i*223)}" x2="${sx(893-i*223)}" y1="${sz(642)}" y2="${sz(0)}" stroke="var(--grid)"/>`;}
  for(let i=1;i<4;i++){g+=`<line x1="${sx(893)}" x2="${sx(-893)}" y1="${sz(i*160)}" y2="${sz(i*160)}" stroke="var(--grid)"/>`;}
  g+=`<path d="M${sx(893)},${sz(0)} L${sx(893)},${sz(642)} L${sx(-893)},${sz(642)} L${sx(-893)},${sz(0)}" fill="none" stroke="var(--ink)" stroke-width="6" stroke-linejoin="round"/><line x1="0" x2="${W}" y1="${sz(0)}" y2="${sz(0)}" stroke="var(--pitch-line)" stroke-width="2"/>`;
  g+=hits.map(h=>{const c=h.who>=0?PLAYERS[h.who].color:'var(--loss)';return `<circle cx="${sx(clamp(h.x,-1100,1100)).toFixed(1)}" cy="${sz(clamp(h.z,0,760)).toFixed(1)}" r="6" fill="${c}" stroke="var(--surface)" stroke-width="1.5" opacity=".9"><title>${h.who>=0?esc(PLAYERS[h.who].short):'Opponent'} · ${fmtDate(h.m.when)}</title></circle>`;}).join('');
  // Every game: post/crossbar counts per player from the scoreboard rows.
  const per=PLAYERS.map((p,j)=>({j,n:list.reduce((a,m)=>{const r=(m.raw.players||[]).find(x=>x&&x.name===p.name);return a+(r?num(r.crossbar_hits)||0:0);},0)}));
  el.innerHTML=`<div class="panel-tools">${segHtml('postSide',[['us','Our shots'],['them','Their shots']],side)}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Goal frame with post and crossbar hits">${g}</svg>`+
    `<p class="map-note">${pl.length?`${hits.length} so-close hit${hits.length===1?'':'s'} on the frame, seen from the front. `:''}Every game: ${per.map(r=>`${esc(PLAYERS[r.j].short)} ${r.n}`).join(', ')} post or crossbar hits.</p>`+(pl.length?'':needNote('Where they hit'));
}

// 8. MMR per session ---------------------------------------------------------------------
function renderMmrSessions(){
  const el=$('mmrsBody');if(!el)return;
  const ranked=sessions.filter(s=>s.matches.some(m=>/^Ranked/.test(m.playlist))).slice().reverse();
  const sel=$('mmrsPick'),keep=sel.value;
  sel.innerHTML=ranked.map((s,i)=>`<option value="${s.start.getTime()}">${esc(fmtDay(s.start))} · ${s.matches.filter(m=>m.win).length}–${s.matches.filter(m=>!m.win).length}</option>`).join('');
  if(ranked.some(s=>String(s.start.getTime())===keep))sel.value=keep;
  if(!ranked.length){el.innerHTML='<p class="note">No ranked sessions in this playlist yet.</p>';return;}
  const s=ranked.find(x=>String(x.start.getTime())===sel.value)||ranked[0],ms=s.matches;
  // MMR after each game = the value logged when the next game was queued (or soon after the last one).
  const after=(j,i)=>{const t=i+1<ms.length?ms[i+1].when.getTime()+5000:ms[i].when.getTime()+ms[i].dur*1000+3*3600e3;const rows=mmrRows(j).filter(r=>r.at.getTime()>=ms[i].when.getTime()-60e3&&r.at.getTime()<=t);return rows.length?rows[rows.length-1].v:null;};
  const start=j=>mmrAt(j,ms[0].when.getTime()+60e3);
  const ser=PLAYERS.map((p,j)=>[start(j)].concat(ms.map((m,i)=>after(j,i))));
  const all=ser.flat().filter(v=>v!=null);
  if(!all.length){el.innerHTML='<p class="note">No MMR logged during this session.</p>';return;}
  const W=640,H=230,pl=44,pr=14,pt=14,pb=40,lo=Math.min(...all)-6,hi=Math.max(...all)+6,n=ms.length;
  const x=i=>pl+i*(W-pl-pr)/Math.max(1,n),y=v=>pt+(hi-v)*(H-pt-pb)/((hi-lo)||1);
  let g='';const step=niceStep((hi-lo)/4);for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step)g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end" class="small">${Math.round(v)}</text>`;
  // Streak bands: 3 or more results in a row.
  let i0=0;for(let i=1;i<=n;i++){if(i===n||ms[i].win!==ms[i0].win){if(i-i0>=3)g+=`<rect x="${x(i0+.5)}" y="${pt}" width="${x(i)-x(i0)}" height="${H-pt-pb}" fill="${ms[i0].win?'var(--win)':'var(--loss)'}" opacity=".1"/><text x="${(x(i0+.5)+x(i+.5))/2}" y="${pt+12}" text-anchor="middle" class="small" fill="${ms[i0].win?'var(--win)':'var(--loss)'}">${ms[i0].win?'W':'L'}${i-i0} ${ms[i0].win?'heater':'tilt'}</text>`;i0=i;}}
  ms.forEach((m,i)=>{g+=`<rect x="${x(i+1)-7}" y="${H-pb+10}" width="14" height="14" rx="3" fill="${m.win?'var(--win)':'var(--loss)'}"><title>${m.us}–${m.them} ${m.win?'win':'loss'} · ${fmtTime(m.when)}</title></rect>`;});
  PLAYERS.forEach((p,j)=>{const pts=ser[j].map((v,i)=>v==null?null:[x(i),y(v)]).filter(Boolean);if(!pts.length)return;
    g+=`<polyline points="${pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="${p.color}" stroke-width="2" stroke-linejoin="round"/>`+pts.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="${p.color}"/>`).join('');});
  const delta=PLAYERS.map((p,j)=>{const v=ser[j].filter(x=>x!=null);return v.length>1?`${esc(p.short)} ${sign(Math.round(v[v.length-1]-v[0]))}`:null;}).filter(Boolean).join(', ');
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="MMR through the session">${g}</svg><p class="map-note">${delta?`This session: ${delta}. `:''}Shaded runs are 3 or more wins or losses in a row.</p>`;
}

// 9. Boost at goals against --------------------------------------------------------------
function renderStarve(list){
  const el=$('boostBody');if(!el)return;
  const ga=list.flatMap(m=>(m.raw.goals||[]).filter(g=>g&&+g.goal_time>0&&g.boosts&&(g.ours===false||(g.ours==null&&num(g.team)!==ourTeam(m)))).map(g=>({g,m})));
  if(!ga.length){el.innerHTML=needNote('Boost at goals against');return;}
  const LOW=12,low=b=>b!=null&&b<LOW;
  const any=ga.filter(({g})=>PLAYERS.some(p=>low(g.boosts[p.name]))).length;
  const per=PLAYERS.map((p,j)=>{const v=ga.map(({g})=>g.boosts[p.name]).filter(b=>b!=null);
    const z=list.map(m=>(m.raw.players||[]).find(r=>r&&r.name===p.name)).filter(r=>r&&r.zero_boost_fixed&&num(r.pct_zero_boost)!=null);
    return {j,n:v.length,low:v.filter(low).length,demo:v.filter(b=>b<0).length,base:z.length?z.reduce((a,r)=>a+(+r.pct_zero_boost),0)/z.length:null};});
  el.innerHTML=callouts([['Goals against checked',ga.length],['One of us starving',iPct(any,ga.length),`under ${LOW} boost or demoed`]])+
    `<div class="bars">${per.map(r=>`<div class="bar"><span>${tagOf(r.j)}</span><span class="track"><i style="width:${r.n?100*r.low/r.n:0}%;background:${PLAYERS[r.j].color}"></i>${r.base!=null?`<em style="left:${r.base}%" title="Share of play time on an empty tank"></em>`:''}</span><b class="num">${iPct(r.low,r.n)}</b></div>`).join('')}</div>`+
    `<p class="map-note">Bar: share of goals against where that player had under ${LOW} boost or was demoed. Tick: share of all play time they spend on empty, so a bar past its tick means starving costs goals.</p>`;
}

// 10. Duo synergy ------------------------------------------------------------------------
function renderSynergy(list){
  const el=$('duoBody');if(!el)return;
  if(PLAYERS.length<2){el.innerHTML='<p class="note">Needs two players.</p>';return;}
  const A=0,B=1,both=list.filter(m=>m.lines[A]&&m.lines[B]);
  const grp=[['Both scored',m=>m.lines[A].goals>0&&m.lines[B].goals>0],[`Only ${PLAYERS[A].short}`,m=>m.lines[A].goals>0&&!m.lines[B].goals],[`Only ${PLAYERS[B].short}`,m=>!m.lines[A].goals&&m.lines[B].goals>0],['Neither',m=>!m.lines[A].goals&&!m.lines[B].goals]];
  const ab=both.flatMap(m=>m.ourGoals).filter(g=>g.who===B&&g.assister===PLAYERS[A].name).length,ba=both.flatMap(m=>m.ourGoals).filter(g=>g.who===A&&g.assister===PLAYERS[B].name).length;
  el.innerHTML=`<table class="lines num"><thead><tr><th></th><th>Games</th><th>Win rate</th><th>Goals for</th></tr></thead><tbody>${grp.map(([n,f])=>{const g=both.filter(f),w=g.filter(m=>m.win).length;
      return `<tr><td>${esc(n)}</td><td>${g.length}</td><td>${g.length?`<span class="wr" style="--w:${100*w/g.length}%">${iPct(w,g.length)}</span>`:'–'}</td><td>${g.length?(g.reduce((a,m)=>a+m.us,0)/g.length).toFixed(1):'–'}</td></tr>`;}).join('')}</tbody></table>`+
    callouts([[`${PLAYERS[A].short} → ${PLAYERS[B].short}`,ab,'assisted goals'],[`${PLAYERS[B].short} → ${PLAYERS[A].short}`,ba,'assisted goals'],['Assisted',iPct(ab+ba,both.reduce((a,m)=>a+m.ourGoals.length,0)),'of our goals']]);
}

// 11. Hardest shots ----------------------------------------------------------------------
function renderFastest(list){
  const el=$('fastBody');if(!el)return;
  const gs=list.flatMap(m=>m.ourGoals.filter(g=>g.spd!=null).map(g=>({g,m}))).sort((a,b)=>b.g.spd-a.g.spd).slice(0,10);
  if(!gs.length){el.innerHTML='<p class="note">No goal speeds in this period.</p>';return;}
  el.innerHTML=`<ol class="fastlist">${gs.map(({g,m},i)=>`<li><span class="num rk">${i+1}</span>${tagOf(g.who)}<b class="num">${fSpd(g.spd)}</b><span class="muted small">${m.us}–${m.them} ${m.win?'W':'L'} · ${fmtDate(m.when)}</span>${g.ix!=null&&g.x!=null?`<button type="button" class="chipbtn" data-i="${i}">Replay 3D</button>`:''}</li>`).join('')}</ol>`;
  el.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{const {g,m}=gs[+b.dataset.i];
    if(mapSide!=='us'){const sb=document.querySelector('#mapSide button[data-s="us"]');if(sb)sb.click();}
    if(mapWho!=='all'){const wb=document.querySelector('#mapWho button[data-w="all"],#mapWho [data-who="all"]');if(wb)wb.click();else{mapWho='all';renderMaps(inPeriod());}}
    const hit=G3.goals.find(x=>x.m===m&&x.spd===g.spd&&x.x===g.x&&x.y===g.y);
    const cv=$('map3d');if(cv)cv.scrollIntoView({behavior:'smooth',block:'center'});
    if(hit){RP.k=null;showReplay(hit.k);}});
}

// Wiring ---------------------------------------------------------------------------------
function renderInsights(list){
  const run=f=>{try{f();}catch(e){console.error(e);}};run(syncShotWho);
  run(()=>renderShots(list));run(()=>renderDemos(list));run(()=>renderKicks(list));run(()=>renderTouches(list));run(()=>renderMomentum(list));
  run(()=>renderTrophies());run(()=>renderPosts(list));run(()=>renderMmrSessions());run(()=>renderStarve(list));run(()=>renderSynergy(list));run(()=>renderFastest(list));
}
document.addEventListener('click',e=>{const b=e.target.closest('#shotWho button,#touchWho button,#postSide button');if(!b)return;const id=b.parentElement.id,v=b.dataset.v;
  if(id==='shotWho')IN.shotWho=v;if(id==='touchWho')IN.touchWho=+v;if(id==='postSide')IN.postSide=v;
  b.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));const l=inPeriod();
  if(id==='shotWho')renderShots(l);if(id==='touchWho')renderTouches(l);if(id==='postSide')renderPosts(l);});
['momMatch','mmrsPick'].forEach(id=>{const s=$(id);if(s)s.addEventListener('change',()=>id==='momMatch'?renderMomentum():renderMmrSessions());});
function syncShotWho(){const el=$('shotWhoWrap');if(el)el.innerHTML=segHtml('shotWho',[['all','Both']].concat(PLAYERS.map((p,k)=>[k,p.short])),IN.shotWho);}

// Sample data for the new logs, so the panels show something before real games arrive.
function sampleExtras(matches,mmr,names){
  let a=777;const rnd=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const nrm=(m,s)=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  const pick=l=>l[Math.floor(rnd()*l.length)],R=Math.round;
  const FEED=[['AerialGoal',.25],['LongGoal',.12],['BicycleHit',.08],['EpicSave',.3],['Savior',.03],['Playmaker',.03],['HatTrick',.04],['Demolish',1],['Center',1.2],['Clear',1.4],['FirstTouch',.6],['MVP',.25],['Juggle',.05],['PoolShot',.05],['BicycleGoal',.02],['TurtleGoal',.01],['HighFive',.2]];
  matches.forEach(r=>{const my=r.my_team,f=my===1?-1:1,dur=r.duration_seconds,ours=r.players.filter(p=>p.team===my),foes=r.players.filter(p=>p.team!==my);
    const W=(x,y,z,att)=>{const g=att===1?-1:1;return {x:R(-g*x),y:R(g*y),z:R(z)};};
    r.shot_log=[];r.players.forEach(p=>{const gl=r.goals.filter(g=>g.scorer===p.name);
      gl.forEach(g=>{const s=g.shot_from||{X:0,Y:f*3000,Z:93};r.shot_log.push({t:+((g.at||g.goal_time)-1.5).toFixed(1),p:p.name,k:p.team,x:s.X,y:s.Y,z:s.Z||93});});
      for(let q=gl.length;q<(p.shots||0);q++){const y=clamp(nrm(3000,1500),-1500,5000),x=clamp(nrm(0,1700-y/8),-3900,3900);r.shot_log.push({t:R(rnd()*dur),p:p.name,k:p.team,...W(x,y,clamp(nrm(200,200),93,1200),p.team)});}});
    r.demo_log=[];ours.forEach(p=>{for(let q=0;q<(p.demos||0);q++)r.demo_log.push({t:R(rnd()*dur),by:p.name,bk:my,v:pick(foes).name,vk:1-my});});
    foes.forEach(p=>{const n=Math.floor(rnd()*2.4);for(let q=0;q<n;q++)r.demo_log.push({t:R(rnd()*dur),by:p.name,bk:1-my,v:pick(ours).name,vk:my});});
    r.demo_log.sort((a,b)=>a.t-b.t);
    const ko=[0].concat(r.goals.map(g=>(g.at||g.goal_time)+6)).filter(t=>t<dur);
    r.kickoff_log=ko.map(t=>{const p=pick(r.players);return {t:+(t+2.6+rnd()*.6).toFixed(1),wait:+(2.6+rnd()*.6).toFixed(1),p:p.name,k:p.team,x:R(nrm(0,60)),y:R(nrm(0,80)),z:93};});
    r.post_log=[];const np=rnd()<.45?1+Math.floor(rnd()*2):0;for(let q=0;q<np;q++){const p=pick(r.players),post=rnd()<.6,side=rnd()<.5?-1:1;
      r.post_log.push({t:R(rnd()*dur),p:p.name,k:p.team,...W(post?side*nrm(880,25):nrm(0,450),5150,post?clamp(nrm(260,140),93,600):nrm(640,20),p.team)});}
    let k=my,mom=[];for(let t=0;t<dur;t++){if(rnd()<.18)k=rnd()<.5+(r.result==='Win'?.05:-.05)?my:1-my;mom.push({t,k,s:R(clamp(nrm(1300,600),0,4000))});}
    r.momentum=mom;
    r.goals.forEach(g=>{if(g.ours)return;g.boosts={};ours.forEach(p=>{g.boosts[p.name]=rnd()<.08?-1:rnd()<.3?R(rnd()*11):R(12+rnd()*88);});});
    ours.forEach(p=>{p.statfeed={};FEED.forEach(([n,l])=>{let L=Math.exp(-l),c=0,pp=1;do{c++;pp*=rnd();}while(pp>L);if(c-1>0)p.statfeed[n]=c-1;});p.crossbar_hits=r.post_log.filter(h=>h.p===p.name).length;p.times_demolished=r.demo_log.filter(d=>d.v===p.name).length;});
  });
  // MMR before each ranked game, so the per-session chart has a line to draw.
  const ranked=matches.filter(r=>r.playlist==='Ranked Doubles').sort((x,y)=>new Date(x.started_at)-new Date(y.started_at));
  names.forEach(nm=>{const base=mmr.filter(s=>s.player===nm).sort((x,y)=>new Date(x.logged_at)-new Date(y.logged_at));let v=null,last=0;
    ranked.forEach(r=>{const t=new Date(r.started_at).getTime();const b=base.filter(s=>new Date(s.logged_at).getTime()<=t).pop();
      if(b&&new Date(b.logged_at).getTime()!==last){v=b.mmr;last=new Date(b.logged_at).getTime();}if(v==null)return;
      mmr.push({logged_at:new Date(t-30e3).toISOString(),player:nm,playlist:'Ranked Doubles',mmr:R(v)});v+=r.result==='Win'?8+rnd()*4:-(8+rnd()*4);});});
  mmr.sort((x,y)=>new Date(x.logged_at)-new Date(y.logged_at));
}

function matchFromHash(){const h=location.hash;if(h.startsWith('#m-'))openMatch(decodeURIComponent(h.slice(3)));}
window.addEventListener('hashchange',matchFromHash);
$('matchClose').addEventListener('click',()=>$('matchDlg').close());
$('matchDlg').addEventListener('click',e=>{if(e.target===$('matchDlg'))$('matchDlg').close();});
$('matchDlg').addEventListener('close',()=>{if(location.hash.startsWith('#m-'))history.replaceState(null,'',location.pathname+location.search);});
$('matchLog').addEventListener('click',e=>{const a=e.target.closest('a.mlink');if(!a)return;e.preventDefault();history.replaceState(null,'',a.getAttribute('href'));matchFromHash();});
// Hovering a ball on one goal map lights up the same goal on the other. The pointer is magnetic:
// the nearest ball within reach snaps on and leans toward the cursor, so small balls are easy to catch.
(function(){
  const SNAP=26,LET_GO=38,PULL=.35,MAXPULL=7;let cur=null;
  const centres=svg=>{if(svg._c)return svg._c;svg._c=[...svg.querySelectorAll('.dot')].map(d=>{const m=/translate\(([-\d.]+) ([-\d.]+)\)/.exec(d.getAttribute('transform')||'');return m?{d,x:+m[1],y:+m[2]}:null;}).filter(Boolean);return svg._c;};
  const release=()=>{if(!cur)return;cur.d.style.translate='';cur=null;
    document.querySelectorAll('#fieldMap,#netMap').forEach(el=>{el.classList.remove('linking');el.style.cursor='';});
    document.querySelectorAll('.dot.lit').forEach(el=>el.classList.remove('lit'));hideReplay();};
  const grab=(d,host,e)=>{const k=d.dataset.g;cur={d,k};
    document.querySelectorAll('#fieldMap,#netMap').forEach(el=>el.classList.add('linking'));host.style.cursor='pointer';
    document.querySelectorAll(`#fieldMap .dot[data-g="${k}"],#netMap .dot[data-g="${k}"]`).forEach(el=>{el.classList.add('lit');el.parentNode.appendChild(el);});
    if(matchMedia('(hover: hover)').matches)showReplay(k,e);};
  ['fieldMap','netMap'].forEach(id=>{const host=$(id);
    host.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const svg=host.querySelector('svg');if(!svg)return;
      const M=svg.getScreenCTM();if(!M)return;const sc=Math.hypot(M.a,M.b)||1;
      let best=null,bd=1e9;for(const c of centres(svg)){const dx=M.a*c.x+M.c*c.y+M.e-e.clientX,dy=M.b*c.x+M.d*c.y+M.f-e.clientY,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=c;}}
      bd=Math.sqrt(bd);
      if(cur&&cur.d.ownerSVGElement===svg){const c=centres(svg).find(x=>x.d===cur.d);
        // Stay on the current ball until the cursor leaves its reach or is clearly closer to another.
        const cd=c?Math.hypot(M.a*c.x+M.c*c.y+M.e-e.clientX,M.b*c.x+M.d*c.y+M.f-e.clientY):1e9;
        if(cd<=LET_GO&&!(best&&best.d!==cur.d&&bd<cd*.6)){best=c;bd=cd;}}
      if(!best||bd>(cur?LET_GO:SNAP)){release();return;}
      if(!cur||cur.d!==best.d){release();grab(best.d,host,e);}else if(RP.k!=null)placeReplay(e);
      // Lean the ball toward the cursor, in the SVG's own units.
      const px=(e.clientX-(M.a*best.x+M.c*best.y+M.e))*PULL,py=(e.clientY-(M.b*best.x+M.d*best.y+M.f))*PULL,l=Math.hypot(px,py),k=l>MAXPULL?MAXPULL/l:1;
      best.d.style.translate=`${(px*k/sc).toFixed(2)}px ${(py*k/sc).toFixed(2)}px`;});
    host.addEventListener('pointerleave',release);
  });
})();

// ---------- customizable layout ----------
// Every panel is a module you can drag into a new order, set to full or half width, or hide.
// The layout is saved in this browser only, so Jay's and Kobra's dashboards can differ.
(function(){
  const wrap=document.querySelector('.wrap'),banner=$('banner');if(!wrap)return;
  const board=document.createElement('div');board.className='board';board.id='board';
  const bar=document.createElement('div');bar.className='editbar';
  bar.innerHTML='<span class="hint">Drag a panel by ⠿ to move it. ½ switches half or full width, ✕ hides it.</span><button type="button" class="chipbtn" id="layoutReset">Reset layout</button><button type="button" class="chipbtn" id="layoutDone">Done</button>';
  // Panels that share a row become their own modules, side by side at half width.
  const mods=[];const add=(el,half)=>{el.classList.add('mod');if(half)el.dataset.half='1';mods.push(el);};
  [...wrap.children].forEach(el=>{if(el.tagName!=='SECTION')return;
    if(el.matches('.grid.g-2,.grid.g-2b')&&el.children.length){[...el.children].forEach(ch=>add(ch,true));el.remove();}else add(el,false);});
  const label=el=>{const h=el.querySelector('h2,h3');return (h&&h.textContent.trim())||el.getAttribute('aria-label')||'Panel';};
  mods.forEach(el=>{const h=el.querySelector('h2,h3');el.dataset.mod=(el.getAttribute('aria-labelledby')||(h&&h.id)||el.getAttribute('aria-label')||label(el)).replace(/\W+/g,'-').toLowerCase();
    const mb=document.createElement('div');mb.className='modbar';
    mb.innerHTML=`<span class="grip" title="Drag to move" aria-hidden="true">⠿</span><b>${esc(label(el))}</b><button type="button" data-a="up" title="Move up" aria-label="Move up">↑</button><button type="button" data-a="down" title="Move down" aria-label="Move down">↓</button><button type="button" data-a="w" title="Half or full width" aria-label="Width">½</button><button type="button" data-a="hide" title="Hide or show" aria-label="Hide">✕</button>`;
    el.prepend(mb);});
  const KEY='rl-duo-layout',defOrder=mods.map(m=>m.dataset.mod);
  let L={order:defOrder.slice(),w:{},hidden:[]};
  try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&Array.isArray(x.order))L={order:x.order,w:x.w||{},hidden:x.hidden||[]};}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(L));}catch(e){}};
  const byId=id=>mods.find(m=>m.dataset.mod===id);
  const apply=()=>{const ord=L.order.filter(byId);
    defOrder.forEach((id,k)=>{if(ord.includes(id))return;const prev=defOrder.slice(0,k).reverse().find(x=>ord.includes(x));ord.splice(prev?ord.indexOf(prev)+1:0,0,id);});
    ord.forEach(id=>{const m=byId(id),half=L.w[id]?L.w[id]==='half':!!m.dataset.half;m.classList.toggle('half',half);m.classList.toggle('gone',L.hidden.includes(id));
      const mb=m.querySelector('.modbar');mb.querySelector('[data-a="w"]').textContent=half?'▭':'½';mb.querySelector('[data-a="hide"]').textContent=L.hidden.includes(id)?'👁':'✕';board.appendChild(m);});
    L.order=ord;};
  const changed=()=>{save();apply();setTimeout(()=>{window.dispatchEvent(new Event('resize'));try{renderAll();}catch(e){}},30);};
  (banner||wrap.querySelector('header')).after(bar);bar.after(board);apply();
  board.addEventListener('click',e=>{const b=e.target.closest('.modbar button[data-a]');if(!b)return;const m=b.closest('.mod'),id=m.dataset.mod,i=L.order.indexOf(id);
    if(b.dataset.a==='up'&&i>0)[L.order[i-1],L.order[i]]=[L.order[i],L.order[i-1]];
    if(b.dataset.a==='down'&&i<L.order.length-1)[L.order[i+1],L.order[i]]=[L.order[i],L.order[i+1]];
    if(b.dataset.a==='w')L.w[id]=m.classList.contains('half')?'full':'half';
    if(b.dataset.a==='hide')L.hidden=L.hidden.includes(id)?L.hidden.filter(x=>x!==id):L.hidden.concat(id);
    changed();});
  // Drag and drop by the grip.
  let dragId=null;
  board.addEventListener('pointerdown',e=>{const g=e.target.closest('.grip');if(g)g.closest('.mod').draggable=true;});
  board.addEventListener('pointerup',()=>board.querySelectorAll('.mod[draggable="true"]').forEach(m=>m.draggable=false));
  board.addEventListener('dragstart',e=>{const m=e.target.closest&&e.target.closest('.mod');if(!m||!m.draggable)return;dragId=m.dataset.mod;m.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.setDragImage(m,20,20);}catch(x){}});
  const clear=()=>board.querySelectorAll('.drop-before,.drop-after,.dragging').forEach(x=>x.classList.remove('drop-before','drop-after','dragging'));
  const side=(m,e)=>{const r=m.getBoundingClientRect();return m.classList.contains('half')&&!matchMedia('(max-width:900px)').matches?(e.clientX<r.left+r.width/2?'before':'after'):(e.clientY<r.top+r.height/2?'before':'after');};
  board.addEventListener('dragover',e=>{if(!dragId)return;const m=e.target.closest('.mod');if(!m||m.dataset.mod===dragId)return;e.preventDefault();
    board.querySelectorAll('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));m.classList.add('drop-'+side(m,e));});
  board.addEventListener('drop',e=>{if(!dragId)return;const m=e.target.closest('.mod');e.preventDefault();
    if(m&&m.dataset.mod!==dragId){const s=side(m,e);L.order=L.order.filter(x=>x!==dragId);let i=L.order.indexOf(m.dataset.mod);if(s==='after')i++;L.order.splice(i,0,dragId);}
    dragId=null;clear();changed();});
  board.addEventListener('dragend',()=>{dragId=null;clear();board.querySelectorAll('.mod[draggable="true"]').forEach(m=>m.draggable=false);});
  const setEdit=on=>{document.body.classList.toggle('editing',on);$('layoutBtn').setAttribute('aria-pressed',on);$('layoutBtn').textContent=on?'Done':'Customize';};
  $('layoutBtn').addEventListener('click',()=>setEdit(!document.body.classList.contains('editing')));
  $('layoutDone').addEventListener('click',()=>setEdit(false));
  $('layoutReset').addEventListener('click',()=>{L={order:defOrder.slice(),w:{},hidden:[]};changed();});
})();

// ---------- version and update log ----------
// Add a release at the top whenever something visible changes (dashboard or widget).
const CHANGELOG=[
  {v:'1.7',date:'2026-10-14',items:[
    'Fixed: the picture menu under a player name now closes when you click away, press Escape, click the name again or finish an upload',
    'Duo / Solo / All switch at the top: Duo (the default) counts only games with both of us, Solo shows games with just one of us, All shows everything',
    'All-time records: most days played in a row, longest break between game days, and the current run or days since we last played',
    'Night theme: mellow greyscale with red accents. The look switch is now a theme icon that opens a round picker (Classic, Neon, Night, and one slot saved for later); the heatmap and 3D map can also be set to Night on their own',
    'Small calendar at the top right of the header: this month, with the days we played lit up (hover a day for the game count)',
    'Since-last-goal timer restyled: the width of the name card, time in a green pill, "since last goal" in purple digital type underneath',
    'Played before: opponents we have met before get a badge with how many games and our record against them, in the match log and match details; the widget shows it on its MMR line during a live match',
    'Eleven new panels: shot map with misses and scoring % by zone, demo rivalries, kickoff battles, touch heatmaps, momentum graph, trophy case, post and crossbar hits, MMR by session with streaks, boost at goals against, duo synergy, and hardest shots with a 3D replay button',
    'Widget update: records shots, demos, kickoffs, post hits, momentum and everyone\'s boost when a goal goes in (click Check updates)',
    'Timelapse and Spirograph panels on the dashboard: pick a game to replay its touches, or watch it drawn as trippy spirograph loops from the ball and every car',
    'Match timelapse: open a match to watch the cars move between their ball touches on the overhead field (new games)',
    'A live timer under each name at the top: time since that player last scored',
    'Player pictures: click your name at the top to upload one, and it shows next to your name across the dashboard',
    'Neon or Classic look for the whole dashboard, switched at the top (each map can still have its own)',
    'Customize your dashboard: drag panels into any order, make them half or full width, or hide them (saved in your browser)',
    'Neon look (black, fluorescent green and purple) for the heatmaps and the 3D maps, each switched on its own',
    'The mini 3D map now has the cyberpunk replay look and plays the hovered goal itself, instead of a pop-up',
    'Controller support works with more wireless and PlayStation pads, survives Bluetooth drop-outs, and any button jumps to the 3D map',
    'Mini spinning 3D goal map under the goal mouth; click it for the full view',
    'Hover a goal in the 3D view to play its replay',
    'Up to four players: pick the names you track from the widget\'s Players... menu (it asks the first time)',
    'Defense panel: where our saves happen, opponent shots per game and their shooting %',
    'Counter goals in Playstyle, and win rate after going down or up by one to three goals',
    'Match length now comes from the match clock, so time-based stats use the real length of each game',
    'Run your own copy of the dashboard on a Windows PC with dashboard.bat']},
  {v:'1.6',date:'2026-10-14',items:[
    'Drive the 3D goal map with a game controller: sticks move and turn, triggers zoom, A plays the next goal',
    'Goal map balls are magnetic: the nearest one snaps on as your mouse gets close',
    'Our saves on the goal map: where we saved each shot, where it came from, where it was heading, with a 3D replay. Recorded from the next widget update on',
    'Fixed the goal maps and 3D replays being mirrored left to right',
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
