const CATEGORIES = ['Hypercar','LMP2 ELMS','LMP2 WEC','LMP3','GT3','GTE'];
const EVENT_TYPES = {special:{label:'Special event',css:'special'},lmu:{label:'Championnat LMU',css:'lmu'},private:{label:'Championnat privé',css:'private'}};
const CIRCUITS = [
  {id:'bahrain',name:'Bahrain International Circuit',file:'bahrain.png'},
  {id:'barcelona',name:'Circuit de Barcelona-Catalunya',file:'barcelone.png'},
  {id:'cota',name:'Circuit of the Americas',file:'cota.png'},
  {id:'daytona',name:'Daytona International Speedway',file:'daytona.png'},
  {id:'fuji',name:'Fuji Speedway',file:'fuji.png'},
  {id:'imola',name:'Autodromo Enzo e Dino Ferrari (Imola)',file:'imola.png'},
  {id:'interlagos',name:'Interlagos',file:'interlagos.png'},
  {id:'laguna-seca',name:'WeatherTech Raceway Laguna Seca',file:'laguna_seca.png'},
  {id:'le-mans',name:'Circuit de la Sarthe (Le Mans)',file:'le_mans.png'},
  {id:'lusail',name:'Lusail International Circuit',file:'lusail_international.png'},
  {id:'monza',name:'Autodromo Nazionale Monza',file:'monza.png'},
  {id:'paul-ricard',name:'Circuit Paul Ricard',file:'paul_ricard_elms.png'},
  {id:'portimao',name:'Algarve International Circuit (Portimão)',file:'algarve.png'},
  {id:'sebring',name:'Sebring International Raceway',file:'sebring.png'},
  {id:'silverstone',name:'Silverstone Circuit',file:'silverstone.png'},
  {id:'spa',name:'Circuit de Spa-Francorchamps',file:'spa_francorchamps.png'}
];
const categories = {
  Hypercar:{image:'HC.png',css:'hyper'},
  'LMP2 ELMS':{image:'LMP2.png',css:'lmp2'},
  'LMP2 WEC':{image:'LMP2.png',css:'lmp2'},
  LMP3:{image:'P3.png',css:'lmp3'},
  GT3:{image:'GT3.png',css:'gt3'},
  GTE:{css:'gte'}
};
const CARS = {
  Hypercar: ['Alpine A424','Aston Martin Valkyrie AMR LMH','BMW M Hybrid V8','Cadillac V-Series.R','Ferrari 499P','Genesis GMR-001 LMDh','Glickenhaus SCG 007','Isotta Fraschini Tipo 6-C','Lamborghini SC63','Peugeot 9X8','Porsche 963','Toyota GR010 Hybrid','Vanwall Vandervell 680'],
  'LMP2 ELMS': ['Oreca 07 Gibson ELMS'],
  'LMP2 WEC': ['Oreca 07 Gibson'],
  LMP3: ['Ligier JS P325','Ginetta G61-LT-P3','Duqueine D09','Adess AD25'],
  GT3: ['Aston Martin Vantage AMR LMGT3','BMW M4 LMGT3','Chevrolet Corvette Z06 LMGT3.R','Ferrari 296 LMGT3','Ford Mustang LMGT3','Lamborghini Huracán LMGT3','Lexus RC F LMGT3','Mercedes-AMG LMGT3','McLaren 720S LMGT3','Porsche 911 GT3 R LMGT3'],
  GTE: ['Aston Martin Vantage GTE','Chevrolet Corvette C8.R','Ferrari 488 GTE','Porsche 911 RSR-19']
};
const app = document.getElementById('app');
const nav = document.getElementById('navigation');
let events=[], user=null, discordReady=false, currentEventId=null, page='home', editingEvent=null;
let drafts={}, recoveryLink='', busy=false, members=[], flash='', eventFilter='upcoming';
let selectedDepartureId=null, eventSection='race', crewDraft=null;
let pilotName='';
try { pilotName = localStorage.getItem('fmt_pilot_name') || ''; } catch {}
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canManage = () => ['admin','organizer'].includes(user?.role);
const isAdmin = () => user?.role === 'admin';
const roleLabel = role => ({admin:'Administrateur',organizer:'Organisateur',pilot:'Pilote'}[role] || 'Pilote');
function logo(category) {
  const config=categories[category];
  return config?.image ? `<img class="category-logo" src="/images/${config.image}" alt="">` : `<span class="category-text-logo" aria-hidden="true">${esc(category)}</span>`;
}
function badge(category) { return `<span class="event-category-badge ${categories[category]?.css || ''}">${logo(category)}<span>${esc(category)}</span></span>`; }
function eventTypeBadge(type) { const item=EVENT_TYPES[type]||EVENT_TYPES.private; return `<span class="event-type-badge ${item.css}">${item.label}</span>`; }
function circuitInfo(id) { return CIRCUITS.find(c=>c.id===id) || null; }
function circuitLabel(id) { return circuitInfo(id)?.name || 'Circuit à préciser'; }
function circuitVisual(id, compact=false) { const circuit=circuitInfo(id); if(!circuit)return ''; return `<span class="circuit-visual ${compact?'compact':''}"><img data-circuit="${circuit.id}" src="/images/circuits/${circuit.file}" alt="Plan du ${esc(circuit.name)}" loading="lazy"></span>`; }
function button(action,label,extra='',css='secondary-button') { return `<button type="button" class="${css}" data-action="${action}" ${extra}>${label}</button>`; }
function carPreferenceChoices(category, selected=[], any=false) {
  const values = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  return `<div class="car-preference-panel"><label class="car-any-option"><input type="checkbox" name="carAny" ${any?'checked':''}> <strong>Peu importe la voiture</strong><span>Je peux rouler avec n’importe quel modèle de cette catégorie.</span></label><div class="car-preference-grid">${(CARS[category]||[]).map(car=>`<label class="car-preference-option"><input type="checkbox" name="carPreference" value="${esc(car)}" ${values.includes(car)&&!any?'checked':''} ${any?'disabled':''}><span>${esc(car)}</span></label>`).join('')}</div></div>`;
}
function registrationCarLabel(reg) { return reg.carAny ? 'N’importe quelle voiture' : ((reg.cars?.length ? reg.cars.join(' · ') : reg.car) || 'Pas de préférence'); }
function crewColorClass(crewId, index=null) { if(index!=null) return `crew-palette-${index%10}`; let hash=0; for(const char of String(crewId||'')) hash=(hash*31+char.charCodeAt(0))>>>0; return `crew-palette-${hash%10}`; }
function errorBox() { return '<p id="error" class="creation-error" role="alert" tabindex="-1" hidden></p>'; }
function showError(error) {
  let box=document.getElementById('error');
  if (!box) { app.insertAdjacentHTML('afterbegin',errorBox()); box=document.getElementById('error'); }
  box.textContent=error.message || String(error); box.hidden=false; box.focus();
}
async function api(path,method='GET',data) {
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data || {})});
  let result;
  try { result=await response.json(); } catch { throw Error('Le service partagé ne répond pas. Vérifie que la nouvelle configuration du site est terminée.'); }
  if (!response.ok) throw Error(result.error || 'Cette action a échoué.');
  return result;
}
async function load() {
  const [session,result]=await Promise.all([api('/api/session'),api('/api/events')]);
  user=session.user;discordReady=session.discordReady;events=result.events;
  if (user && !pilotName) pilotName=user.name.slice(0,30);
  renderNav();
}
function renderNav() {
  nav.innerHTML=`${button('home','Événements')}
    ${canManage()?button('create','+ Événement','','primary-button'):''}
    ${isAdmin()?button('members','Gestion des membres'):''}
    ${user?`<span class="account-name">${esc(user.name)} <small>${roleLabel(user.role)}</small></span>${button('logout','Déconnexion')}`:
      discordReady?'<a class="discord-button" href="/api/auth/discord">Se connecter avec Discord</a>':'<span class="account-name">Connexion Discord à configurer</span>'}`;
}
function countdown(timestamp) {
  const seconds=Math.max(0,Math.floor((timestamp-Date.now())/1000));
  if (!seconds) return 'Départ passé';
  const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
  return days?`${days}j ${hours}h ${minutes}m`:`${hours}h ${minutes}m ${seconds%60}s`;
}
function dateLabel(departure) { return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'full'}).format(new Date(departure.startsAt)); }
function renderHome(message='') {
  page='home';currentEventId=null;editingEvent=null;drafts={};
  const filteredEvents=events.filter(event=>{const upcoming=event.departures.some(d=>d.startsAt>Date.now());return eventFilter==='all'||(eventFilter==='upcoming'?upcoming:!upcoming);});
  app.innerHTML=`<h1 class="page-title">ÉVÉNEMENTS</h1>
    <p class="page-subtitle">Gestion des courses d’endurance · Horaires de Paris</p>
    ${message?`<p class="creation-success" role="status">${esc(message)}</p>`:''}${errorBox()}
    <div class="toolbar">${button('refresh','Actualiser')}${button('my-entries','Mes inscriptions')}${!user?button('guest-link','Mon lien personnel'):''}</div>
    <div class="event-filter" role="group" aria-label="Filtrer les événements">${button('event-filter','À venir',`data-filter="upcoming" aria-pressed="${eventFilter==='upcoming'}"`,'event-filter-button')}${button('event-filter','Archivés',`data-filter="archived" aria-pressed="${eventFilter==='archived'}"`,'event-filter-button')}${button('event-filter','Tous',`data-filter="all" aria-pressed="${eventFilter==='all'}"`,'event-filter-button')}</div>
    ${filteredEvents.length?`<div class="event-list">${filteredEvents.map(event=>{
      const next=event.departures.find(d=>d.startsAt>Date.now());
      const archived=!next;
      return `<button class="event-card event-type-${event.eventType||'private'} ${archived?'archived':''}" data-action="open" data-id="${event.id}">
        <span class="event-card-main"><span class="event-name">${esc(event.name)}</span><span class="event-info">${eventTypeBadge(event.eventType)} · ${event.durationHours||6} h · ${event.departures.length} départ${event.departures.length>1?'s':''} · ${event.departures.reduce((sum,d)=>sum+d.availability.filter(r=>r.status!=='unavailable').length,0)} inscription(s)</span></span>
        ${circuitVisual(event.circuit,true)}
        <span class="event-category-badges">${event.categories.map(badge).join('')}</span>
        <span class="event-countdown ${next?'':'finished'}">${next?`Prochain départ : ${esc(dateLabel(next))} à ${next.time} · <span data-countdown="${next.startsAt}">${countdown(next.startsAt)}</span>`:'Événement archivé · tous les départs sont passés'}</span>
      </button>`;
    }).join('')}</div>`:`<div class="empty">${eventFilter==='upcoming'?'Aucun événement à venir.':eventFilter==='archived'?'Aucun événement archivé.':'Aucun événement pour le moment. Un organisateur pourra créer la première course.'}</div>`}`;
  showRecoveryLink();
}
function showRecoveryLink() {
  if (!recoveryLink) return;
  app.insertAdjacentHTML('afterbegin',`<section class="recovery-panel"><label for="personalLink">Ton lien personnel pour retrouver et modifier tes inscriptions sans compte</label><input id="personalLink" readonly value="${esc(recoveryLink)}"><p>Conserve ce lien et garde-le privé.</p>${button('copy-link','Copier le lien')}${button('hide-link','Masquer')}</section>`);
}
function ownRegistration(departure) { return departure.availability.find(r=>r.mine); }
function draftFor(departure) {
  if (!drafts[departure.id]) {
    const mine=ownRegistration(departure);
    drafts[departure.id]={name:mine?.name || pilotName, category:mine?.category || '',cars:mine?.cars || (mine?.car?[mine.car]:[]),carAny:!!mine?.carAny,status:mine?.status || '',preferredPilot:mine?.preferredPilot || '',id:mine?.id || null,version:mine?.version || null};
  }
  return drafts[departure.id];
}
function statusLabel(status) {
  if(status==='whole')return 'Toute la course';if(status==='unavailable')return 'Indisponible';
  return status.split(',').map(x=>/^h\d+$/.test(x)?`Heure ${x.slice(1)}`:({beginning:'Début',middle:'Milieu',end:'Fin'}[x]||'')).filter(Boolean).join(' · ');
}
function registrationSlotLabel(status,departure,duration) {
  if(status==='whole')return 'Toute la course'; if(status==='unavailable')return 'Indisponible';
  return status.split(',').filter(x=>/^h\d+$/.test(x)).map(x=>`Heure ${x.slice(1)}`).join(' · ') || statusLabel(status);
}
function phaseColor(index,duration) {
  const ratio=duration>1?index/(duration-1):0;
  return `hsl(${Math.round(145-141*ratio)} 72% 48%)`;
}
function phaseClass(index,duration) { return `phase-${duration>1?Math.round(index*23/(duration-1)):0}`; }
function renderRegistration(reg,departure,duration) {
  const locked=departure.startsAt<=Date.now();
  const parts=new Set(reg.status.split(',').filter(x=>/^h\d+$/.test(x))),hours=Array.from({length:duration},(_,i)=>`h${i+1}`);
  const presentCount=reg.status==='whole'?duration:parts.size;
  const timeline=`<div class="availability-readonly" aria-label="${esc(registrationSlotLabel(reg.status,departure,duration))}"><span class="timeline-edge">DÉPART</span><div class="availability-mini-grid duration-${duration}">${hours.map((hour,i)=>`<span class="availability-mini-hour ${phaseClass(i,duration)} ${reg.status==='whole'||parts.has(hour)?'present':''}" title="Heure ${i+1}">${i+1}</span>`).join('')}</div><span class="timeline-edge">ARRIVÉE</span></div>`;
  return `<div class="pilot-row"><div class="pilot-main"><span class="pilot-name">${esc(reg.name)}${reg.mine?' <small>(toi)</small>':''}</span>
    <span class="pilot-category-logo">${reg.category?logo(reg.category):'—'}</span><span class="pilot-car">${esc(registrationCarLabel(reg))}</span><span class="registration-status">${reg.status==='unavailable'?'Indisponible':`${presentCount} h disponible${presentCount>1?'s':''}`}</span>${reg.preferredPilot?`<span class="pilot-preference">Souhaite rouler avec : <strong>${esc(reg.preferredPilot)}</strong></span>`:''}</div>${timeline}
    ${reg.canEdit&&!locked?button('edit-registration','Modifier',`data-id="${reg.id}" data-departure="${departure.id}"`,'edit-button'):''}</div>`;
}
function renderRegistrationForm(event,departure) {
  const state=draftFor(departure),duration=event.durationHours||6,parts=state.status==='whole'?Array.from({length:duration},(_,i)=>`h${i+1}`):state.status.split(',').filter(Boolean);
  return `<form class="form-section registration-form" data-kind="registration" data-departure="${departure.id}">
    <h3 class="form-title">${state.id?'Modifier l’inscription':canManage()?'Inscrire un pilote':'Mon inscription'} ${canManage()?button('new-registration','+ Ajouter un autre pilote',`data-departure="${departure.id}"`,'secondary-button add-pilot-button'):''}</h3>
    ${state.id&&!departure.availability.find(r=>r.id===state.id)?.mine?'<p class="creation-help">Modification en tant qu’administrateur.</p>':''}
    <label class="form-label" for="name-${departure.id}">Pseudo pilote</label>
    <input id="name-${departure.id}" name="pilotName" data-departure="${departure.id}" value="${esc(state.name)}" maxlength="30" required autocomplete="nickname">
    <label class="form-label" for="preference-${departure.id}">Pilote souhaité dans le même équipage <span class="muted">(facultatif)</span></label>
    <input id="preference-${departure.id}" name="preferredPilot" data-departure="${departure.id}" value="${esc(state.preferredPilot||'')}" maxlength="30" placeholder="Pseudo du pilote souhaité">
    <div class="registration-choices"><span class="form-label">Mes heures de présence (${duration} h)</span><p class="availability-hint">Clique sur les heures où tu peux rouler. Une case verte indique ta présence ; la couleur suit la progression de la course.</p><div class="availability-hour-grid compact-hours duration-${duration}">${Array.from({length:duration},(_,index)=>{const part=`h${index+1}`,active=parts.includes(part);return button('availability',`<span class="hour-card-number">${index+1}</span><span class="hour-card-state">${active?'✓':''}</span>`,`data-departure="${departure.id}" data-value="${part}" aria-pressed="${active}" aria-label="Heure ${index+1} : ${active?'présent':'disponible ?'}" title="Heure ${index+1} · ${active?'Présent':'Disponible ?'}"`,`hour-card ${phaseClass(index,duration)} ${active?'active':''}`);}).join('')}</div><div class="special-availability">
      ${button('availability','TOUTE LA COURSE',`data-departure="${departure.id}" data-value="whole" aria-pressed="${state.status==='whole'}"`,`special-button whole ${state.status==='whole'?'active':''}`)}
      ${button('availability','INDISPONIBLE',`data-departure="${departure.id}" data-value="unavailable" aria-pressed="${state.status==='unavailable'}"`,`special-button unavailable ${state.status==='unavailable'?'active':''}`)}
    </div></div>
    ${state.status==='unavailable'?'':`<div class="category-area"><span class="form-label">Catégorie</span><div class="categories">
      ${event.categories.map(category=>button('category',`${logo(category)}<span>${esc(category)}</span>`,`data-departure="${departure.id}" data-value="${esc(category)}" aria-pressed="${state.category===category}"`,`category-button ${categories[category]?.css||''} ${state.category===category?'active':''}`)).join('')}
    </div>${state.category?`<label class="form-label car-choice-label">Voiture(s) souhaitée(s)</label>${carPreferenceChoices(state.category,state.cars,state.carAny)}<p class="creation-help">Sélectionne un ou plusieurs modèles, ou coche « Peu importe ». Cette préférence aide les organisateurs à composer les équipages.</p>`:''}</div>`}
    <div class="save-row"><button type="submit" class="save-button">${state.id?'ENREGISTRER':'S’INSCRIRE'}</button>
      ${state.id?button('delete-registration','Se désinscrire',`data-id="${state.id}" data-departure="${departure.id}"`,'danger-button'):''}</div>
  </form>`;
}
function renderEvent(message='') {
  page='event';
  const event=events.find(e=>e.id===currentEventId);
  if(!event){renderHome('Cet événement n’est plus disponible.');return;}
  if(!canManage()) eventSection='race';
  const nextDeparture=event.departures.find(d=>d.startsAt>Date.now())||event.departures[0];
  const totalPilots=new Set(event.departures.flatMap(d=>d.availability.filter(r=>r.status!=='unavailable').map(r=>r.id))).size;
  const totalCrews=event.departures.reduce((sum,d)=>sum+(d.crews||[]).length,0);
  app.innerHTML=`${button('home','← Retour aux événements','','secondary-button back-button')}
    <div class="event-header event-type-${event.eventType||'private'}"><div class="event-heading-line"><div><h1 class="event-title">${esc(event.name)}</h1><p class="event-subtitle">${eventTypeBadge(event.eventType)} · Course de ${event.durationHours||6} h · Horaires de Paris · ${event.departures.length} départ(s)</p></div>${circuitVisual(event.circuit)}</div>
    <div class="event-category-badges">${event.categories.map(badge).join('')}</div></div>
    <div class="toolbar">${button('refresh','Actualiser')}${canManage()?button('edit-event','Modifier l’événement',`data-id="${event.id}"`):''}${isAdmin()?button('delete-event','Supprimer l’événement',`data-id="${event.id}"`,'danger-button'):''}</div>
    ${message?`<p class="creation-success" role="status">${esc(message)}</p>`:''}${errorBox()}
    ${canManage()?`<nav class="event-section-tabs" aria-label="Sections de l’événement">${button('event-section','Course',`data-section="race" aria-pressed="${eventSection==='race'}"`,'event-section-tab')}${button('event-section','Équipages',`data-section="crews" aria-pressed="${eventSection==='crews'}"`,'event-section-tab')}</nav>`:''}
    <section class="race-recap" aria-label="Récapitulatif de la course">
      <div class="recap-intro"><div><p class="recap-kicker">${eventSection==='crews'?'GESTION DES ÉQUIPAGES':'RÉCAPITULATIF DE LA COURSE'}</p><h2>${esc(event.name)}</h2><p>${eventSection==='crews'?'Les organisateurs composent les équipages à partir des pilotes inscrits.':'Les départs et les inscriptions sont regroupés dans les volets ci-dessous.'}</p></div><span class="recap-countdown">${nextDeparture?`Prochain départ <strong data-countdown="${nextDeparture.startsAt}">${countdown(nextDeparture.startsAt)}</strong>`:'Course terminée'}</span></div>
      <div class="recap-stats"><div><strong>${event.durationHours||6} h</strong><span>durée</span></div><div><strong>${event.departures.length}</strong><span>départ${event.departures.length>1?'s':''}</span></div><div><strong>${totalPilots}</strong><span>pilote${totalPilots>1?'s':''}</span></div><div><strong>${totalCrews}</strong><span>équipage${totalCrews>1?'s':''}</span></div></div>
      <div class="recap-circuit"><strong>Circuit</strong><span>${esc(circuitLabel(event.circuit))}</span></div><div class="recap-categories"><span>Catégories :</span>${event.categories.map(badge).join('')}</div>
    </section>
    ${eventSection==='crews'?renderCrewPage(event,nextDeparture):`<section class="departure-accordion" aria-label="Départs de la course">${event.departures.map((departure,index)=>renderDeparturePanel(event,departure,index,departure.id===nextDeparture?.id||departure.id===selectedDepartureId)).join('')}</section>`}`;
  showRecoveryLink();
}
function renderDeparturePanel(event,departure,index,open=false) {
  const locked=departure.startsAt<=Date.now(),crews=departure.crews||[],available=departure.availability.filter(r=>r.status!=='unavailable').length;
  return `<details class="departure-fold" id="departure-${departure.id}" ${open?'open':''}>
    <summary><span class="fold-index">${String(index+1).padStart(2,'0')}</span><span class="fold-date"><strong>${esc(dateLabel(departure))}</strong><span>${departure.time} · ${locked?'Départ passé':'Départ à venir'}</span></span><span class="fold-meta">${available} pilote${available>1?'s':''} · ${crews.length} équipage${crews.length>1?'s':''}</span><span class="fold-countdown" data-countdown="${departure.startsAt}">${countdown(departure.startsAt)}</span></summary>
    <div class="departure-fold-body"><div class="fold-toolbar"><span>${locked?'Les inscriptions sont verrouillées pour ce départ.':'Inscription et organisation du départ'}</span>${button('focus-registration','Aller à mon inscription',`data-departure="${departure.id}"`)}</div>
      ${locked?'<p class="finished-history">Les inscriptions sont verrouillées. Les pilotes et équipages restent consultables.</p>':''}
      <section class="fold-section"><h2>Pilotes inscrits</h2>${renderPilots(event,departure)}</section>
      ${locked?'':`<section class="fold-section fold-registration"><h2>Mon inscription</h2>${renderRegistrationForm(event,departure)}</section>`}
    </div>
  </details>`;
}
function renderCrewPage(event,nextDeparture) {
  return `<section class="departure-accordion crew-page-accordion" aria-label="Gestion des équipages">${event.departures.map((departure,index)=>`<details class="departure-fold" id="crew-departure-${departure.id}" ${departure.id===nextDeparture?.id||departure.id===selectedDepartureId?'open':''}>
    <summary><span class="fold-index">${String(index+1).padStart(2,'0')}</span><span class="fold-date"><strong>${esc(dateLabel(departure))}</strong><span>${departure.time} · ${departure.startsAt<=Date.now()?'Départ passé':'Départ à venir'}</span></span><span class="fold-meta">${(departure.crews||[]).length} équipage${(departure.crews||[]).length>1?'s':''}</span><span class="fold-countdown" data-countdown="${departure.startsAt}">${countdown(departure.startsAt)}</span></summary>
    <div class="departure-fold-body"><section class="fold-section crew-only-section"><h2>Équipages du départ</h2>${renderCrews(event,departure)}</section></div>
  </details>`).join('')}</section>`;
}
function renderPilots(event,departure) {
  return `<div class="pilot-section"><h2 class="pilot-section-title">PILOTES INSCRITS</h2>
    ${event.categories.map(category=>{const regs=departure.availability.filter(r=>r.category===category&&r.status!=='unavailable'),allCrews=departure.crews||[],crews=allCrews.filter(crew=>crew.category===category),assigned=new Set(crews.flatMap(crew=>crew.registrationIds)),unassigned=regs.filter(reg=>!assigned.has(reg.id));if(!regs.length)return '';return `<div class="category-group"><div class="category-group-header ${categories[category]?.css||''}">${logo(category)}<span>${esc(category)} · ${regs.length}</span></div>${crews.map(crew=>{const crewRegs=crew.registrationIds.map(id=>regs.find(reg=>reg.id===id)).filter(Boolean);return crewRegs.length?`<div class="crew-pilot-group ${crewColorClass(crew.id,allCrews.indexOf(crew))}"><div class="crew-pilot-group-header"><strong>${esc(crew.name)}</strong><span>${esc(crew.car||'Voiture à choisir')}</span></div>${crewRegs.map(reg=>renderRegistration(reg,departure,event.durationHours||6)).join('')}</div>`:'';}).join('')}${unassigned.map(reg=>renderRegistration(reg,departure,event.durationHours||6)).join('')}</div>`;}).join('')}
    ${departure.availability.filter(r=>r.status==='unavailable').map(reg=>renderRegistration(reg,departure,event.durationHours||6)).join('')}
    ${!departure.availability.length?'<p class="no-pilots">Aucun pilote inscrit sur ce départ.</p>':''}</div>`;
}
function coversHour(reg,index) { return reg.status==='whole'||reg.status.split(',').includes(`h${index+1}`); }
function renderCrewForm(event) {
  const draft=crewDraft;
  const departure=event.departures.find(d=>d.id===draft.departureId);
  const preferences=(departure?.availability||[]).filter(r=>r.status!=='unavailable'&&r.category===draft.category);
  const preferenceList=preferences.length?`<ul class="crew-preference-list">${preferences.map(r=>`<li><strong>${esc(r.name)}</strong><span>${esc(registrationCarLabel(r))}</span></li>`).join('')}</ul>`:'<p class="muted">Aucun pilote inscrit dans cette catégorie pour ce départ.</p>';
  return `<form class="crew-form" data-kind="crew" data-departure="${esc(draft.departureId||selectedDepartureId||'')}"><h3>${draft.id?'Modifier l’équipage':'Nouvel équipage'}</h3>
    <label>Nom de l’équipage<input name="crewName" maxlength="60" required value="${esc(draft.name)}" placeholder="Ex. FMT Racing 1"></label>
    <label>Catégorie<select name="crewCategory">${event.categories.map(c=>`<option ${draft.category===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
    <label>Voiture de l’équipage<select name="crewCar"><option value="">Voiture à définir</option>${(CARS[draft.category]||[]).map(car=>`<option value="${esc(car)}" ${draft.car===car?'selected':''}>${esc(car)}</option>`).join('')}</select></label>
    <div class="crew-preferences"><strong>Préférences des pilotes à affecter</strong>${preferenceList}</div>
    <p class="creation-help">Choisis le modèle retenu pour l’équipage. Les préférences affichées viennent des pilotes inscrits.</p>
    <div class="toolbar"><button type="submit" class="primary-button">Enregistrer l’équipage</button>${button('cancel-crew','Annuler')}</div></form>`;
}
function renderCrews(event,departure) {
  const crews=departure.crews||[],manage=canManage()&&departure.startsAt>Date.now(),duration=event.durationHours||6;
  const assigned=new Set(crews.flatMap(c=>c.registrationIds));
  const unassigned=departure.availability.filter(r=>!assigned.has(r.id)&&r.status!=='unavailable');
  return `<div class="crew-section"><div class="crew-heading"><div><h2>Équipages</h2><p>Composition définie par les organisateurs. Les pilotes d’un même équipage sont regroupés par couleur de catégorie.</p></div>${manage&&!crewDraft?button('new-crew','+ Créer un équipage',`data-departure="${departure.id}"`,'primary-button'):''}</div>
    ${manage&&crewDraft?.departureId===departure.id?renderCrewForm(event):''}
    ${crews.length?`<div class="crew-list">${crews.map((crew,crewIndex)=>{
      const regs=crew.registrationIds.map(id=>departure.availability.find(r=>r.id===id)).filter(Boolean);
      const counts=Array.from({length:duration},(_,i)=>regs.filter(r=>coversHour(r,i)).length);
      const candidates=unassigned.filter(r=>r.category===crew.category);
      const covered=counts.filter(n=>n>0).length;
      return `<article class="crew-card crew-category-${categories[crew.category]?.css||''} ${crewColorClass(crew.id,crewIndex)}" data-crew="${crew.id}"><div class="crew-card-header"><div>${badge(crew.category)}<h3>${esc(crew.name)}</h3><p class="crew-car">${esc(crew.car||'Voiture à choisir')}</p></div><span class="coverage-summary">${regs.length} pilote(s) · ${covered}/${duration} h</span></div>
        <ul class="crew-roster">${regs.map(r=>`<li><div><strong class="crew-pilot-name">${esc(r.name)}</strong><small>${esc(registrationCarLabel(r))} · ${esc(statusLabel(r.status))}${r.preferredPilot?` · souhaite ${esc(r.preferredPilot)}`:''}</small></div>${manage?button('remove-crew-pilot','Retirer',`data-id="${crew.id}" data-departure="${departure.id}" data-registration="${r.id}" aria-label="Retirer ${esc(r.name)} de cet équipage"`):''}</li>`).join('')||'<li>Aucun pilote affecté.</li>'}</ul>
        <div class="crew-availability-line duration-${duration}" aria-label="Disponibilité de l’équipage">${counts.map((n,i)=>`<span class="crew-availability-hour ${phaseClass(i,duration)} ${n?'covered':'gap'}" title="Heure ${i+1} : ${n?`${n} pilote(s)`:'aucun pilote'}">${i+1}</span>`).join('')}</div>
        <p class="coverage-note">${covered===duration?'Toutes les heures sont couvertes.':`${duration-covered} heure(s) sans présence.`}</p>
        ${regs.some(r=>/beginning|middle|end/.test(r.status))?'<p class="coverage-note">Certaines disponibilités anciennes doivent être précisées heure par heure ; elles ne sont pas comptées dans la couverture.</p>':''}
        ${manage?`<div class="crew-assignment"><label for="assign-${crew.id}">Ajouter un pilote inscrit · ${esc(crew.category)}</label><div><select id="assign-${crew.id}" ${!candidates.length?'disabled':''}><option value="">${candidates.length?'Choisir un pilote':'Aucun pilote à affecter dans cette catégorie'}</option>${candidates.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>${button('add-crew-pilot','Ajouter',`data-id="${crew.id}" data-departure="${departure.id}" ${!candidates.length?'disabled':''}`)}</div></div><div class="crew-actions">${button('edit-crew','Modifier',`data-id="${crew.id}" data-departure="${departure.id}"`)}${button('delete-crew','Supprimer',`data-id="${crew.id}" data-departure="${departure.id}"`,'danger-button')}</div>`:''}</article>`;
    }).join('')}</div>`:'<div class="empty">Aucun équipage créé sur ce départ pour le moment.</div>'}
    ${manage?`<details class="unassigned-list"><summary>${unassigned.length} pilote(s) restant à affecter</summary><ul>${unassigned.map(r=>`<li>${esc(r.name)} · ${esc(r.category)}</li>`).join('')||'<li>Tous les pilotes inscrits disponibles sont affectés.</li>'}</ul></details>`:''}</div>`;
}
function departureFields(departure={}) {
  const fieldId=crypto.randomUUID();
  return `<div class="departure-field" data-id="${esc(departure.id||'')}"><div><label class="form-label" for="date-${fieldId}">Date</label><input id="date-${fieldId}" name="date" type="date" value="${esc(departure.date||'')}" required></div>
    <div><label class="form-label" for="time-${fieldId}">Heure (Paris)</label><input id="time-${fieldId}" name="time" type="time" value="${esc(departure.time||'')}" required></div>
    ${button('remove-departure','×','aria-label="Supprimer ce départ"','remove-departure')}</div>`;
}
function renderEventForm(event=null) {
  if(!canManage())throw Error('Connecte-toi avec un compte autorisé.');
  page='form';editingEvent=event?structuredClone(event):null;
  app.innerHTML=`${button('home','← Retour','','secondary-button back-button')}
    <h1 class="page-title">${event?'MODIFIER L’ÉVÉNEMENT':'NOUVEL ÉVÉNEMENT'}</h1>
    <form class="form-panel event-creation" data-kind="event">
      <label class="form-label" for="eventName">Nom de l’événement</label><input id="eventName" name="eventName" maxlength="100" value="${esc(event?.name||'')}" placeholder="Ex : Daytona 8H" required>
      <label class="form-label" for="eventDuration">Durée de la course (heures)</label><input id="eventDuration" name="eventDuration" type="number" min="1" max="24" step="1" value="${esc(event?.durationHours||6)}" required><p class="creation-help">Cette durée crée automatiquement une case de disponibilité pour chaque heure de course.</p>
      <label class="form-label" for="eventType">Type d’événement</label><select id="eventType" name="eventType" class="event-type-select">${Object.entries(EVENT_TYPES).map(([key,item])=>`<option value="${key}" ${((event?.eventType||'private')===key)?'selected':''}>${item.label}</option>`).join('')}</select><p class="creation-help">La couleur sera visible sur la page des événements et dans le détail de la course.</p>
      <label class="form-label" for="eventCircuit">Circuit</label><select id="eventCircuit" name="eventCircuit" class="event-circuit-select" required><option value="">Sélectionner un circuit</option>${CIRCUITS.map(c=>`<option value="${c.id}" ${(event?.circuit||'')===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><p class="creation-help">Les images doivent être placées dans <code>public/images/circuits/</code> avec le nom du circuit (par exemple <code>daytona.png</code>).</p>
      <fieldset class="creation-fieldset"><legend class="form-label">Catégories autorisées</legend><p class="creation-help">Une ou plusieurs catégories.</p>
        <div class="event-category-options">${CATEGORIES.map(category=>`<label class="event-category-option ${categories[category].css}"><input type="checkbox" name="eventCategory" value="${esc(category)}" ${event?.categories.includes(category)?'checked':''}>${logo(category)}<span>${esc(category)}</span></label>`).join('')}</div></fieldset>
      <fieldset class="creation-fieldset"><legend class="form-label">Départs possibles</legend><p class="creation-help">Les dates et heures sont celles de Paris, pour tous les pilotes.</p>
        <div id="departureFields" class="departure-fields">${(event?.departures||[{}]).map(departureFields).join('')}</div>${button('add-departure','+ Ajouter un départ','','secondary-button add-departure-button')}</fieldset>
      ${event?'<p class="creation-help">Un départ avec des inscrits ne peut pas être supprimé, ni une catégorie encore utilisée. Préviens les pilotes si tu changes un horaire.</p>':''}
      ${errorBox()}<button type="submit" class="primary-button">${event?'ENREGISTRER LES MODIFICATIONS':'CRÉER L’ÉVÉNEMENT'}</button>
    </form>`;
  updateRemoveButtons();
}
function updateRemoveButtons(){const buttons=app.querySelectorAll('[data-action="remove-departure"]');buttons.forEach(b=>b.disabled=buttons.length===1);}
async function renderMembers() {
  if(!isAdmin())throw Error('Accès réservé aux administrateurs.');
  const result=await api('/api/members');members=result.members;page='members';
  app.innerHTML=`${button('home','← Retour','','secondary-button back-button')}<h1 class="page-title">GESTION DES MEMBRES</h1>
    <p class="creation-help">Un pilote apparaît ici après sa première connexion Discord. Le rôle Organisateur permet de créer et modifier les événements.</p>${errorBox()}
    <div class="member-list">${members.map(member=>`<form class="member-row" data-kind="member" data-id="${member.id}"><div><strong>${esc(member.name)}</strong><small>Discord : ${member.id}</small></div>
      ${member.role==='admin'?'<span>Administrateur principal</span>':`<label><span class="sr-only">Rôle de ${esc(member.name)}</span><select name="role"><option value="pilot" ${member.role==='pilot'?'selected':''}>Pilote</option><option value="organizer" ${member.role==='organizer'?'selected':''}>Organisateur</option></select></label><button class="secondary-button" type="submit">Enregistrer</button>`}</form>`).join('')}</div>`;
}
function renderMyEntries() {
  page='my-entries';
  const entries=events.flatMap(event=>event.departures.flatMap(departure=>departure.availability.filter(r=>r.mine).map(reg=>({event,departure,reg}))));
  app.innerHTML=`${button('home','← Retour','','secondary-button back-button')}<h1 class="page-title">MES INSCRIPTIONS</h1>${errorBox()}
    ${!user?'<p class="creation-help">Les inscriptions de cet appareil ou de ton lien personnel sont affichées ici.</p>':''}
    ${entries.length?`<div class="event-list">${entries.map(({event,departure,reg})=>`<button class="event-card" data-action="open" data-id="${event.id}" data-departure="${departure.id}"><span class="event-name">${esc(event.name)}</span><span class="event-info">${esc(dateLabel(departure))} à ${departure.time} · ${esc(reg.name)} · ${esc(statusLabel(reg.status))}</span></button>`).join('')}</div>`:'<p class="empty">Aucune inscription retrouvée. Si tu t’es inscrit sans compte sur un autre appareil, ouvre ton lien personnel.</p>'}`;
}
async function submitRegistration(form) {
  const departureId=form.dataset.departure,event=events.find(e=>e.id===currentEventId),departure=event.departures.find(d=>d.id===departureId),state=draftFor(departure);
  state.name=form.elements.pilotName.value.trim();
  if(!state.name)throw Error('Indique ton pseudo.');
  if(!state.status)throw Error('Choisis ta disponibilité.');
  if(state.status!=='unavailable'&&!state.category)throw Error('Choisis ta catégorie.');
  state.cars=[...form.querySelectorAll('[name="carPreference"]:checked')].map(input=>input.value);
  state.carAny=!!form.elements.carAny?.checked;
  if(state.status!=='unavailable'&&!state.carAny&&!state.cars.length)throw Error('Choisis au moins une voiture, ou coche « Peu importe la voiture ».');
  const payload={name:state.name,status:state.status,category:state.category,cars:state.cars,carAny:state.carAny,preferredPilot:state.preferredPilot||'',version:state.version};
  const result=await api(state.id?`/api/registrations/${state.id}`:`/api/events/${event.id}/departures/${departure.id}/registrations`,state.id?'PATCH':'POST',payload);
  pilotName=state.name;try{localStorage.setItem('fmt_pilot_name',pilotName);}catch{}
  if(result.recoveryLink)recoveryLink=result.recoveryLink;
  delete drafts[departureId];
  await refreshAfterSave('Inscription enregistrée.');
}
async function submitEvent(form) {
  const data={name:form.elements.eventName.value.trim(),durationHours:Number(form.elements.eventDuration.value),eventType:form.elements.eventType.value,circuit:form.elements.eventCircuit.value,categories:[...form.querySelectorAll('[name="eventCategory"]:checked')].map(input=>input.value),departures:[...form.querySelectorAll('.departure-field')].map(row=>({id:row.dataset.id||undefined,date:row.querySelector('[name="date"]').value,time:row.querySelector('[name="time"]').value})),version:editingEvent?.version};
  if(!data.categories.length)throw Error('Sélectionne au moins une catégorie.');
  if(!data.circuit)throw Error('Sélectionne le circuit de la course.');
  const editing=!!editingEvent;
  const result=await api(editing?`/api/events/${editingEvent.id}`:'/api/events',editing?'PATCH':'POST',data);
  if(editing){currentEventId=editingEvent.id;page='event';}else{page='home';currentEventId=null;}
  await refreshAfterSave(editing?'Événement modifié.':'Événement créé.',result.id);
}
async function refreshAfterSave(message,firstId) {
  try {
    await load();
    if(firstId)events.sort((a,b)=>a.id===firstId?-1:b.id===firstId?1:0);
    if(page==='event')renderEvent(message);else renderHome(message);
  } catch {
    // The write already succeeded: do not offer the original submit again.
    app.innerHTML=`<p class="creation-success" role="status">${esc(message)}</p><p>La mise à jour de l’affichage a échoué.</p>${button('refresh','Recharger les données')}${errorBox()}`;
  }
}
async function refresh() {
  await load();drafts={};
  if(page==='event')renderEvent();else if(page==='my-entries')renderMyEntries();else if(page==='members')await renderMembers();else renderHome();
}
async function perform(action,target) {
  const event=events.find(e=>e.id===currentEventId);
  switch(action){
    case 'home':renderHome();break;
    case 'event-filter':eventFilter=target.dataset.filter||'upcoming';renderHome();break;
    case 'refresh':await refresh();break;
    case 'open':currentEventId=target.dataset.id;selectedDepartureId=target.dataset.departure||null;eventSection='race';crewDraft=null;drafts={};renderEvent();break;
    case 'focus-registration':{const fold=document.getElementById('departure-'+target.dataset.departure);if(fold){fold.open=true;fold.querySelector('.fold-registration')?.scrollIntoView({behavior:'smooth',block:'start'});}break;}
    case 'event-section':eventSection=target.dataset.section;crewDraft=null;renderEvent();break;
    case 'departure-prev':case 'departure-next':{
      if(crewDraft&&!confirm('Quitter le formulaire d’équipage sans l’enregistrer ?'))return;
      const index=event.departures.findIndex(d=>d.id===selectedDepartureId)+(action==='departure-next'?1:-1);
      if(event.departures[index]){selectedDepartureId=event.departures[index].id;crewDraft=null;renderEvent();}break;
    }
    case 'new-crew':selectedDepartureId=target.dataset.departure;crewDraft={name:'',category:event.categories[0],car:'',departureId:selectedDepartureId};renderEvent();app.querySelector(`[name="crewName"][data-departure="${selectedDepartureId}"]`)?.focus();break;
    case 'cancel-crew':crewDraft=null;renderEvent();break;
    case 'edit-crew':selectedDepartureId=target.dataset.departure;crewDraft={...structuredClone(event.departures.find(d=>d.id===selectedDepartureId).crews.find(c=>c.id===target.dataset.id)),departureId:selectedDepartureId};renderEvent();app.querySelector(`[name="crewName"][data-departure="${selectedDepartureId}"]`)?.focus();break;
    case 'delete-crew':case 'add-crew-pilot':case 'remove-crew-pilot':{
      selectedDepartureId=target.dataset.departure||selectedDepartureId;
      const crew=event.departures.find(d=>d.id===selectedDepartureId).crews.find(c=>c.id===target.dataset.id);
      if(action==='delete-crew'){
        if(!confirm(`Supprimer « ${crew.name} » ? Les inscriptions des pilotes seront conservées.`))return;
        await api('/api/crews/'+crew.id,'DELETE',{version:crew.version});
      }else if(action==='add-crew-pilot'){
        const registrationId=document.getElementById('assign-'+crew.id).value;
        if(!registrationId)throw Error('Choisis un pilote dans la liste.');
        await api('/api/crews/'+crew.id+'/members','POST',{registrationId,version:crew.version});
      }else{
        if(!confirm('Retirer ce pilote de l’équipage ? Son inscription sera conservée.'))return;
        await api('/api/crews/'+crew.id+'/members/'+target.dataset.registration,'DELETE',{version:crew.version});
      }
      crewDraft=null;await refreshAfterSave('Équipages mis à jour.');break;
    }
    case 'create':renderEventForm();break;
    case 'edit-event':renderEventForm(event);break;
    case 'add-departure':if(app.querySelectorAll('.departure-field').length>=30)throw Error('Maximum 30 départs par événement.');document.getElementById('departureFields').insertAdjacentHTML('beforeend',departureFields());updateRemoveButtons();break;
    case 'remove-departure':if(app.querySelectorAll('.departure-field').length>1)target.closest('.departure-field').remove();updateRemoveButtons();break;
    case 'availability':{
      selectedDepartureId=target.dataset.departure;
      const departure=event.departures.find(d=>d.id===target.dataset.departure),state=draftFor(departure),value=target.dataset.value;
      if(['whole','unavailable'].includes(value))state.status=value;
      else{const duration=event.durationHours||6;const parts=new Set(state.status==='whole'?Array.from({length:duration},(_,i)=>`h${i+1}`):state.status.split(',').filter(part=>/^h\d+$/.test(part)));parts.has(value)?parts.delete(value):parts.add(value);state.status=parts.size===duration?'whole':Array.from(parts).sort((a,b)=>Number(a.slice(1))-Number(b.slice(1))).join(',');}
      renderEvent();break;
    }
    case 'new-registration':{
      selectedDepartureId=target.dataset.departure;
      const departure=event.departures.find(d=>d.id===target.dataset.departure);
      drafts[departure.id]={name:'',category:'',cars:[],carAny:false,status:'',preferredPilot:'',id:null,version:null};
      renderEvent();document.getElementById('name-'+departure.id)?.focus();break;
    }
    case 'category':{selectedDepartureId=target.dataset.departure;const state=draftFor(event.departures.find(d=>d.id===target.dataset.departure));state.category=target.dataset.value;state.cars=(state.cars||[]).filter(car=>CARS[state.category]?.includes(car));state.carAny=false;renderEvent();break;}
    case 'edit-registration':{
      selectedDepartureId=target.dataset.departure;
      const departure=event.departures.find(d=>d.id===target.dataset.departure),reg=departure.availability.find(r=>r.id===target.dataset.id);
      if(!reg?.canEdit)throw Error('Cette inscription ne t’appartient pas.');drafts[departure.id]={name:reg.name,id:reg.id,version:reg.version,status:reg.status,preferredPilot:reg.preferredPilot||'',category:reg.category,cars:reg.cars|| (reg.car?[reg.car]:[]),carAny:!!reg.carAny};eventSection='race';renderEvent();document.getElementById('name-'+departure.id)?.focus();break;
    }
    case 'delete-registration':{
      const departure=event.departures.find(d=>d.id===target.dataset.departure),reg=departure.availability.find(r=>r.id===target.dataset.id);
      if(!confirm(`Supprimer l’inscription de ${reg.name} pour ce départ ?`))return;
      await api('/api/registrations/'+reg.id,'DELETE',{version:reg.version});delete drafts[departure.id];await refreshAfterSave('Inscription supprimée.');break;
    }
    case 'delete-event':if(!confirm(`Supprimer « ${event.name} » et toutes ses inscriptions ? Cette suppression est définitive.`))return;await api('/api/events/'+event.id,'DELETE',{version:event.version});page='home';await refreshAfterSave('Événement supprimé.');break;
    case 'members':await renderMembers();break;
    case 'my-entries':await load();renderMyEntries();break;
    case 'logout':await api('/api/auth/logout','POST');recoveryLink='';await load();renderHome('Déconnexion effectuée.');break;
    case 'guest-link':recoveryLink=(await api('/api/guest/link','POST')).link;if(page==='event')renderEvent();else renderHome();break;
    case 'copy-link':try{await navigator.clipboard.writeText(recoveryLink);target.textContent='Lien copié';}catch{document.getElementById('personalLink')?.select();throw Error('Copie le lien sélectionné avec Ctrl+C.');}break;
    case 'hide-link':recoveryLink='';target.closest('.recovery-panel').remove();break;
  }
}
document.addEventListener('input',event=>{const field=event.target;if(field.dataset.departure&&drafts[field.dataset.departure]){if(field.name==='pilotName')drafts[field.dataset.departure].name=field.value;if(field.name==='preferredPilot')drafts[field.dataset.departure].preferredPilot=field.value;}});
document.addEventListener('change',event=>{
  const field=event.target;
  if(field.dataset.departure&&drafts[field.dataset.departure]&&(field.name==='carPreference'||field.name==='carAny')){
    const draft=drafts[field.dataset.departure];
    draft.cars=[...field.form.querySelectorAll('[name="carPreference"]:checked')].map(input=>input.value);
    draft.carAny=!!field.form.elements.carAny?.checked;
    if(draft.carAny)draft.cars=[];
    renderEvent();
  }
  if(field.name==='crewCategory'&&crewDraft){crewDraft.category=field.value;crewDraft.car='';renderEvent();return;}
  if(field.name==='crewCar'&&crewDraft)crewDraft.car=field.value;
});
document.addEventListener('input',event=>{if(!crewDraft)return;const key={crewName:'name'}[event.target.name];if(key)crewDraft[key]=event.target.value;});
document.addEventListener('error',event=>{
  const image=event.target;
  if(!(image instanceof HTMLImageElement)||!image.matches('.circuit-visual img'))return;
  const circuit=circuitInfo(image.dataset.circuit), slug=image.dataset.circuit, attempts=Number(image.dataset.attempts||0), sources=[`/images/${circuit?.file||slug+'.png'}`,`/images/circuits/${slug}.png`,`/images/${slug}.png`,`/images/circuits/${slug}.jpg`,`/images/${slug}.jpg`,`/images/circuits/${slug}.webp`,`/images/${slug}.webp`];
  if(attempts<sources.length){image.dataset.attempts=String(attempts+1);image.src=sources[attempts];}else image.remove();
},true);
document.addEventListener('change',event=>{
  if(event.target.id!=='departure-select')return;
  if(busy||(crewDraft&&!confirm('Quitter le formulaire d’équipage sans l’enregistrer ?'))){event.target.value=selectedDepartureId;return;}
  selectedDepartureId=event.target.value;crewDraft=null;renderEvent();
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;event.preventDefault();if(busy)return;
  busy=true;target.disabled=true;
  try{await perform(target.dataset.action,target);}catch(error){showError(error);}finally{busy=false;if(target.isConnected)target.disabled=false;updateRemoveButtons();}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.kind)return;event.preventDefault();if(busy)return;
  busy=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try{
    if(form.dataset.kind==='event')await submitEvent(form);
    else if(form.dataset.kind==='registration')await submitRegistration(form);
    else if(form.dataset.kind==='crew'){
      const draft=crewDraft;
      const departureId=form.dataset.departure||draft.departureId||selectedDepartureId;
      await api(draft.id?'/api/crews/'+draft.id:`/api/events/${currentEventId}/departures/${departureId}/crews`,draft.id?'PATCH':'POST',{name:form.elements.crewName.value,category:form.elements.crewCategory.value,car:form.elements.crewCar.value,version:draft.version});
      crewDraft=null;await refreshAfterSave('Équipage enregistré. Tu peux maintenant y affecter les pilotes.');
    }
    else if(form.dataset.kind==='member'){await api('/api/members/'+form.dataset.id,'PATCH',{role:form.elements.role.value});await renderMembers();app.insertAdjacentHTML('afterbegin','<p class="creation-success" role="status">Autorisations mises à jour.</p>');}
  }catch(error){showError(error);}finally{busy=false;if(submit.isConnected)submit.disabled=false;}
});
setInterval(()=>{
  document.querySelectorAll('[data-countdown]').forEach(element=>element.textContent=countdown(Number(element.dataset.countdown)));
},1000);
async function start(){
  try{
    const token=new URLSearchParams(location.hash.slice(1)).get('access');
    if(token){history.replaceState(null,'',location.pathname+location.search);await api('/api/guest/recover','POST',{token});flash='Tes inscriptions invitées sont accessibles sur cet appareil.';}
    const authError=new URLSearchParams(location.search).get('auth');
    if(authError){history.replaceState(null,'',location.pathname);flash='La connexion Discord n’a pas abouti. Tu peux réessayer.';}
    await load();renderHome(flash);
  }catch(error){app.innerHTML=`<h1 class="page-title">ENDURANCE MANAGER</h1>${errorBox()}${button('refresh','Réessayer')}`;showError(error);}
}
start();
