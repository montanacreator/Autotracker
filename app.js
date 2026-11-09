const K='automanager-v1';
let S={set:{tank:50,tuv:'',insp:'',inspKm:''},fuel:[],maint:[],cost:[],appt:[],theme:null,sec:''};
try{const r=localStorage.getItem(K);if(r)S=Object.assign(S,JSON.parse(r))}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}};
let tab='d';
const today=new Date().toISOString().slice(0,10);
const N=(v,d=2)=>isFinite(v)?Number(v).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}):'–';
const E=v=>N(v)+' €';
const D=s=>s?new Date(s+'T00:00').toLocaleDateString('de-DE'):'–';
const days=s=>Math.round((new Date(s+'T00:00')-new Date(today+'T00:00'))/864e5);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function calc(){
  const f=[...S.fuel].sort((a,b)=>a.km-b.km||a.date.localeCompare(b.date));
  let last=null,l=0,c=0,sk=0,sl=0,sc=0;
  f.forEach(x=>{
    x.cons=null;
    if(last===null){if(x.full){last=x.km;l=0;c=0}return}
    l+=x.l;c+=x.cost;
    if(x.full){const km=x.km-last;if(km>0){x.cons=l/km*100;sk+=km;sl+=l;sc+=c}last=x.km;l=0;c=0}
  });
  const tl=f.reduce((a,x)=>a+x.l,0),tc=f.reduce((a,x)=>a+x.cost,0);
  const month=today.slice(0,7);
  const mf=f.filter(x=>x.date.startsWith(month)).reduce((a,x)=>a+x.cost,0);
  const oc=allCosts().filter(x=>x.cat!=='Tanken'&&x.date<=today);
  const mm=oc.filter(x=>x.date.startsWith(month)).reduce((a,x)=>a+x.amount,0);
  const mt=oc.reduce((a,x)=>a+x.amount,0);
  const km=Math.max(0,+S.set.km||0,...f.map(x=>x.km),...S.maint.map(m=>m.km||0));
  const avg=sk?sl/sk*100:null;
  let lvl=null;
  const lf=[...f].reverse().find(x=>x.full);
  if(lf&&avg!==null){
    const add=f.filter(x=>x.km>lf.km).reduce((a,x)=>a+x.l,0);
    const used=(km-lf.km)*avg/100;
    lvl=Math.max(0,Math.min(S.set.tank,S.set.tank+add-used));
  }
  return {f,tl,tc,mf,mm,mt,km,avg,sk,sl,sc,lvl,
    price:tc?tc/f.filter(x=>x.cost).reduce((a,x)=>a+x.l,0):null,c100:sk?sc/sk*100:null,ckm:sk?sc/sk:null};
}

function warns(k){
  const w=[],s=S.set;
  if(s.tuv){const d=days(s.tuv);
    if(d<0)w.push(['bad',`TÜV seit ${-d} Tagen überfällig (${D(s.tuv)})`]);
    else if(d<=60)w.push([d<=14?'bad':'',`TÜV in ${d} Tagen fällig (${D(s.tuv)})`]);}
  if(s.insp){const d=days(s.insp);
    if(d<0)w.push(['bad',`Inspektion seit ${-d} Tagen überfällig`]);
    else if(d<=60)w.push([d<=14?'bad':'',`Inspektion in ${d} Tagen fällig (${D(s.insp)})`]);}
  if(s.inspKm&&k.km){const r=s.inspKm-k.km;
    if(r<=0)w.push(['bad',`Inspektions-Kilometerstand um ${N(-r,0)} km überschritten`]);
    else if(r<=1500)w.push(['',`Inspektion in ${N(r,0)} km fällig`]);}
  if(k.lvl!==null&&k.lvl<S.set.tank*0.15)w.push(['bad',`Tank fast leer (ca. ${N(k.lvl,0)} L)`]);
  reminders(k).filter(r=>r.src!=='set'&&r.soon).forEach(r=>w.push([r.bad?'bad':'',`${r.bad?'🔴 ':''}${esc(r.title)}: ${r.txt}`]));
  return w;
}
const card=(l,v,u='',cls='')=>`<div class="c ${cls}"><div class="l">${l}</div><div class="n">${v}${u?` <small>${u}</small>`:''}</div></div>`;

let hasMore=false;
function dash(){
  const k=calc(),s=S.set,w=warns(k);
  const up=reminders(k).filter(r=>r.src!=='set');hasMore=w.length>0||up.length>0;
  const tuvD=s.tuv?days(s.tuv):null,inD=s.insp?days(s.insp):null;
  let h=`<div class="g">
  ${card('Kilometerstand',N(k.km,0),'km','hero')}
  ${card('Nächster TÜV',s.tuv?D(s.tuv):'–',tuvD!==null?`in ${tuvD} T.`:'')}
  ${card('Nächste Inspektion',s.insp?D(s.insp):(s.inspKm?N(s.inspKm,0)+' km':'–'),inD!==null?`in ${inD} T.`:'')}
  ${card('Kosten diesen Monat',E(k.mf+k.mm))}
  ${card('Gesamtkosten Auto',E(k.tc+k.mt))}
  <div class="c"><div class="l">Tankstand (geschätzt)</div><div class="n">${k.lvl!==null?N(k.lvl,0):'–'} <small>/ ${N(s.tank,0)} L</small></div>
  <div class="bar"><i style="width:${k.lvl!==null?k.lvl/s.tank*100:0}%"></i></div></div></div>
  ${w.length?`<div class="s"><h2>Warnungen</h2>${w.map(x=>`<div class="al ${x[0]}">${x[1]}</div>`).join('')}</div>`:''}
  <div class="s"><h2>Letzte Tankvorgänge</h2>${fuelTable([...k.f].reverse().slice(0,hasMore?5:3),false)}</div>
  ${up.length?`<div class="s"><h2>Anstehende Wartungen</h2>${upcoming()}</div>`:''}`;
  return h;
}
function upcoming(){
  const u=reminders().filter(r=>r.src!=='set');
  return u.length?u.map(r=>`<div class="al ${r.bad?'bad':''}">${r.bad?'🔴 ':''}<b>${esc(r.title)}</b> ${r.txt}</div>`).join(''):'<div class="em">Keine Wartungen oder Termine geplant. Lege sie unter „Wartungen“ oder „Termine“ an.</div>';
}
function fuelTable(rows,del){
  if(!rows.length)return '<div class="em">Noch kein Tankvorgang gespeichert.</div>';
  return rows.map(x=>`<div class="c" style="margin-bottom:8px;display:flex;gap:12px;align-items:center;justify-content:space-between">
  <div style="min-width:0"><div><b>${D(x.date)}</b> <span style="color:var(--mu)">${esc(x.station)} ${esc(x.fuelType)}</span></div>
  <div style="color:var(--mu);font-size:13px">${N(x.km,0)} km · ${N(x.l)} L${x.price?' · '+N(x.price,3)+' €/L':''} · ${x.cost?E(x.cost):'–'}</div></div>
  <div style="text-align:right;white-space:nowrap;margin-left:auto">${consCell(x)}</div>${del?`<button class="x" data-del="${x.id}" aria-label="Löschen">×</button>`:''}</div>`).join('');
}
function consCell(x){
  let v=x.cons,man=false;
  if((v===null||v===undefined)&&x.consIn>0){v=x.consIn;man=true}
  if(v===null||v===undefined)return `<span style="color:var(--mu);font-size:13px">${x.full?'noch kein Verbrauch':'teilgetankt'}</span>`;
  return `<div class="n" style="font-size:26px">${N(v)}</div><div style="color:var(--mu);font-size:12px">L/100 km${man?' · Bordcomputer':''}</div>`;
}
function tank(){
  const k=calc();
  const months={};k.f.forEach(x=>{const m=x.date.slice(0,7);months[m]=(months[m]||0)+x.cost});
  const ms=Object.keys(months).sort().reverse();
  return `<h2>Tankvorgang speichern</h2><div class="c"><form id="ff"><div id="rbox" style="grid-column:1/-1;display:none"><label>Kassenzettel-Foto hochladen, Daten werden automatisch ausgelesen (optional)<input type="file" id="rc" accept="image/*"></label><div id="rs" style="font-size:13px;margin-top:6px"></div></div>
  <label>Datum<input type="date" name="date" value="${today}" required></label>
  <label>Kilometerstand<input type="number" name="km" min="0" step="1" value="${k.km||''}" required></label>
  <label>Liter<input type="number" name="l" min="0.01" step="0.01" required></label>
  <label>Preis pro Liter (€, optional)<input type="number" name="price" min="0" step="0.001"></label>
  <label>Gesamtkosten (€, optional)<input type="number" name="cost" min="0" step="0.01"></label>
  <label>Tankstelle (optional)<input name="station" placeholder="z. B. Aral"></label>
  <label>Kraftstoff<select name="fuelType"><option>Super E10</option><option>Super E5</option><option>Super Plus</option><option>Diesel</option><option>LPG</option><option>Strom</option></select></label>
  <label>Verbrauch lt. Bordcomputer (L/100 km, optional)<input type="number" name="cons" min="0" step="0.1"></label>
  <label class="ck"><input type="checkbox" name="full" checked> Volltank</label>
  <button class="b" type="submit">Tankvorgang speichern</button></form></div>
  <div class="s"><h2>Auswertung</h2><div class="g">
  ${card('Ø Verbrauch',N(k.avg),'L/100 km','hero')}
  ${card('Ø Literpreis',k.price?N(k.price,3):'–','€/L')}
  ${card('Kosten pro 100 km',k.c100!==null?N(k.c100):'–','€')}
  ${card('Kosten pro km',k.ckm!==null?N(k.ckm,3):'–','€')}
  ${card('Tankkosten diesen Monat',E(k.mf))}
  ${card('Tankkosten gesamt',E(k.tc))}</div>
  <p class="l" style="color:var(--mu);font-size:13px">Der Verbrauch wird zwischen zwei Volltankungen berechnet. Teilbetankungen dazwischen fließen mit ein.</p></div>
  ${ms.length?`<div class="s"><h2>Monatliche Tankkosten</h2><div class="t c"><table>${ms.map(m=>`<tr><td>${m.slice(5)}/${m.slice(0,4)}</td><td>${E(months[m])}</td></tr>`).join('')}</table></div></div>`:''}
  <div class="s"><h2>Alle Tankvorgänge</h2>${fuelTable([...k.f].reverse(),true)}</div>`;
}
const CATS=['Versicherung','Steuer','Reparaturen','Inspektion','Reifen','Waschen','Parken','Maut','Ersatzteile','Sonstiges'];
const TYPES=['Ölwechsel','Bremsen','Reifenwechsel','Luftfilter','Ölfilter','Batterie','Bremsflüssigkeit','Kühlmittel','Inspektion','Sonstiges'];
const MAPC={Inspektion:'Inspektion',Reifenwechsel:'Reifen',Luftfilter:'Ersatzteile',Ölfilter:'Ersatzteile',Batterie:'Ersatzteile'};
function allCosts(){
  return [...S.fuel.map(x=>({date:x.date,cat:'Tanken',amount:x.cost})),
    ...S.cost.map(x=>({date:x.date,cat:x.cat,amount:x.amount})),
    ...S.maint.filter(m=>m.cost).map(m=>({date:m.date,cat:MAPC[m.type]||'Reparaturen',amount:m.cost}))];
}
function reminders(k){
  k=k||calc();const r=[],s=S.set;
  const add=(title,date,km,src,id)=>{
    const d=date?days(date):null,rk=km?km-k.km:null;
    const bad=(d!==null&&d<0)||(rk!==null&&rk<=0);
    r.push({title,date,km,d,rk,bad,src,id,soon:bad||(d!==null&&d<=30)||(rk!==null&&rk<=1000),
      txt:[date?`${D(date)}, ${d<0?`${-d} Tage überfällig`:`noch ${d} Tage`}`:'',km?`bei ${N(km,0)} km, ${rk<=0?'fällig':`noch ${N(rk,0)} km`}`:''].filter(Boolean).join(' · ')});
  };
  if(s.tuv)add('TÜV',s.tuv,0,'set');
  if(s.insp||s.inspKm)add('Inspektion',s.insp,+s.inspKm,'set');
  S.appt.forEach(a=>add(a.title,a.date,0,'appt',a.id));
  const seen={};
  [...S.maint].sort((a,b)=>b.date.localeCompare(a.date)).forEach(m=>{
    if(seen[m.type])return;seen[m.type]=1;
    if(m.nextDate||m.nextKm)add(m.type+' fällig',m.nextDate,m.nextKm,'maint');
  });
  return r.sort((a,b)=>(a.bad?-1e6:0)+(a.d??9999)-((b.bad?-1e6:0)+(b.d??9999)));
}
const opts=l=>l.map(c=>`<option>${esc(c)}</option>`).join('');
function kosten(){
  const y=today.slice(0,4),mo=today.slice(0,7),a=allCosts().filter(x=>x.date<=today);
  const sum=l=>l.reduce((t,x)=>t+x.amount,0);
  const yr=a.filter(x=>x.date.startsWith(y)),by={};
  yr.forEach(x=>by[x.cat]=(by[x.cat]||0)+x.amount);
  const tot=sum(yr),ks=Object.keys(by).sort((p,q)=>by[q]-by[p]);
  const cs=[...S.cost].sort((p,q)=>q.date.localeCompare(p.date));
  return `<div class="c hero"><div class="l">Das Auto hat dich diesen Monat gekostet</div><div class="n">${E(sum(a.filter(x=>x.date.startsWith(mo))))}</div></div>
  <div class="g s">${card('Gesamtkosten '+y,E(tot))}${card('Gesamtkosten seit Start',E(sum(a)))}</div>
  <div class="s"><h2>Kosten erfassen</h2><div class="c"><form id="fc">
  <label>Datum<input type="date" name="date" value="${today}" required></label>
  <label>Kategorie<select name="cat">${opts(CATS)}</select></label>
  <label>Betrag (€)<input type="number" name="amount" min="0" step="0.01" required></label>
  <label>Notiz<input name="note"></label>
  <button class="b" type="submit">Kosten speichern</button></form></div>
  <p style="color:var(--mu);font-size:13px">Tankvorgänge und Wartungen mit Kosten werden automatisch übernommen.</p></div>
  <div class="s"><h2>Nach Kategorie ${y}</h2>${ks.length?`<div class="c">${ks.map(c=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><span>${c}</span><b>${E(by[c])}</b></div><div class="bar"><i style="width:${by[c]/tot*100}%"></i></div></div>`).join('')}</div>`:'<div class="em">Noch keine Kosten in diesem Jahr.</div>'}</div>
  <div class="s"><h2>Manuell erfasste Kosten</h2>${cs.length?`<div class="t c"><table><tr><th>Datum</th><th>Kategorie</th><th>Betrag</th><th>Notiz</th><th></th></tr>${cs.map(x=>`<tr><td>${D(x.date)}</td><td>${x.cat}</td><td>${E(x.amount)}</td><td>${esc(x.note)}</td><td><button class="x" data-rm="cost:${x.id}" aria-label="Löschen">×</button></td></tr>`).join('')}</table></div>`:'<div class="em">Noch nichts erfasst.</div>'}</div>`;
}
function wart(){
  const m=[...S.maint].sort((a,b)=>b.date.localeCompare(a.date));
  return `<h2>Wartung speichern</h2><div class="c"><form id="fm">
  <label>Art<select name="type">${opts(ty())}</select></label>
  <label>Datum<input type="date" name="date" value="${today}" required></label>
  <label>Kilometerstand<input type="number" name="km" min="0" value="${calc().km||''}"></label>
  <label>Kosten (€)<input type="number" name="cost" min="0" step="0.01"></label>
  <label>Werkstatt<input name="shop"></label>
  <label>Beschreibung<input name="desc"></label>
  <label>Nächste Wartung bei km<input type="number" name="nextKm" min="0"></label>
  <label>Nächste Wartung am<input type="date" name="nextDate"></label>
  <button class="b" type="submit">Wartung speichern</button></form></div>
  <div class="s"><h2>Wartungsverlauf</h2>${m.length?`<div class="t c"><table><tr><th>Datum</th><th>Art</th><th>km</th><th>Kosten</th><th>Werkstatt</th><th>Nächste</th><th></th></tr>${m.map(x=>`<tr><td>${D(x.date)}</td><td>${esc(x.type)}${x.desc?`<br><small style="color:var(--mu)">${esc(x.desc)}</small>`:''}</td><td>${x.km?N(x.km,0):'–'}</td><td>${x.cost?E(x.cost):'–'}</td><td>${esc(x.shop)||'–'}</td><td>${[x.nextKm?N(x.nextKm,0)+' km':'',x.nextDate?D(x.nextDate):''].filter(Boolean).join(' / ')||'–'}</td><td><button class="x" data-dm="${x.id}" aria-label="Löschen">×</button></td></tr>`).join('')}</table></div>`:'<div class="em">Noch keine Wartung eingetragen.</div>'}</div>`;
}
function termine(){
  const s=S.set,r=reminders();
  return `<h2>Termine &amp; Erinnerungen</h2>${r.length?`<div class="g">${r.map(x=>`<div class="c ${x.bad?'bd':''}"><div class="l">${x.bad?'🔴 ':''}${esc(x.title)}${x.id?` <button class="x" data-rm="appt:${x.id}" aria-label="Erledigt">×</button>`:''}</div>
  <div class="n">${x.d!==null?(x.d<0?`${-x.d} <small>Tage überfällig</small>`:`Noch ${x.d} <small>Tage</small>`):(x.rk<=0?'Fällig':`Noch ${N(x.rk,0)} <small>km</small>`)}</div>
  <div class="l">${[x.date?D(x.date):'',x.km?'bei '+N(x.km,0)+' km':''].filter(Boolean).join(' · ')}</div></div>`).join('')}</div>`:'<div class="em">Noch keine Termine. Trage unten TÜV oder einen Werkstatttermin ein.</div>'}
  <div class="s"><h2>Termin anlegen</h2><div class="c"><form id="fa">
  <label>Art<input name="title" list="tt" placeholder="z. B. Reifenwechsel" required></label>
  <datalist id="tt"><option>Reifenwechsel</option><option>Versicherung</option><option>Steuer</option><option>Werkstatttermin</option></datalist>
  <label>Datum<input type="date" name="date" required></label>
  <button class="b" type="submit">Termin speichern</button></form></div></div>
  <div class="s"><h2>TÜV &amp; Inspektion</h2><div class="c"><form id="fs">
  <label>Nächster TÜV<input type="date" name="tuv" value="${s.tuv||''}"></label>
  <label>Nächste Inspektion am<input type="date" name="insp" value="${s.insp||''}"></label>
  <label>Inspektion bei km<input type="number" name="inspKm" min="0" value="${s.inspKm||''}"></label>
  <button class="b" type="submit">Speichern</button></form></div></div>`;
}
let unlocked=false;
async function hash(t){t='am:'+t;try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){let h=5381;for(const c of t)h=(h*33^c.charCodeAt(0))>>>0;return 'f'+h}}
const PRE={Standard:{ac:'#000000',ac2:'#555555',bg:'#f2f2f2',sf:'#ffffff',tx:'#000000'},
 Nacht:{ac:'#ffffff',ac2:'#bbbbbb',bg:'#000000',sf:'#141414',tx:'#ffffff',bad:'#ff6b5e',ok:'#5ed08f'},
 Blau:{ac:'#1d4ed8',ac2:'#f59e0b',bg:'#eef2fb',sf:'#ffffff',tx:'#0f1a3a'},
 Petrol:{ac:'#12515e',ac2:'#e39b12',bg:'#e9eef0',sf:'#ffffff',tx:'#14262b'},
 Türkis:{ac:'#0e7c7b',ac2:'#e9a30f',bg:'#e8f3f3',sf:'#ffffff',tx:'#0d2626'},
 Mint:{ac:'#2dc4a0',ac2:'#e0562f',bg:'#effaf6',sf:'#ffffff',tx:'#0e2a22'},
 Wald:{ac:'#2f6b3a',ac2:'#d98e04',bg:'#ecf1eb',sf:'#ffffff',tx:'#16231a'},
 Gold:{ac:'#f5c400',ac2:'#222222',bg:'#fffbe6',sf:'#ffffff',tx:'#241f00'},
 Orange:{ac:'#ea580c',ac2:'#1d4ed8',bg:'#fdf1e8',sf:'#ffffff',tx:'#2a1608'},
 Rot:{ac:'#b3261e',ac2:'#f2a900',bg:'#f6eeee',sf:'#ffffff',tx:'#2a1414'},
 Bordeaux:{ac:'#7a1f3d',ac2:'#d4a017',bg:'#f6ecef',sf:'#ffffff',tx:'#2a0f18'},
 Pink:{ac:'#d6336c',ac2:'#7c3aed',bg:'#fdeef4',sf:'#ffffff',tx:'#2d1020'},
 Violett:{ac:'#5b3fa0',ac2:'#e0a100',bg:'#efecf6',sf:'#ffffff',tx:'#1d1630'},
 Ozean:{ac:'#4fb3c4',ac2:'#f0b13a',bg:'#0f1c20',sf:'#172a30',tx:'#e6eef0',bad:'#ee7466',ok:'#58c58b'}};
Object.values(PRE).forEach(p=>{p.bad=p.bad||'#c0392b';p.ok=p.ok||'#2b8a57'});
function lum(h){const n=parseInt(h.slice(1),16),f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(n>>16)+.7152*f((n>>8)&255)+.0722*f(n&255)}
function applyTheme(){
  const r=document.documentElement,t=S.theme;
  r.classList.toggle('cu',!!t);
  if(!t){['ac','ac2','bg','sf','tx','mu','ln','on','bad','ok'].forEach(k=>r.style.removeProperty('--'+k));r.style.colorScheme='';return}
  ['ac','ac2','bg','sf','tx'].forEach(k=>r.style.setProperty('--'+k,t[k]));
  r.style.setProperty('--bad',t.bad||PRE.Standard.bad);r.style.setProperty('--ok',t.ok||PRE.Standard.ok);
  r.style.setProperty('--mu','color-mix(in srgb,'+t.tx+' 60%,'+t.sf+')');
  r.style.setProperty('--ln','color-mix(in srgb,'+t.tx+' 18%,'+t.sf+')');
  r.style.setProperty('--on',lum(t.ac)>.4?'#111111':'#ffffff');
  r.style.colorScheme=lum(t.bg)<.3?'dark':'light';
}
function lockScreen(){
  document.getElementById('v').innerHTML=`<div class="c" style="max-width:340px;margin:8vh auto"><h2>Gesperrt</h2><form id="fl"><label>Sicherheitscode<input type="password" name="c" autocomplete="off" required></label><button class="b" type="submit">Entsperren</button></form><p id="le" style="color:var(--bad);margin:10px 0 0"></p></div>`;
  const f=document.getElementById('fl');f.c.focus();
  f.onsubmit=async e=>{e.preventDefault();
    if(await hash(f.c.value)===S.sec){unlocked=true;render()}
    else{document.getElementById('le').textContent='Der Code ist falsch. Bitte erneut eingeben.';f.c.value=''}};
}
function einst(){
  const t=S.theme||PRE.Standard;
  const F=[['ac','Akzentfarbe'],['ac2','Hervorhebung'],['bg','Hintergrund'],['sf','Karten'],['tx','Textfarbe'],['bad','Warnfarbe'],['ok','Erfolgsfarbe']];
  return `<h2>Fahrzeug</h2><div class="c"><form id="fv">
  <label>Name / Modell<input name="vname" value="${esc(S.set.name)}" placeholder="z. B. VW Golf"></label>
  <label>Kennzeichen<input name="plate" value="${esc(S.set.plate)}"></label>
  <label>Kilometerstand aktuell<input type="number" name="km" min="0" step="1" value="${S.set.km||k0()||''}"></label>
  <label>Tankgröße (L)<input type="number" name="tank" min="1" step="1" value="${S.set.tank}"></label>
  <button class="b" type="submit">Fahrzeugdaten speichern</button></form>
  <p style="color:var(--mu);font-size:13px;margin-bottom:0">Das Dashboard zeigt den höchsten Kilometerstand aus dieser Eingabe, den Tankvorgängen und den Wartungen.</p></div>
  <h2 style="margin-top:18px">Wartungsarten</h2><div class="c"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${ty().map((t,i)=>`<span class="c" style="padding:4px 4px 4px 12px;display:inline-flex;align-items:center;gap:4px">${esc(t)}<button class="x" data-rt="${i}" aria-label="${esc(t)} entfernen">×</button></span>`).join('')}</div>
  <form id="fty"><label>Neue Art<input name="nt" placeholder="z. B. Scheibenwischer" required></label>
  <button class="b" type="submit">Art hinzufügen</button><button class="b" type="button" id="trs" style="background:var(--mu)">Standard wiederherstellen</button></form>
  <p style="color:var(--mu);font-size:13px;margin-bottom:0">Gespeicherte Wartungen bleiben erhalten, auch wenn du ihre Art entfernst.</p></div>
  <h2 style="margin-top:18px">Farben</h2><div class="c"><p style="margin-top:0;color:var(--mu)">Wähle ein Farbschema oder stelle jede Farbe selbst ein.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${Object.keys(PRE).map(n=>`<button class="b" data-pre="${n}" style="background:${PRE[n].ac};color:${lum(PRE[n].ac)>.4?'#111':'#fff'}">${n}</button>`).join('')}</div>
  <form id="fth">${F.map(([k,l])=>`<label>${l}<input type="color" name="${k}" value="${t[k]||PRE.Standard[k]}" style="height:44px;padding:2px"></label>`).join('')}</form></div>
  <div class="s"><h2>Sicherheitscode</h2><div class="c"><p style="margin-top:0;color:var(--mu)">${S.sec?'Ein Code ist aktiv. Die App fragt ihn bei jedem Öffnen ab.':'Mit einem Code ist die App beim Öffnen gesperrt.'}</p>
  <form id="fcode"><label>${S.sec?'Neuer Code':'Code festlegen'} (mind. 4 Zeichen)<input type="password" name="c" minlength="4" required autocomplete="new-password"></label>
  <label>Code wiederholen<input type="password" name="c2" required autocomplete="new-password"></label>
  <button class="b" type="submit">Code speichern</button>${S.sec?'<button class="b" type="button" id="cdel" style="background:var(--bad)">Code entfernen</button>':''}</form>
  <p id="cm" style="color:var(--bad);margin:10px 0 0"></p>
  <p style="color:var(--mu);font-size:13px;margin-bottom:0">Die Sperre hält neugierige Blicke fern. Die Daten selbst liegen unverschlüsselt im Browser dieses Geräts.</p></div></div>`;
}
const k0=()=>calc().km;
const ty=()=>S.types&&S.types.length?S.types:TYPES;
async function scan(sm,file,ff,st){
  if(!file)return;
  st.style.color='var(--mu)';st.textContent='Kassenzettel wird ausgelesen …';
  try{
    const r=await sm.json(`Das Bild ist ein Tankbeleg (Kassenzettel einer Tankstelle). Lies die Daten ab und antworte nur mit JSON in genau dieser Form: {"date":"YYYY-MM-DD" oder null,"liters":Zahl oder null,"pricePerLiter":Zahl oder null,"total":Zahl oder null,"station":"Name der Tankstelle" oder null,"fuelType":"Super E10" | "Super E5" | "Super Plus" | "Diesel" | "LPG" | "Strom" oder null}. Dezimalzahlen mit Punkt. pricePerLiter ist der Preis pro Liter in Euro (z. B. 1.859), total der Gesamtbetrag in Euro. Ist ein Wert nicht sicher lesbar, setze null. Rate nichts.`,{images:[file],modelTier:'default'});
    const num=v=>typeof v==='number'&&isFinite(v)&&v>0?v:null,got=[];
    if(/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')){ff.date.value=r.date;got.push('Datum')}
    const L=num(r.liters),P=num(r.pricePerLiter),T=num(r.total);
    if(L){ff.l.value=L;got.push('Liter')}
    if(P){ff.price.value=P;got.push('Literpreis')}
    if(T){ff.cost.value=T;got.push('Gesamtbetrag')}
    if(L&&T&&!P)ff.price.value=(T/L).toFixed(3);
    if(r.station){ff.station.value=r.station;got.push('Tankstelle')}
    if(r.fuelType&&[...ff.fuelType.options].some(o=>o.value===r.fuelType)){ff.fuelType.value=r.fuelType;got.push('Kraftstoff')}
    st.textContent=got.length?`Erkannt: ${got.join(', ')}. Bitte die Werte prüfen und den Kilometerstand ergänzen.`:'Es wurden keine Werte erkannt. Bitte ein schärferes Foto versuchen oder manuell eintragen.';
  }catch(e){
    st.style.color='var(--bad)';
    st.textContent=e&&e.code==='not_granted'?'Das Auslesen wurde nicht erlaubt. Du kannst die Werte manuell eintragen.':e&&e.code==='rate_limited'?'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.':'Das Auslesen hat nicht geklappt. Bitte trage die Werte manuell ein.';
  }
}
async function bindR(ff){
  const rc=document.getElementById('rc');
  if(!rc||!ff||!window.claude||!window.claude.use)return;
  try{
    const sm=await window.claude.use('sample');
    if(!sm)return;
    const l=await sm.limits().catch(()=>null);
    if(!l||!l.images)return;
    if(!document.getElementById('rc'))return;
    document.getElementById('rbox').style.display='';
    rc.onchange=()=>scan(sm,rc.files[0],ff,document.getElementById('rs'));
  }catch(e){}
}
function bindE(){
  bindR(document.getElementById('ff'));
  const ft=document.getElementById('fty');
  if(ft)ft.onsubmit=e=>{e.preventDefault();const v=ft.nt.value.trim();if(!v)return;const l=[...ty()];if(!l.some(x=>x.toLowerCase()===v.toLowerCase()))l.push(v);S.types=l;save();render()};
  document.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{S.types=ty().filter((_,i)=>i!=b.dataset.rt);save();render()});
  const trs=document.getElementById('trs');if(trs)trs.onclick=()=>{S.types=null;save();render()};
  const fv=document.getElementById('fv');
  if(fv)fv.onsubmit=e=>{e.preventDefault();S.set={...S.set,name:fv.vname.value,plate:fv.plate.value,km:+fv.km.value||0,tank:+fv.tank.value||50};save();render()};
  document.querySelectorAll('[data-pre]').forEach(b=>b.onclick=()=>{S.theme=b.dataset.pre==='Standard'?null:{...PRE[b.dataset.pre]};save();applyTheme();render()});
  const th=document.getElementById('fth');
  if(th)th.oninput=()=>{S.theme=Object.fromEntries(new FormData(th));save();applyTheme()};
  const f=document.getElementById('fcode');
  if(f){
    f.onsubmit=async e=>{e.preventDefault();
      if(f.c.value!==f.c2.value){document.getElementById('cm').textContent='Die beiden Codes stimmen nicht überein.';return}
      S.sec=await hash(f.c.value);unlocked=true;save();render()};
    const d=document.getElementById('cdel');if(d)d.onclick=()=>{S.sec='';save();render()};
  }
}
let cal={y:+today.slice(0,4),m:+today.slice(5,7)-1,mode:'m',sel:today};
const MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function evs(d){
  const e=[];
  S.fuel.filter(x=>x.date===d).forEach(x=>e.push({k:'f',t:`⛽ Tanken, ${N(x.l)} L${x.station?' ('+esc(x.station)+')':''}`,a:x.cost}));
  S.cost.filter(x=>x.date===d).forEach(x=>e.push({k:'c',t:`💶 ${x.cat}${x.note?': '+esc(x.note):''}`,a:x.amount}));
  S.maint.filter(x=>x.date===d).forEach(x=>e.push({k:'m',t:`🔧 ${esc(x.type)}${x.shop?' ('+esc(x.shop)+')':''}`,a:x.cost}));
  S.appt.filter(x=>x.date===d).forEach(x=>e.push({k:'a',t:`📅 ${esc(x.title)}`}));
  if(S.set.tuv===d)e.push({k:'a',t:'📅 TÜV'});
  if(S.set.insp===d)e.push({k:'a',t:'📅 Inspektion'});
  S.maint.filter(x=>x.nextDate===d).forEach(x=>e.push({k:'a',t:`📅 ${esc(x.type)} fällig`}));
  return e;
}
function pstats(pre){
  const f=calc().f,inP=x=>x.date.startsWith(pre),fl=f.filter(inP),cs=allCosts().filter(inP);
  const by={};cs.forEach(x=>by[x.cat]=(by[x.cat]||0)+x.amount);
  const before=f.filter(x=>x.date<pre);
  const start=before.length?before[before.length-1].km:(fl[0]?fl[0].km:0);
  const cv=fl.filter(x=>x.cons!==null&&x.cons!==undefined);
  return {cost:cs.reduce((a,x)=>a+x.amount,0),by,l:fl.reduce((a,x)=>a+x.l,0),
    km:fl.length?fl[fl.length-1].km-start:0,cons:cv.length?cv.reduce((a,x)=>a+x.cons,0)/cv.length:null,
    nm:S.maint.filter(inP).length,n:fl.length};
}
function sumView(ps){
  const ks=Object.keys(ps.by).sort((a,b)=>ps.by[b]-ps.by[a]);
  return `<div class="g">${card('Kosten',E(ps.cost),'','hero')}${card('Getankt',N(ps.l),'L')}${card('Gefahren',N(ps.km,0),'km')}${card('Ø Verbrauch',N(ps.cons),'L/100 km')}${card('Tankvorgänge',ps.n)}${card('Wartungen',ps.nm)}</div>
  ${ks.length?`<div class="c" style="margin-top:12px">${ks.map(c=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><span>${c}</span><b>${E(ps.by[c])}</b></div><div class="bar"><i style="width:${ps.by[c]/ps.cost*100}%"></i></div></div>`).join('')}</div>`:'<div class="em">Keine Einträge in diesem Zeitraum.</div>'}`;
}
function kal(){
  const ty=+today.slice(0,4);
  const ys=[...S.fuel,...S.cost,...S.maint,...S.appt].map(x=>+x.date.slice(0,4)).concat([cal.y,ty-3,ty+2]);
  const yo=[];for(let i=Math.max(...ys);i>=Math.min(...ys);i--)yo.push(i);
  const head=`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
  <button class="b" data-cn="-1" aria-label="Zurück">‹</button><button class="b" data-cn="1" aria-label="Weiter">›</button>
  ${cal.mode==='m'?`<select id="calM" style="width:auto" aria-label="Monat">${MON.map((n,i)=>`<option value="${i}"${i===cal.m?' selected':''}>${n}</option>`).join('')}</select>`:''}
  <select id="calY" style="width:auto" aria-label="Jahr">${yo.map(y=>`<option${y===cal.y?' selected':''}>${y}</option>`).join('')}</select>
  <button class="b" data-ctoday="1">Heute</button>
  <button class="b" data-cmode="${cal.mode==='m'?'y':'m'}" style="margin-left:auto">${cal.mode==='m'?'Jahresübersicht':'Monatsansicht'}</button></div>`;
  if(cal.mode==='y'){
    const rows=MON.map((n,i)=>{const q=pstats(cal.y+'-'+String(i+1).padStart(2,'0'));
      return `<tr data-gm="${i}"><td>${n}</td><td>${q.cost?E(q.cost):'–'}</td><td>${q.l?N(q.l):'–'}</td><td>${q.km?N(q.km,0):'–'}</td><td>${q.nm||'–'}</td></tr>`}).join('');
    return `<h2>Kalender</h2>${head}<h2>Jahr ${cal.y}</h2>${sumView(pstats(String(cal.y)))}
    <div class="s"><h2>Monate</h2><div class="t c"><table><tr><th>Monat</th><th>Kosten</th><th>Liter</th><th>km</th><th>Wartungen</th></tr>${rows}</table></div></div>`;
  }
  const pre=cal.y+'-'+String(cal.m+1).padStart(2,'0');
  const off=(new Date(cal.y,cal.m,1).getDay()+6)%7,dim=new Date(cal.y,cal.m+1,0).getDate();
  let cells='<b>Mo</b><b>Di</b><b>Mi</b><b>Do</b><b>Fr</b><b>Sa</b><b>So</b>'+'<div></div>'.repeat(off);
  for(let d=1;d<=dim;d++){
    const ds=pre+'-'+String(d).padStart(2,'0'),e=evs(ds);
    cells+=`<button class="cd${ds===today?' td':''}${ds===cal.sel?' sl':''}" data-day="${ds}" aria-label="${D(ds)}"><span>${d}</span><span class="dr">${['f','c','m','a'].filter(k=>e.some(x=>x.k===k)).map(k=>`<i class="dt d${k}"></i>`).join('')}</span></button>`;
  }
  const se=cal.sel.startsWith(pre)?evs(cal.sel):null;
  return `<h2>Kalender</h2>${head}<div class="cg">${cells}</div>
  <div class="lg"><span><i class="dt"></i> Tanken</span><span><i class="dt dc"></i> Kosten</span><span><i class="dt dm"></i> Wartung</span><span><i class="dt da"></i> Termin</span></div>
  ${se?`<div class="s"><h2>${D(cal.sel)}</h2>${se.length?se.map(x=>`<div class="al">${x.t}${x.a?` <b style="margin-left:auto">${E(x.a)}</b>`:''}</div>`).join(''):'<div class="em">Keine Einträge an diesem Tag.</div>'}</div>`:''}
  <div class="s"><h2>${MON[cal.m]} ${cal.y}</h2>${sumView(pstats(pre))}</div>`;
}
function bindK(){
  const q=x=>document.querySelectorAll(x);
  q('[data-cn]').forEach(b=>b.onclick=()=>{const n=+b.dataset.cn;if(cal.mode==='y')cal.y+=n;else{cal.m+=n;if(cal.m<0){cal.m=11;cal.y--}if(cal.m>11){cal.m=0;cal.y++}}render()});
  const m=document.getElementById('calM'),y=document.getElementById('calY');
  if(m)m.onchange=()=>{cal.m=+m.value;render()};
  if(y)y.onchange=()=>{cal.y=+y.value;render()};
  q('[data-cmode]').forEach(b=>b.onclick=()=>{cal.mode=b.dataset.cmode;render()});
  q('[data-ctoday]').forEach(b=>b.onclick=()=>{cal.y=+today.slice(0,4);cal.m=+today.slice(5,7)-1;cal.sel=today;cal.mode='m';render()});
  q('[data-day]').forEach(b=>b.onclick=()=>{cal.sel=b.dataset.day;render()});
  q('[data-gm]').forEach(r=>r.onclick=()=>{cal.m=+r.dataset.gm;cal.mode='m';render()});
}
function render(){
  document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===tab));
  const lk=S.sec&&!unlocked;
  document.getElementById('pg').textContent=lk?'':document.querySelector('nav button[aria-selected=true]').textContent+(S.set.name?' · '+S.set.name+(S.set.plate?' ('+S.set.plate+')':''):'');
  document.getElementById('mb').hidden=lk;
  document.querySelector('nav').style.display=lk?'none':'';
  document.getElementById('lock').hidden=!S.sec||lk;
  if(lk){document.documentElement.classList.remove('nos');lockScreen();return}
  document.getElementById('v').innerHTML=({d:dash,f:tank,k:kosten,w:wart,t:termine,e:einst,c:kal})[tab]();
  document.documentElement.classList.toggle('nos',tab==='d'&&!hasMore);
  bind();
}
function bind(){bindE();bindK();
  const ff=document.getElementById('ff');
  if(ff){
    const l=ff.l,p=ff.price,c=ff.cost;
    const upd=src=>{const L=+l.value;if(!L)return;
      if(src==='c'&&+c.value)p.value=(c.value/L).toFixed(3);
      else if(+p.value)c.value=(L*p.value).toFixed(2)};
    l.oninput=()=>upd('p');p.oninput=()=>upd('p');c.oninput=()=>upd('c');
    ff.onsubmit=e=>{e.preventDefault();
      const L=+l.value;let pr=+p.value,co=+c.value;
      if(!co&&pr)co=L*pr;if(!pr&&co)pr=co/L;
      S.fuel.push({id:Date.now(),date:ff.date.value,km:+ff.km.value,l:L,price:pr,cost:co,station:ff.station.value,fuelType:ff.fuelType.value,full:ff.full.checked,consIn:+ff.cons.value||0});
      save();render()};
  }
  const fs=document.getElementById('fs');
  if(fs)fs.onsubmit=e=>{e.preventDefault();
    S.set={...S.set,tuv:fs.tuv.value,insp:fs.insp.value,inspKm:+fs.inspKm.value||''};save();render()};
  const fm=document.getElementById('fm');
  if(fm)fm.onsubmit=e=>{e.preventDefault();
    S.maint.push({id:Date.now(),type:fm.type.value,date:fm.date.value,km:+fm.km.value||0,cost:+fm.cost.value||0,shop:fm.shop.value,desc:fm.desc.value,nextKm:+fm.nextKm.value||0,nextDate:fm.nextDate.value});save();render()};
  const fc=document.getElementById('fc');
  if(fc)fc.onsubmit=e=>{e.preventDefault();
    S.cost.push({id:Date.now(),date:fc.date.value,cat:fc.cat.value,amount:+fc.amount.value,note:fc.note.value});save();render()};
  const fa=document.getElementById('fa');
  if(fa)fa.onsubmit=e=>{e.preventDefault();
    S.appt.push({id:Date.now(),title:fa.title.value,date:fa.date.value});save();render()};
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const[k,id]=b.dataset.rm.split(':');S[k]=S[k].filter(x=>x.id!=id);save();render()});
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{S.fuel=S.fuel.filter(x=>x.id!=b.dataset.del);save();render()});
  document.querySelectorAll('[data-dm]').forEach(b=>b.onclick=()=>{S.maint=S.maint.filter(x=>x.id!=b.dataset.dm);save();render()});
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;menu(false);render();scrollTo(0,0)});
document.getElementById('lock').onclick=()=>{unlocked=false;render()};
const menu=o=>{document.querySelector('nav').classList.toggle('open',o);document.getElementById('ov').classList.toggle('open',o);document.getElementById('mb').setAttribute('aria-expanded',String(o))};
document.getElementById('mb').onclick=()=>menu(!document.querySelector('nav').classList.contains('open'));
document.getElementById('ov').onclick=()=>menu(false);
document.onkeydown=e=>{if(e.key==='Escape')menu(false)};
applyTheme();
render();
