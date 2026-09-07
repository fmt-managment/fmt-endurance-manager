const CATEGORIES = ['Hypercar','LMP2 ELMS','LMP2 WEC','LMP3','GT3','GTE'];
const EVENT_TYPES = {special:{label:'Special event',css:'special'},lmu:{label:'Championnat LMU',css:'lmu'},private:{label:'Championnat privé',css:'private'}};
const categories = {
  Hypercar:{image:'HC.png',css:'hyper'},
  'LMP2 ELMS':{image:'LMP2.png',css:'lmp2'},
  'LMP2 WEC':{image:'LMP2.png',css:'lmp2'},
  LMP3:{image:'P3.png',css:'lmp3'},
  GT3:{image:'GT3.png',css:'gt3'},
  GTE:{css:'gte'}
};
const app = document.getElementById('app');
const nav = document.getElementById('navigation');
let events=[], user=null, discordReady=false, currentEventId=null, page='home', editingEvent=null;
let drafts={}, recoveryLink='', busy=false, members=[], flash='';
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
function button(action,label,extra='',css='secondary-button') { return `<button type="button" class="${css}" data-action="${action}" ${extra}>${label}</button>`; }
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
  app.innerHTML=`<h1 class="page-title">ÉVÉNEMENTS</h1>
    <p class="page-subtitle">Courses d’endurance FMT · Horaires de Paris</p>
    ${message?`<p class="creation-success" role="status">${esc(message)}</p>`:''}${errorBox()}
    <div class="toolbar">${button('refresh','Actualiser')}${button('my-entries','Mes inscriptions')}${!user?button('guest-link','Mon lien personnel'):''}</div>
    ${events.length?`<div class="event-list">${events.map(event=>{
      const next=event.departures.find(d=>d.startsAt>Date.now());
      return `<button class="event-card" data-action="open" data-id="${event.id}">
        <span class="event-name">${esc(event.name)}</span>
        <span class="event-info">${eventTypeBadge(event.eventType)} · ${event.durationHours||6} h · ${event.departures.length} départ${event.departures.length>1?'s':''} · ${event.departures.reduce((sum,d)=>sum+d.availability.filter(r=>r.status!=='unavailable').length,0)} inscription(s)</span>
        <span class="event-category-badges">${event.categories.map(badge).join('')}</span>
        <span class="event-countdown ${next?'':'finished'}">${next?`Prochain départ : ${esc(dateLabel(next))} à ${next.time} · <span data-countdown="${next.startsAt}">${countdown(next.startsAt)}</span>`:'Tous les départs sont passés'}</span>
      </button>`;
    }).join('')}</div>`:'<div class="empty">Aucun événement pour le moment. Un organisateur pourra créer la première course.</div>'}`;
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
    drafts[departure.id]={name:mine?.name || pilotName, category:mine?.category || '',status:mine?.status || '',id:mine?.id || null,version:mine?.version || null};
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
function renderRegistration(reg,departure,duration) {
  const locked=departure.startsAt<=Date.now();
  const parts=new Set(reg.status.split(',').filter(x=>/^h\d+$/.test(x))),hours=Array.from({length:duration},(_,i)=>`h${i+1}`);
  const timeline=`<div class="availability-readonly" aria-label="${esc(registrationSlotLabel(reg.status,departure,duration))}"><span class="timeline-edge">DÉPART</span><div class="availability-track" style="--duration:${duration}">${hours.map((hour,i)=>`<span class="availability-segment ${reg.status==='whole'||parts.has(hour)?'present':''}" style="--phase-color:${phaseColor(i,duration)}" title="Heure ${i+1}">H${i+1}</span>`).join('')}</div><span class="timeline-edge">ARRIVÉE</span></div>`;
  return `<div class="pilot-row"><div class="pilot-main"><span class="pilot-name">${esc(reg.name)}${reg.mine?' <small>(toi)</small>':''}</span>
    <span class="pilot-category-logo">${reg.category?logo(reg.category):'—'}</span><span class="registration-status">${esc(registrationSlotLabel(reg.status,departure,duration))}</span></div>${timeline}
    ${reg.canEdit&&!locked?button('edit-registration','Modifier',`data-id="${reg.id}" data-departure="${departure.id}"`,'edit-button'):''}</div>`;
}
function renderRegistrationForm(event,departure) {
  const state=draftFor(departure),parts=state.status.split(',').filter(Boolean),duration=event.durationHours||6;
  return `<form class="form-section registration-form" data-kind="registration" data-departure="${departure.id}">
    <h3 class="form-title">${state.id?'Modifier l’inscription':'Mon inscription'}</h3>
    ${state.id&&!departure.availability.find(r=>r.id===state.id)?.mine?'<p class="creation-help">Modification en tant qu’administrateur.</p>':''}
    <label class="form-label" for="name-${departure.id}">Pseudo pilote</label>
    <input id="name-${departure.id}" name="pilotName" data-departure="${departure.id}" value="${esc(state.name)}" maxlength="30" required autocomplete="nickname">
    <div class="registration-choices"><span class="form-label">Disponibilité pendant la course (${duration} h)</span><div class="availability-timeline"><span class="timeline-edge">DÉPART</span><div class="availability-track" style="--duration:${duration}">${Array.from({length:duration},(_,index)=>{const part=`h${index+1}`;return button('availability',`<span>H${index+1}</span>`,`data-departure="${departure.id}" data-value="${part}" aria-pressed="${parts.includes(part)}" style="--phase-color:${phaseColor(index,duration)}"`,`timeline-segment ${parts.includes(part)?'active':''}`);}).join('')}</div><span class="timeline-edge">ARRIVÉE</span></div><div class="special-availability">
      ${button('availability','TOUTE LA COURSE',`data-departure="${departure.id}" data-value="whole" aria-pressed="${state.status==='whole'}"`,`special-button whole ${state.status==='whole'?'active':''}`)}
      ${button('availability','INDISPONIBLE',`data-departure="${departure.id}" data-value="unavailable" aria-pressed="${state.status==='unavailable'}"`,`special-button unavailable ${state.status==='unavailable'?'active':''}`)}
    </div></div>
    ${state.status==='unavailable'?'':`<div class="category-area"><span class="form-label">Catégorie</span><div class="categories">
      ${event.categories.map(category=>button('category',`${logo(category)}<span>${esc(category)}</span>`,`data-departure="${departure.id}" data-value="${esc(category)}" aria-pressed="${state.category===category}"`,`category-button ${categories[category]?.css||''} ${state.category===category?'active':''}`)).join('')}
    </div></div>`}
    <div class="save-row"><button type="submit" class="save-button">${state.id?'ENREGISTRER':'S’INSCRIRE'}</button>
      ${state.id?button('delete-registration','Se désinscrire',`data-id="${state.id}" data-departure="${departure.id}"`,'danger-button'):''}</div>
  </form>`;
}
function renderEvent(message='') {
  page='event';
  const event=events.find(e=>e.id===currentEventId);
  if(!event){renderHome('Cet événement n’est plus disponible.');return;}
  app.innerHTML=`${button('home','← Retour aux événements','','secondary-button back-button')}
    <div class="event-header event-type-${event.eventType||'private'}"><div class="event-heading-line"><div><h1 class="event-title">${esc(event.name)}</h1><p class="event-subtitle">${eventTypeBadge(event.eventType)} · Course de ${event.durationHours||6} h · Horaires de Paris · ${event.departures.length} départ(s)</p></div></div>
    <div class="event-category-badges">${event.categories.map(badge).join('')}</div></div>
    <div class="toolbar">${button('refresh','Actualiser')}${canManage()?button('edit-event','Modifier l’événement',`data-id="${event.id}"`):''}${isAdmin()?button('delete-event','Supprimer l’événement',`data-id="${event.id}"`,'danger-button'):''}</div>
    ${message?`<p class="creation-success" role="status">${esc(message)}</p>`:''}${errorBox()}
    <div class="departures">${event.departures.map(departure=>{
      const locked=departure.startsAt<=Date.now();
      return `<section class="departure" id="departure-${departure.id}"><div class="departure-header"><h2 class="departure-date">${esc(dateLabel(departure))} <span class="departure-time">${departure.time}</span></h2>
        <span class="departure-countdown">${locked?'Départ passé':`<span data-countdown="${departure.startsAt}">${countdown(departure.startsAt)}</span>`}</span></div>
        <div class="pilot-section"><h3 class="pilot-section-title">${locked?'HISTORIQUE DES INSCRIPTIONS':'PILOTES INSCRITS'}</h3>
          ${event.categories.map(category=>{const regs=departure.availability.filter(r=>r.category===category&&r.status!=='unavailable');return regs.length?`<div class="category-group"><div class="category-group-header ${categories[category]?.css||''}">${logo(category)}<span>${esc(category)} · ${regs.length}</span></div>${regs.map(reg=>renderRegistration(reg,departure,event.durationHours||6)).join('')}</div>`:'';}).join('')}
          ${departure.availability.some(r=>r.status==='unavailable')?`<div class="category-group"><div class="category-group-header">Indisponibles</div>${departure.availability.filter(r=>r.status==='unavailable').map(reg=>renderRegistration(reg,departure,event.durationHours||6)).join('')}</div>`:''}
          ${!departure.availability.length?'<p class="no-pilots">Aucun pilote inscrit.</p>':''}</div>
        ${locked?'<p class="finished-history">Les inscriptions sont verrouillées pour ce départ.</p>':renderRegistrationForm(event,departure)}
      </section>`;
    }).join('')}</div>`;
  showRecoveryLink();
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
  const payload={name:state.name,status:state.status,category:state.category,version:state.version};
  const result=await api(state.id?`/api/registrations/${state.id}`:`/api/events/${event.id}/departures/${departure.id}/registrations`,state.id?'PATCH':'POST',payload);
  pilotName=state.name;try{localStorage.setItem('fmt_pilot_name',pilotName);}catch{}
  if(result.recoveryLink)recoveryLink=result.recoveryLink;
  delete drafts[departureId];
  await refreshAfterSave('Inscription enregistrée.');
}
async function submitEvent(form) {
  const data={name:form.elements.eventName.value.trim(),durationHours:Number(form.elements.eventDuration.value),eventType:form.elements.eventType.value,categories:[...form.querySelectorAll('[name="eventCategory"]:checked')].map(input=>input.value),departures:[...form.querySelectorAll('.departure-field')].map(row=>({id:row.dataset.id||undefined,date:row.querySelector('[name="date"]').value,time:row.querySelector('[name="time"]').value})),version:editingEvent?.version};
  if(!data.categories.length)throw Error('Sélectionne au moins une catégorie.');
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
    case 'refresh':await refresh();break;
    case 'open':currentEventId=target.dataset.id;drafts={};renderEvent();if(target.dataset.departure)document.getElementById('departure-'+target.dataset.departure)?.scrollIntoView({block:'start'});break;
    case 'create':renderEventForm();break;
    case 'edit-event':renderEventForm(event);break;
    case 'add-departure':if(app.querySelectorAll('.departure-field').length>=30)throw Error('Maximum 30 départs par événement.');document.getElementById('departureFields').insertAdjacentHTML('beforeend',departureFields());updateRemoveButtons();break;
    case 'remove-departure':if(app.querySelectorAll('.departure-field').length>1)target.closest('.departure-field').remove();updateRemoveButtons();break;
    case 'availability':{
      const departure=event.departures.find(d=>d.id===target.dataset.departure),state=draftFor(departure),value=target.dataset.value;
      if(['whole','unavailable'].includes(value))state.status=value;
      else{const parts=new Set(['whole','unavailable'].includes(state.status)?[]:state.status.split(',').filter(part=>/^h\d+$/.test(part)));parts.has(value)?parts.delete(value):parts.add(value);const duration=event.durationHours||3;state.status=parts.size===duration?'whole':Array.from(parts).sort((a,b)=>Number(a.slice(1))-Number(b.slice(1))).join(',');}
      renderEvent();break;
    }
    case 'category':draftFor(event.departures.find(d=>d.id===target.dataset.departure)).category=target.dataset.value;renderEvent();break;
    case 'edit-registration':{
      const departure=event.departures.find(d=>d.id===target.dataset.departure),reg=departure.availability.find(r=>r.id===target.dataset.id);
      if(!reg?.canEdit)throw Error('Cette inscription ne t’appartient pas.');drafts[departure.id]={name:reg.name,id:reg.id,version:reg.version,status:reg.status,category:reg.category};renderEvent();document.getElementById('name-'+departure.id)?.focus();break;
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
document.addEventListener('input',event=>{const field=event.target;if(field.name==='pilotName'&&field.dataset.departure&&drafts[field.dataset.departure])drafts[field.dataset.departure].name=field.value;});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();if(busy)return;
  busy=true;target.disabled=true;
  try{await perform(target.dataset.action,target);}catch(error){showError(error);}finally{busy=false;if(target.isConnected)target.disabled=false;updateRemoveButtons();}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.kind)return;event.preventDefault();if(busy)return;
  busy=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try{
    if(form.dataset.kind==='event')await submitEvent(form);
    else if(form.dataset.kind==='registration')await submitRegistration(form);
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
  }catch(error){app.innerHTML=`<h1 class="page-title">FMT ENDURANCE</h1>${errorBox()}${button('refresh','Réessayer')}`;showError(error);}
}
start();
