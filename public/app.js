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
function toKmh(v){return v==null?null:v>300?Math.round(v*0.036):v;}
// The Stats API sends a loadout as a list of item codes with the car body first ("body_grain").
// Codes we know the in-game name of go here; anything else is shown tidied up.
const CAR_NAMES={};
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
  const prof=[{g:.95,sh:3.2,sv:1.25,d:.85,t:28,boost:44,ss:17,air:9,wall:12,gs:91,bump:2.6},{g:.78,sh:2.7,sv:1.75,d:1.45,t:30,boost:39,ss:13,air:6,wall:15,gs:84,bump:3.8}];
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
  const matches=[],mmr=[];let rating=[948,1004];
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
        const who=rnd()<.55?0:1;lines[who].goals++;const as=rnd()<.55;if(as)lines[1-who].assists++;
        goals.push({team:my,ours:true,scorer:names[who],assister:as?names[1-who]:null,speed:Math.round(clamp(norm(prof[who].gs,18),35,140)),...pos(spot(who?.8:1),f)});
      }
      for(let g=0;g<them;g++)goals.push({team:1-my,ours:false,scorer:'Opponent',speed:Math.round(clamp(norm(86,18),35,140)),...pos(spot(1.1),-f)});
      const players=prof.map((p,j)=>{
        const L=lines[j],shots=L.goals+pois(Math.max(.4,p.sh-p.g)),saves=pois(p.sv*(them>2?1.25:1)),demos=pois(p.d),touches=Math.max(8,Math.round(norm(p.t,5)));
        const air=+clamp(norm(p.air,1.8),1,20).toFixed(1),wall=+clamp(norm(p.wall,2.5),3,25).toFixed(1);
        return {name:names[j],team:my,tracked:true,goals:L.goals,assists:L.assists,shots,saves,demos,touches,
          score:100*L.goals+50*L.assists+50*saves+20*shots+15*demos+2*touches+Math.floor(rnd()*40),
          car_touches:pois(p.bump),boost_pickups:Math.round(clamp(norm(j?34:29,6),8,70)),loadout:{Car:j?'Fennec':'Octane'},avg_boost:Math.round(clamp(norm(p.boost,5),20,70)),pct_supersonic:+clamp(norm(p.ss,3),3,35).toFixed(1),pct_zero_boost:+clamp(norm(j?9:7,3),1,25).toFixed(1),zero_boost_fixed:true,
          pct_air:air,pct_wall:wall,pct_ground:+(100-air-wall).toFixed(1),hardest_hit:Math.round(clamp(norm(p.gs+25,15),60,160))};
      });
      matches.push({match_guid:'sample-'+si+'-'+k,started_at:new Date(t).toISOString(),duration_seconds:dur,playlist:warm?'Casual Doubles':'Ranked Doubles',arena:pick(arenas),
        overtime:ot,my_team:my,result:win?'Win':'Loss',team_score:us,opponent_score:them,goals,players,
        replay_created:rnd()<.2?new Date(t+dur*1000).toISOString():null,
        players_left:rnd()<.08?[{name:'Opponent',team:1-my}]:[],spectators:crowd,drinks:{[names[0]]:Math.floor(k*.7)}});
      t+=(dur+60+Math.floor(rnd()*90))*1000;
    }
    rating=rating.map((v,j)=>Math.round(v+w*(8.5+j)+norm(0,6)));
    names.forEach((nm,j)=>mmr.push({logged_at:new Date(t).toISOString(),player:nm,playlist:'Ranked Doubles',mmr:rating[j]}));
  });
  return {matches,mmr};
}

// ---------- model ----------
let PLAYERS=[], RAW={matches:[],mmr:[]}, SAMPLE=false;
let ALL=[], DONE=[], sessions=[], NOW=Date.now();
const SPECTATORS=['Morgan','Chance','Nick'];
let period='30', mode='avg', metric='winpct', playlist=null, mapSide='us', mapWho='all';
try{const s=JSON.parse(localStorage.getItem('rl-duo-ui')||'{}');if(s.period)period=s.period;if(s.mode)mode=s.mode;if(s.metric)metric=s.metric;if(s.playlist)playlist=s.playlist;}catch(e){}
const saveUi=()=>{try{localStorage.setItem('rl-duo-ui',JSON.stringify({period,mode,metric,playlist}))}catch(e){}};

function toMatch(r){
  const rows=r.players||[];
  const lines=PLAYERS.map(p=>{
    const row=rows.find(x=>x&&x.name===p.name);if(!row)return null;
    return {score:num(row.score)||0,goals:num(row.goals)||0,assists:num(row.assists)||0,shots:num(row.shots)||0,saves:num(row.saves)||0,
      demos:num(row.demos)||0,touches:num(row.touches)||0,bumps:num(row.car_touches),boost:num(row.avg_boost),ss:num(row.pct_supersonic),
      air:num(row.pct_air),wall:num(row.pct_wall),ground:num(row.pct_ground),hardest:toKmh(num(row.hardest_hit)),
      pickups:num(row.boost_pickups),car:carName(row.loadout),
      noBoost:row.zero_boost_fixed&&num(row.pct_zero_boost)!=null?num(row.pct_zero_boost)/100*(num(r.duration_seconds)||300):null,
      goalSpeeds:(r.goals||[]).filter(g=>g&&g.scorer===p.name&&num(g.speed)!=null).map(g=>+g.speed)};
  });
  const myTeam=num(r.my_team);
  const goals=(r.goals||[]).filter(Boolean).map(g=>{
    const team=num(g.team), f=team===1?-1:1, s=g.shot_from, i=g.impact;
    const ours=g.ours!=null?!!g.ours:(myTeam!=null&&team===myTeam);
    const who=ours?PLAYERS.findIndex(p=>p.name===(g.shot_from_player||g.scorer)):-1;
    return {ours,who,spd:num(g.speed)!=null?Math.round(+g.speed):null,
      x:co(s,'X')!=null?f*co(s,'X'):null,y:co(s,'Y')!=null?f*co(s,'Y'):null,
      ix:co(i,'X')!=null?f*co(i,'X'):null,iz:co(i,'Z')};
  });
  const dur=num(r.duration_seconds)||300;
  const left=(r.players_left||[]).filter(Boolean).map(x=>({name:x.name,ours:myTeam!=null&&num(x.team)===myTeam}));
  return {guid:r.match_guid,when:new Date(r.started_at),win:r.result==='Win',us:num(r.team_score)||0,them:num(r.opponent_score)||0,
    ot:!!r.overtime,dur,arena:arenaName(r.arena),playlist:r.playlist||'Unknown playlist',lines,
    ourGoals:goals.filter(g=>g.ours),theirGoals:goals.filter(g=>!g.ours),
    replay:!!r.replay_created,left,
    spectators:Array.isArray(r.spectators)?r.spectators.map(String):null,
    drinks:r.drinks&&num(r.drinks[PLAYERS[0].name])!=null?num(r.drinks[PLAYERS[0].name]):null};
}

function build(){
  const done=RAW.matches.filter(r=>r&&(r.result==='Win'||r.result==='Loss')&&r.started_at).map(toMatch).filter(m=>!isNaN(m.when));
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
function agg(list){
  return PLAYERS.map((p,j)=>{
    const L=list.map(m=>m.lines[j]).filter(Boolean);
    const t={games:L.length,mvp:0,both:0};
    ['score','goals','assists','shots','saves','demos','touches'].forEach(k=>t[k]=L.reduce((s,l)=>s+l[k],0));
    const avg=k=>{const v=L.map(l=>l[k]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
    ['boost','ss','air','wall','ground','bumps','pickups'].forEach(k=>t[k]=avg(k));
    const cars={};L.forEach(l=>{if(l.car)cars[l.car]=(cars[l.car]||0)+1;});
    t.car=Object.keys(cars).sort((a,b)=>cars[b]-cars[a])[0]||null;
    t.shotpct=t.shots?100*t.goals/t.shots:null;
    const sp=L.flatMap(l=>l.goalSpeeds);
    t.gsAvg=sp.length?sp.reduce((a,b)=>a+b,0)/sp.length:null;t.gsMax=sp.length?Math.max(...sp):null;
    const nb=L.map(l=>l.noBoost).filter(v=>v!=null);t.noBoost=nb.length?nb.reduce((a,b)=>a+b,0):null;t.noBoostGames=nb.length;
    const hh=L.map(l=>l.hardest).filter(v=>v!=null);t.hardest=hh.length?Math.max(...hh):null;
    list.forEach(m=>{const a=m.lines[j],b=m.lines[1-j];if(a&&b){t.both++;if(a.score>b.score)t.mvp++;}});
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
    PLAYERS.map((p,j)=>A[j].games?`<tr><td><span class="tag p${j+1}" style="padding:1px 8px"><i></i>${esc(p.short)}</span></td>`+cols.map(c=>{const v=A[j][c[0]],o=A[1-j][c[0]];return `<td${A[1-j].games&&v>o?' style="font-weight:600"':''}>${v}</td>`;}).join('')+'</tr>':'').join('')+'</tbody>';
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
    return `<div class="cmp-row"><span class="stat">${label}</span>`+vals.map((v,j)=>`<div class="bar"><span class="val ${v!=null&&vals[1-j]!=null&&v>vals[1-j]?'lead':''}">${fmt(v)}</span><div class="track"><div class="fill" style="width:${v==null?0:(100*v/mx).toFixed(1)}%;background:${PLAYERS[j].color}"></div></div></div>`).join('')+'</div>';
  });
  $('cmp').innerHTML=`<div class="cmp-row head"><span>${list.length} games</span>`+PLAYERS.map((p,j)=>`<span class="tag p${j+1}" style="justify-self:start"><i></i>${esc(p.name)} · ${A[j].games}</span>`).join('')+'</div>'+rows.join('');
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
    series=[{name:'Duo win rate',color:'var(--ink-2)',area:true,values:sessions.map(s=>100*s.matches.filter(m=>m.win).length/s.matches.length)}];
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
  const rows=PLAYERS.map((p,j)=>mmrRows(j));
  if(!rows[0].length&&!rows[1].length){$('mmrChart').innerHTML='<p class="note">No MMR logged for '+esc(mmrPlaylist())+' yet.</p>';return;}
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
function renderMaps(list){
  let goals=list.flatMap(m=>(mapSide==='us'?m.ourGoals:m.theirGoals).map(g=>({...g,m})));
  if(mapSide==='us'&&mapWho!=='all')goals=goals.filter(g=>g.who===+mapWho);
  const shots=goals.filter(g=>g.x!=null&&g.y!=null), hits=goals.filter(g=>g.ix!=null&&g.iz!=null);
  $('mapWho').style.visibility=mapSide==='us'?'visible':'hidden';
  const col=g=>g.who>=0?PLAYERS[g.who].color:'var(--opp)';
  const tip=g=>`${g.who>=0?PLAYERS[g.who].short:mapSide==='us'?'Us':'Opponent'}${g.spd!=null?' · '+g.spd+' km/h':''} · ${g.m.us}–${g.m.them} ${g.m.win?'win':'loss'}, ${fmtDate(g.m.when)}`;
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
  shots.forEach(g=>{f+=`<circle class="dot" cx="${sx(clamp(g.x,-4096,4096))}" cy="${sy(clamp(g.y,-5120,5120))}" r="2.5" fill="#fff" fill-opacity=".9" stroke="#0b1017" stroke-opacity=".6" stroke-width="1"><title>${esc(tip(g))}</title></circle>`;});
  $('fieldMap').innerHTML=`<svg viewBox="0 -18 ${W} ${H+36}" role="img" aria-label="Top-down field with ${shots.length} shot locations">${f}</svg>`;
  const NW=440,m=24,NH=Math.round((NW-2*m)*642/1786)+m+22;
  const nx=x=>m+(clamp(x,-893,893)+893)/1786*(NW-2*m),nz=z=>m+(642-clamp(z,0,642))/642*(NH-m-22);
  let n=`<rect x="${nx(-893)}" y="${nz(642)}" width="${nx(893)-nx(-893)}" height="${nz(0)-nz(642)}" fill="var(--surface-2)"/>`;
  for(let i=1;i<3;i++)n+=`<line x1="${nx(-893+i*1786/3)}" x2="${nx(-893+i*1786/3)}" y1="${nz(642)}" y2="${nz(0)}" stroke="var(--line)" stroke-dasharray="3 4"/><line x1="${nx(-893)}" x2="${nx(893)}" y1="${nz(i*214)}" y2="${nz(i*214)}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
  const zones={};hits.forEach(g=>{const zc=clamp(Math.floor((g.ix+893)/(1786/3)),0,2),zr=clamp(Math.floor(g.iz/214),0,2);zones[zc+','+zr]=(zones[zc+','+zr]||0)+1;});
  const zmax=Math.max(1,...Object.values(zones)),labels=[];
  for(let c=0;c<3;c++)for(let r=0;r<3;r++){const v=zones[c+','+r]||0,pct=hits.length?Math.round(100*v/hits.length):0;
    const x0=nx(-893+c*1786/3),y0=nz((r+1)*214),zw=nx(-893+1786/3)-nx(-893),zh=nz(0)-nz(214);
    n+=`<rect x="${x0+1}" y="${y0+1}" width="${zw-2}" height="${zh-2}" fill="${heatColor(v/zmax)}" opacity="${hits.length?.6:0}"><title>${v} goals (${pct}%)</title></rect>`;
    if(hits.length)labels.push(`<text class="zone" x="${x0+zw/2}" y="${y0+zh/2+5}" text-anchor="middle" paint-order="stroke" stroke="rgba(11,16,23,.55)" stroke-width="3" fill="#fff" style="fill:#fff">${pct}%</text>`);}
  n+=`<path d="M${nx(-893)},${nz(0)} L${nx(-893)},${nz(642)} L${nx(893)},${nz(642)} L${nx(893)},${nz(0)}" stroke="var(--ink-2)" stroke-width="4" fill="none" stroke-linejoin="round"/>`;
  n+=`<line x1="4" x2="${NW-4}" y1="${nz(0)}" y2="${nz(0)}" stroke="var(--line)" stroke-width="2"/>`;
  n+=`<text x="${nx(-893)}" y="${NH-4}">Left post</text><text x="${nx(893)}" y="${NH-4}" text-anchor="end">Right post</text><text x="${NW/2}" y="${nz(642)-8}" text-anchor="middle">Crossbar</text>`;
  hits.forEach(g=>{n+=`<circle class="dot" cx="${nx(g.ix)}" cy="${nz(g.iz)}" r="3.5" fill="${col(g)}" stroke="#fff" stroke-width="1.5"><title>${esc(tip(g))}</title></circle>`;});
  n+=labels.join('');
  $('netMap').innerHTML=`<svg viewBox="0 0 ${NW} ${NH}" role="img" aria-label="Goal mouth with ${hits.length} impact points">${n}</svg>`;
  $('fieldTitle').textContent=mapSide==='us'?'Where our goals were shot from':'Where their goals were shot from';
  $('netTitle').textContent=mapSide==='us'?'Where our goals hit the net':'Where their goals beat us';
  $('mapLegend').innerHTML=mapSide==='us'?PLAYERS.filter((p,j)=>mapWho==='all'||+mapWho===j).map(p=>`<span><i style="background:${p.color};height:8px;width:8px"></i>${esc(p.name)}</span>`).join(''):'<span><i style="background:var(--opp);height:8px;width:8px"></i>Opponents</span>';
  const top=Object.entries(zones).sort((a,b)=>b[1]-a[1])[0];
  const zname=k=>{const [c,r]=k.split(',').map(Number);return ['low','middle','high'][r]+' '+['left','centre','right'][c];};
  const sp=goals.filter(g=>g.spd!=null),avgSpd=sp.length?Math.round(sp.reduce((a,g)=>a+g.spd,0)/sp.length):null;
  const missing=goals.length-hits.length;
  $('mapNote').textContent=!goals.length?'No goals in this period.':
    `${goals.length} goals${avgSpd!=null?', average '+avgSpd+' km/h':''}.`+(top?` Most went in ${zname(top[0])} (${Math.round(100*top[1]/hits.length)}%).`:'')+
    (missing?` ${missing} goal${missing>1?'s were':' was'} recorded before positions were saved.`:'')+' The net is drawn as you would see it facing the goal.';
}

// ---------- playstyle ----------
function renderPlay(list){
  const A=agg(list),f=(v,d=0,u='')=>v==null?'–':v.toFixed(d)+u;
  $('split').innerHTML='<div class="split-row"><span></span><div class="legend"><span><i style="background:var(--ink-2)"></i>Ground</span><span><i style="background:var(--muted)"></i>Wall</span><span><i style="background:var(--p1)"></i>Air</span></div></div>'+
    PLAYERS.map((p,j)=>{const a=A[j];if(a.ground==null)return `<div class="split-row"><span class="tag p${j+1}" style="padding:1px 8px"><i></i>${esc(p.short)}</span><span class="note">No movement data yet</span></div>`;
      return `<div class="split-row"><span class="tag p${j+1}" style="padding:1px 8px"><i></i>${esc(p.short)}</span><div class="stack" title="Ground ${f(a.ground)}%, wall ${f(a.wall)}%, air ${f(a.air)}%">
      <div style="width:${a.ground}%;background:var(--ink-2)">${f(a.ground)}%</div><div style="width:${a.wall}%;background:var(--muted)">${f(a.wall)}%</div><div style="width:${a.air}%;background:${p.color}">${f(a.air)}%</div></div></div>`;}).join('');
  const rows=[['Avg boost held',a=>f(a.boost)],['Time supersonic',a=>f(a.ss,1,'%')],['Avg goal speed',a=>f(a.gsAvg,0,' km/h')],['Hardest goal',a=>f(a.gsMax,0,' km/h')],['Hardest hit',a=>f(a.hardest,0,' km/h')],['Bumps / game',a=>f(a.bumps,1)],['Boost pads / game',a=>f(a.pickups,1)],['Main car',a=>a.car?esc(a.car):'–'],['I Got No Boost',a=>a.noBoost==null?'–':`<span title="${fmtDur(a.noBoost/a.noBoostGames)} a game">${fmtDur(a.noBoost)}</span>`]];
  $('playKv').innerHTML=`<div class="h">Stat</div><div class="h v">${esc(PLAYERS[0].short)}</div><div class="h v">${esc(PLAYERS[1].short)}</div>`+rows.map(r=>`<div>${r[0]}</div><div class="v">${r[1](A[0])}</div><div class="v">${r[1](A[1])}</div>`).join('');
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

// ---------- match log ----------
function renderLog(list){
  const rows=[...list].reverse().slice(0,15);
  $('logCount').textContent=list.length?'Latest '+rows.length+' of '+list.length:'';
  const line=L=>L?`${L.goals}·${L.assists}·${L.saves}`:'–';
  $('matchLog').innerHTML=`<thead><tr><th>When</th><th>Result</th><th>Score</th><th>Arena</th><th>${esc(PLAYERS[0].short)} G·A·Sv</th><th>${esc(PLAYERS[1].short)} G·A·Sv</th><th>Top score</th><th>Notes</th></tr></thead><tbody>`+
    rows.map(m=>{const L=m.lines;const top=L[0]&&L[1]?(L[0].score>=L[1].score?0:1):L[0]?0:L[1]?1:-1;
      return `<tr><td>${fmtDate(m.when)} ${fmtTime(m.when)}</td><td><span class="pill ${m.win?'w':'l'}">${m.win?'W':'L'}</span></td><td>${m.us}–${m.them}${m.ot?' <span class="muted">OT</span>':''}</td><td>${esc(m.arena)}</td><td>${line(L[0])}</td><td>${line(L[1])}</td><td>${top<0?'–':`<span class="tag p${top+1}" style="padding:0 7px"><i></i>${esc(PLAYERS[top].short)} ${L[top].score}</span>`}</td><td class="notes">${notes(m)}</td></tr>`;}).join('')+'</tbody>';
}

function notes(m){
  const out=[];
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
function renderPeriod(){const list=inPeriod();renderSummary(list);renderCmp(list);renderMaps(list);renderPlay(list);renderCrowd(list);renderLog(list);syncButtons();}
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
  const names=(data&&data.players&&data.players.length>=2?data.players:['jay29ID','Kobra Kelvin']).slice(0,2);
  PLAYERS=names.map((n,j)=>({name:n,short:(s=>s?s[0].toUpperCase()+s.slice(1):n)(n.split(/\s+/)[0].replace(/\d+.*$/,'')),color:j?'var(--p2)':'var(--p1)'}));
  document.querySelectorAll('.tag.p1').forEach(el=>{if(el.closest('header'))el.innerHTML='<i></i>'+esc(PLAYERS[0].name);});
  document.querySelectorAll('.tag.p2').forEach(el=>{if(el.closest('header'))el.innerHTML='<i></i>'+esc(PLAYERS[1].name);});
  const who=$('mmrWho').value;
  $('mmrWho').innerHTML=PLAYERS.map((p,j)=>`<option value="${j}">${esc(p.name)}</option>`).join('');
  if(who)$('mmrWho').value=who;
  document.querySelectorAll('#mapWho button[data-w]').forEach(b=>{if(b.dataset.w!=='all')b.textContent=PLAYERS[+b.dataset.w].short;});
  const real=data&&data.matches&&data.matches.some(r=>r&&(r.result==='Win'||r.result==='Loss'));
  SAMPLE=!real;
  RAW=real?{matches:data.matches,mmr:data.mmr||[]}:makeSample(names);
  if(real&&!RAW.mmr)RAW.mmr=[];
  $('dataBadge').hidden=!SAMPLE;
  $('banner').hidden=!SAMPLE;
  $('banner').textContent=SAMPLE?'No matches have been uploaded yet, so this shows sample data. It switches to your real stats as soon as the recorder sends the first finished match.':'';
  renderAll();
}
load();
// New matches arrive from the recorder a few seconds after each game; pick them up without a reload.
setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
})();
