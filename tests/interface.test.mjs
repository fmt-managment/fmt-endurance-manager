import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function interfaceHarness(role='pilot',duration=6) {
  const app={innerHTML:'',querySelector:()=>null,insertAdjacentHTML(){}};
  const document={getElementById:()=>app,addEventListener(){}};
  const context=vm.createContext({document,Intl,Date,URLSearchParams,structuredClone,setInterval(){},localStorage:{getItem:()=>''},console});
  vm.runInContext(readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/start\(\);\s*$/,''),context);
  const departure={id:'first',date:'2090-01-01',time:'12:00',startsAt:Date.UTC(2090,0,1),availability:[{id:'reg',name:'<Pilot>',status:'whole',category:'Hypercar',car:'Ferrari 499P',cars:['Ferrari 499P'],carAny:false,version:1,mine:true,canEdit:true}],crews:[{id:'crew',name:'FMT <test>',car:'Ferrari 499P',category:'Hypercar',version:1,registrationIds:['reg']}]};
  const event={id:'event',name:'Test',circuit:'daytona',eventType:'special',durationHours:duration,categories:['Hypercar'],departures:[departure,{...departure,id:'second',time:'15:00',crews:[],availability:[]}]};
  vm.runInContext(`events=${JSON.stringify([event])};user={role:${JSON.stringify(role)}};currentEventId='event';`,context);
  return {app,context,run:code=>vm.runInContext(code,context)};
}
test('course recap, foldable departures, read-only crews for pilots, escaped names',()=>{
  const h=interfaceHarness();h.run('renderEvent()');
  assert(h.app.innerHTML.includes('RÉCAPITULATIF DE LA COURSE'));
  assert(h.app.innerHTML.includes('Daytona International Speedway'));
  assert(h.app.innerHTML.includes('event-type-special'));
  assert(h.app.innerHTML.includes('crew-pilot-group crew-palette-0'));
  assert(h.app.innerHTML.includes('Ferrari 499P'));
  assert(h.app.innerHTML.includes('id="departure-first"'));assert(h.app.innerHTML.includes('id="departure-second"'));
  assert.equal((h.app.innerHTML.match(/class="departure-fold"/g)||[]).length,2);
  h.run("eventSection='crews';renderEvent()");
  assert(h.app.innerHTML.includes('RÉCAPITULATIF DE LA COURSE'));
  assert(!h.app.innerHTML.includes('data-section="crews"'));
  assert(!h.app.innerHTML.includes('data-action="new-crew"'));
  assert(!h.app.innerHTML.includes('data-action="add-crew-pilot"'));
  assert(h.app.innerHTML.includes('Mon inscription'));
  assert(h.app.innerHTML.includes('fold-registration'));
});
test('organizer crew controls and hourly palette scale to 1, 4, 6 and 24 hours',async()=>{
  for(const duration of [1,4,6,24]) {
    const h=interfaceHarness('organizer',duration);
    h.run("eventSection='crews';renderEvent()");
    assert(h.app.innerHTML.includes('data-action="new-crew"'));
    assert(h.app.innerHTML.includes('data-action="remove-crew-pilot"'));
    assert.equal((h.app.innerHTML.match(/class="crew-availability-hour /g)||[]).length,duration);
    assert(h.app.innerHTML.includes('phase-0'));if(duration>1)assert(h.app.innerHTML.includes('phase-23'));
    h.run("eventSection='race';renderEvent()");
    assert(h.app.innerHTML.includes('availability-hour-grid compact-hours duration-'+duration));
    assert(h.app.innerHTML.includes('name="carPreference"'));
    assert(h.app.innerHTML.includes('name="carAny"'));
    assert.equal((h.app.innerHTML.match(/data-action="availability"/g)||[]).length,2*(duration+2));
    assert.equal((h.app.innerHTML.match(/hour-card phase-\d+ active/g)||[]).length,duration);
    await h.run("perform('availability',{dataset:{departure:'first',value:'h1'}})");
    assert.equal((h.app.innerHTML.match(/hour-card phase-\d+ active/g)||[]).length,duration-1);
    assert(!h.app.innerHTML.includes('style="'));
  }
});
