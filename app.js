/* Estimateur de projet bâtiment — tout en vanilla JS
   - Référentiel éditable et sauvegardable (LocalStorage)
   - Calculs instantanés au changement et via le bouton "Calculer"
   - Export JSON/CSV + import JSON
*/

const STORAGE_KEYS = {
  STATE: "estimator_state_v1",
  REF: "estimator_referential_v1"
};


function isObject(o){ return o && typeof o === 'object' && !Array.isArray(o); }

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

function normalizeRef(r){
  const d = deepClone(DEFAULT_REF);
  if(!isObject(r)) return deepClone(d);
  const out = deepClone(d);

  // shallow merge helpers
  const mergeObj = (dst, src) => {
    if(!isObject(src)) return;
    for(const [k,v] of Object.entries(src)){
      if(isObject(v) && isObject(dst[k])){
        mergeObj(dst[k], v);
      }else{
        dst[k] = v;
      }
    }
  };

  mergeObj(out, r);

  // Ensure required branches exist
  const requiredTop = ['typologies','reglementation','typeConstructif','contrainteSol','contrainteTerrain','chauffage','ventilation','lotsPresets','honoraires','opex'];
  for(const k of requiredTop){
    if(!isObject(out[k])) out[k] = deepClone(d[k]);
  }
  // OPEX sub-branches
  if(!isObject(out.opex.energyEurPerM2)) out.opex.energyEurPerM2 = deepClone(d.opex.energyEurPerM2);
  if(!isObject(out.opex.ventilationEnergyAdj)) out.opex.ventilationEnergyAdj = deepClone(d.opex.ventilationEnergyAdj);
  if(typeof out.opex.maintenancePctOfWorks !== 'number') out.opex.maintenancePctOfWorks = d.opex.maintenancePctOfWorks;
  if(typeof out.opex.inflationEnergy !== 'number') out.opex.inflationEnergy = d.opex.inflationEnergy;
  if(typeof out.opex.inflationMaint !== 'number') out.opex.inflationMaint = d.opex.inflationMaint;
  if(typeof out.opex.discountRate !== 'number') out.opex.discountRate = d.opex.discountRate;
  if(typeof out.opex.horizonYears !== 'number') out.opex.horizonYears = d.opex.horizonYears;

  // If any key set is empty, fallback to defaults
  if(Object.keys(out.typologies).length === 0) out.typologies = deepClone(d.typologies);
  if(Object.keys(out.reglementation).length === 0) out.reglementation = deepClone(d.reglementation);
  if(Object.keys(out.typeConstructif).length === 0) out.typeConstructif = deepClone(d.typeConstructif);
  if(Object.keys(out.contrainteSol).length === 0) out.contrainteSol = deepClone(d.contrainteSol);
  if(Object.keys(out.contrainteTerrain).length === 0) out.contrainteTerrain = deepClone(d.contrainteTerrain);
  if(Object.keys(out.chauffage).length === 0) out.chauffage = deepClone(d.chauffage);
  if(Object.keys(out.ventilation).length === 0) out.ventilation = deepClone(d.ventilation);
  if(Object.keys(out.lotsPresets).length === 0) out.lotsPresets = deepClone(d.lotsPresets);
  if(Object.keys(out.honoraires).length === 0) out.honoraires = deepClone(d.honoraires);

  return out;
}

function normalizeState(s, ref){
  const r = ref || REF || deepClone(DEFAULT_REF);
  const base = {
    typologie: Object.keys(r.typologies)[0] || "Logement collectif",
    surface: 1000,
    indiceGeo: 1.00,
    reglementation: Object.keys(r.reglementation)[0] || "RE2020",
    typeConstructif: Object.keys(r.typeConstructif)[0] || "Trad béton",
    contrainteSol: Object.keys(r.contrainteSol)[0] || "Standard",
    contrainteTerrain: Object.keys(r.contrainteTerrain)[0] || "Plat",
    chauffage: Object.keys(r.chauffage)[0] || "PAC air/eau",
    ventilation: Object.keys(r.ventilation)[0] || "VMC double flux",
    ajoutPerso: 0,
    opexHorizon: r.opex.horizonYears,
    opexEnergyBase: r.opex.energyEurPerM2[Object.keys(r.chauffage)[0]] || 10,
    opexMaintPct: r.opex.maintenancePctOfWorks * 100,
    inflationEnergy: r.opex.inflationEnergy * 100,
    inflationMaint: r.opex.inflationMaint * 100,
    discountRate: r.opex.discountRate * 100,
    lots: [],
    honos: {}
  };
  const out = Object.assign({}, base, isObject(s) ? s : {});

  if(!Array.isArray(out.lots)) out.lots = [];
  if(!isObject(out.honos)) out.honos = {};

  // Clamp numeric fields
  const numericKeys = ['surface','indiceGeo','ajoutPerso','opexHorizon','opexEnergyBase','opexMaintPct','inflationEnergy','inflationMaint','discountRate'];
  for(const k of numericKeys){
    const v = Number(out[k]);
    out[k] = (isFinite(v) ? v : base[k]);
  }
  return out;
}
const DEFAULT_REF = {
  typologies: {
    "Logement collectif": 1800,
    "Tertiaire": 1600,
    "Scolaire": 1500,
    "Maison individuelle": 1400,
    "Industriel": 1100
  },
  reglementation: { "RT2012": 0.10, "RE2020": 0.20 },
  typeConstructif: {
    "Trad béton": 0.00,
    "Préfa béton": 0.05,
    "Structure métal": 0.10,
    "Construction bois": 0.15,
    "Passif": 0.30
  },
  contrainteSol: {
    "Standard": 0.00,
    "Sol médiocre (fondations profondes)": 0.10,
    "Présence d'eau / drainage": 0.15
  },
  contrainteTerrain: {
    "Plat": 0.00,
    "Pente modérée": 0.05,
    "Pente forte": 0.10
  },
  chauffage: {
    "Électrique radiateurs": 50,
    "Chaudière gaz": 100,
    "Plancher chauffant hydraulique": 80,
    "PAC air/eau": 120,
    "Géothermie": 200,
    "Chaudière granulés": 150
  },
  ventilation: {
    "VMC simple flux": 20,
    "VMC double flux": 50,
    "Double flux thermodynamique": 80,
    "CTA simple (tertiaire)": 100,
    "CTA avec récupération": 150
  },
  lotsPresets: {
    "Logement collectif": {
      "Terrassements & fondations": 10,
      "Gros œuvre / Structure": 25,
      "Couverture-Étanchéité": 7,
      "Cloisons & doublages": 10,
      "Menuiseries extérieures": 10,
      "Plomberie": 6,
      "Électricité": 7,
      "CVC (chauffage-ventilation)": 12,
      "Sols & revêtements": 6,
      "Finitions": 7
    },
    "Tertiaire": {
      "Terrassements & fondations": 9,
      "Gros œuvre / Structure": 20,
      "Couverture-Étanchéité": 6,
      "Cloisons & doublages": 8,
      "Menuiseries extérieures": 8,
      "Plomberie": 6,
      "Électricité": 12,
      "CVC (chauffage-ventilation)": 18,
      "Équipements techniques": 8,
      "Finitions": 5
    }
  },
  honoraires: {
    "MOE Architecte": 0.10,
    "BE Structure": 0.015,
    "BE Fluides": 0.03,
    "BE Environnement": 0.0075,
    "AMO": 0.02,
    "Bureau de contrôle": 0.01,
    "Coordonnateur SPS": 0.008,
    "MOA interne": 0.03
  },
  opex: {
    energyEurPerM2: {
      "Électrique radiateurs": 12,
      "Chaudière gaz": 10,
      "Plancher chauffant hydraulique": 11,
      "PAC air/eau": 8,
      "Géothermie": 7,
      "Chaudière granulés": 9
    },
    ventilationEnergyAdj: {
      "VMC simple flux": 0,
      "VMC double flux": -1,
      "Double flux thermodynamique": -1.5,
      "CTA simple (tertiaire)": 2,
      "CTA avec récupération": 1
    },
    maintenancePctOfWorks: 0.01,   // 1% du coût travaux / an
    inflationEnergy: 0.02,         // 2%
    inflationMaint: 0.02,          // 2%
    discountRate: 0.03,            // 3%
    horizonYears: 30
  }
};

let REF = normalizeRef(loadRef() || deepClone(DEFAULT_REF));
let STATE = normalizeState(loadState(), REF) || {
  typologie: "Logement collectif",
  surface: 1000,
  indiceGeo: 1.00,
  reglementation: "RE2020",
  typeConstructif: "Trad béton",
  contrainteSol: "Standard",
  contrainteTerrain: "Plat",
  chauffage: "PAC air/eau",
  ventilation: "VMC double flux",
  ajoutPerso: 0,
  // opex params (will be pre-filled)
  opexHorizon: REF.opex.horizonYears,
  opexEnergyBase: REF.opex.energyEurPerM2["PAC air/eau"],
  opexMaintPct: REF.opex.maintenancePctOfWorks * 100, // UI en %
  inflationEnergy: REF.opex.inflationEnergy * 100,
  inflationMaint: REF.opex.inflationMaint * 100,
  discountRate: REF.opex.discountRate * 100,
  lots: [], // filled by preset on load
  honos: {} // filled from REF
};

// ======= Utilities =======
const formatCurrency = (n) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', {maximumFractionDigits:0});
const formatCurrency2 = (n) => (isFinite(n) ? n : 0).toLocaleString('fr-FR', {maximumFractionDigits:2});

function saveRef(){
  localStorage.setItem(STORAGE_KEYS.REF, JSON.stringify(REF));
}

function loadRef(){
  try{
    const s = localStorage.getItem(STORAGE_KEYS.REF);
    return s ? JSON.parse(s) : null;
  }catch(e){ console.warn("loadRef error", e); return null; }
}

function saveState(){
  localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(STATE));
}

function loadState(){
  try{
    const s = localStorage.getItem(STORAGE_KEYS.STATE);
    return s ? JSON.parse(s) : null;
  }catch(e){ console.warn("loadState error", e); return null; }
}

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

// ======= DOM binding =======
const dom = {
  typologie: document.getElementById('typologie'),
  surface: document.getElementById('surface'),
  indiceGeo: document.getElementById('indiceGeo'),
  reglementation: document.getElementById('reglementation'),
  typeConstructif: document.getElementById('typeConstructif'),
  contrainteSol: document.getElementById('contrainteSol'),
  contrainteTerrain: document.getElementById('contrainteTerrain'),
  chauffage: document.getElementById('chauffage'),
  ventilation: document.getElementById('ventilation'),
  ajoutPerso: document.getElementById('ajoutPerso'),
  // opex
  opexHorizon: document.getElementById('opexHorizon'),
  opexEnergyBase: document.getElementById('opexEnergyBase'),
  opexMaintPct: document.getElementById('opexMaintPct'),
  inflationEnergy: document.getElementById('inflationEnergy'),
  inflationMaint: document.getElementById('inflationMaint'),
  discountRate: document.getElementById('discountRate'),
  // tables & outputs
  lotsTableBody: document.querySelector('#lots-table tbody'),
  lotsTotal: document.getElementById('lots-total'),
  lotsSumAmount: document.getElementById('lots-sum-amount'),
  honosTableBody: document.querySelector('#honos-table tbody'),
  honosTotal: document.getElementById('honos-total'),
  baseAjustee: document.getElementById('base-ajustee'),
  coutTravaux: document.getElementById('cout-travaux'),
  coutHonos: document.getElementById('cout-honos'),
  coutOpex: document.getElementById('cout-opex'),
  coutGlobal: document.getElementById('cout-global'),
  coutGlobalM2: document.getElementById('cout-global-m2'),
  recapDetails: document.getElementById('recap-details'),
  // buttons
  btnCalc: document.getElementById('btn-calc'),
  btnSave: document.getElementById('btn-save'),
  btnLoad: document.getElementById('btn-load'),
  btnReset: document.getElementById('btn-reset'),
  btnExportJSON: document.getElementById('btn-export-json'),
  btnExportCSV: document.getElementById('btn-export-csv'),
  importJSON: document.getElementById('import-json'),
  btnPresetLots: document.getElementById('btn-preset-lots'),
  btnAddLot: document.getElementById('btn-add-lot'),
  // référentiel UI
  refTabs: document.getElementById('ref-tabs'),
  tabPanes: {
    typologies: document.getElementById('t-typologies'),
    surcouts: document.getElementById('t-surcouts'),
    systems: document.getElementById('t-systems'),
    honos: document.getElementById('t-honos'),
    presets: document.getElementById('t-presets')
  },
  btnSaveRef: document.getElementById('btn-save-ref'),
  btnResetRef: document.getElementById('btn-reset-ref')
};

function el(tag, attrs={}, ...children){
  const e = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k === 'class') e.className = v;
    else if(k === 'html') e.innerHTML = v;
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for(const c of children){
    if(typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if(c) e.appendChild(c);
  }
  return e;
}

// ======= Initialization =======
function populateSelect(sel, options, value){
  sel.innerHTML = "";
  Object.keys(options).forEach(k => {
    const opt = el('option', {value:k}, k);
    sel.appendChild(opt);
  });
  if(value && options[value] !== undefined) sel.value = value;
}

function initCoreInputs(){
  populateSelect(dom.typologie, REF.typologies, STATE.typologie);
  populateSelect(dom.reglementation, REF.reglementation, STATE.reglementation);
  populateSelect(dom.typeConstructif, REF.typeConstructif, STATE.typeConstructif);
  populateSelect(dom.contrainteSol, REF.contrainteSol, STATE.contrainteSol);
  populateSelect(dom.contrainteTerrain, REF.contrainteTerrain, STATE.contrainteTerrain);
  populateSelect(dom.chauffage, REF.chauffage, STATE.chauffage);
  populateSelect(dom.ventilation, REF.ventilation, STATE.ventilation);

  dom.surface.value = STATE.surface;
  dom.indiceGeo.value = STATE.indiceGeo.toFixed(2);
  dom.ajoutPerso.value = STATE.ajoutPerso;

  // OPEX defaults according to systems
  const opexBase = REF.opex.energyEurPerM2[STATE.chauffage] ?? 10;
  const ventAdj = REF.opex.ventilationEnergyAdj[STATE.ventilation] ?? 0;
  dom.opexEnergyBase.value = (STATE.opexEnergyBase ?? (opexBase + ventAdj)).toFixed(1);
  dom.opexMaintPct.value = (STATE.opexMaintPct ?? REF.opex.maintenancePctOfWorks*100);
  dom.opexHorizon.value = STATE.opexHorizon ?? REF.opex.horizonYears;
  dom.inflationEnergy.value = (STATE.inflationEnergy ?? REF.opex.inflationEnergy*100);
  dom.inflationMaint.value = (STATE.inflationMaint ?? REF.opex.inflationMaint*100);
  dom.discountRate.value = (STATE.discountRate ?? REF.opex.discountRate*100);
}

function ensureLotsInitialized(){
  if(!STATE.lots || STATE.lots.length === 0){
    const preset = REF.lotsPresets[STATE.typologie] || REF.lotsPresets["Logement collectif"];
    STATE.lots = Object.entries(preset).map(([name,ratio])=>({name, ratio:Number(ratio)}));
  }
}

function ensureHonosInitialized(){
  if(!STATE.honos || Object.keys(STATE.honos).length === 0){
    STATE.honos = deepClone(REF.honoraires);
  }else{
    // ensure all keys exist
    for(const k of Object.keys(REF.honoraires)){
      if(STATE.honos[k] === undefined) STATE.honos[k] = REF.honoraires[k];
    }
  }
}

function renderLotsTable(){
  dom.lotsTableBody.innerHTML = "";
  STATE.lots.forEach((lot, idx)=>{
    const tr = el('tr', {},
      el('td', {}, el('input', {type:'text', value:lot.name, class:'fld name-input', oninput: (e)=>{ lot.name = e.target.value; calcAndRender(); }})),
      el('td', {}, el('input', {type:'number', min:'0', step:'0.1', value:lot.ratio, class:'fld', oninput:(e)=>{ lot.ratio = Number(e.target.value||0); calcAndRender(); }})),
      el('td', {class:'right'}, el('span', {id:`lot-amount-${idx}`}, '0'), " €"),
      el('td', {class:'right'}, el('button', {class:'icon-btn', title:'Supprimer', onclick:()=>{ STATE.lots.splice(idx,1); calcAndRender(); }}, "🗑️"))
    );
    dom.lotsTableBody.appendChild(tr);
  });
}

function renderHonosTable(worksCost){
  dom.honosTableBody.innerHTML = "";
  let total = 0;
  for(const [name,pct] of Object.entries(STATE.honos)){
    const pctInput = el('input', {type:'number', step:'0.1', class:'fld', value:(pct*100).toFixed(2),
      oninput:(e)=>{ STATE.honos[name] = Number(e.target.value||0)/100; calcAndRender(); }
    });
    const amount = (pct * worksCost);
    total += amount;
    const tr = el('tr', {},
      el('td', {}, name),
      el('td', {}, pctInput),
      el('td', {class:'right'}, €(amount), " €")
    );
    dom.honosTableBody.appendChild(tr);
  }
  dom.honosTotal.textContent = €(total);
  return total;
}

// ======= Calculations =======
function computeBaseAjustee(){
  const typ = STATE.typologie;
  const base = Number(REF.typologies[typ] ?? 0);
  const indice = Number(STATE.indiceGeo ?? 1);
  const surcouts =
    (REF.reglementation[STATE.reglementation] ?? 0) +
    (REF.typeConstructif[STATE.typeConstructif] ?? 0) +
    (REF.contrainteSol[STATE.contrainteSol] ?? 0) +
    (REF.contrainteTerrain[STATE.contrainteTerrain] ?? 0);
  const additions =
    (REF.chauffage[STATE.chauffage] ?? 0) +
    (REF.ventilation[STATE.ventilation] ?? 0) +
    (Number(STATE.ajoutPerso) || 0);

  const baseAjustee = base * indice * (1 + surcouts) + additions;
  const rec = {
    base, indice, surcouts, additions
  };
  return { baseAjustee, rec };
}

function computeWorksCost(){
  const surface = Number(STATE.surface || 0);
  const { baseAjustee } = computeBaseAjustee();
  return surface * baseAjustee;
}

function computeLots(worksCost){
  const amounts = STATE.lots.map(l => worksCost * (Number(l.ratio || 0)/100));
  const totalRatio = STATE.lots.reduce((a,b)=> a + Number(b.ratio||0), 0);
  const sumAmount = amounts.reduce((a,b)=> a + b, 0);
  return { amounts, totalRatio, sumAmount };
}

function computeHonos(worksCost){
  let total = 0;
  for(const pct of Object.values(STATE.honos)){
    total += (pct * worksCost);
  }
  return total;
}

function computeOpexPV(worksCost){
  const surface = Number(STATE.surface || 0);
  const energyM2 = Number(STATE.opexEnergyBase || 0);
  const maintPct = Number(STATE.opexMaintPct || 0)/100;
  const inflE = Number(STATE.inflationEnergy || 0)/100;
  const inflM = Number(STATE.inflationMaint || 0)/100;
  const r = Number(STATE.discountRate || 0)/100;
  const N = Math.max(1, Number(STATE.opexHorizon || 1));

  const E0 = surface * energyM2;         // €/an année 1
  const M0 = worksCost * maintPct;       // €/an année 1

  let pv = 0;
  for(let t=1; t<=N; t++){
    const Et = E0 * Math.pow(1+inflE, t-1);
    const Mt = M0 * Math.pow(1+inflM, t-1);
    const disc = Math.pow(1+r, t);
    pv += (Et + Mt)/disc;
  }
  return pv;
}

// ======= Rendering =======
function calcAndRender(){
  // sync state from DOM
  STATE.typologie = dom.typologie.value;
  STATE.surface = Number(dom.surface.value||0);
  STATE.indiceGeo = Number(dom.indiceGeo.value||1);
  STATE.reglementation = dom.reglementation.value;
  STATE.typeConstructif = dom.typeConstructif.value;
  STATE.contrainteSol = dom.contrainteSol.value;
  STATE.contrainteTerrain = dom.contrainteTerrain.value;
  STATE.chauffage = dom.chauffage.value;
  STATE.ventilation = dom.ventilation.value;
  STATE.ajoutPerso = Number(dom.ajoutPerso.value||0);

  STATE.opexHorizon = Number(dom.opexHorizon.value||30);
  STATE.opexEnergyBase = Number(dom.opexEnergyBase.value||0);
  STATE.opexMaintPct = Number(dom.opexMaintPct.value||1);
  STATE.inflationEnergy = Number(dom.inflationEnergy.value||2);
  STATE.inflationMaint = Number(dom.inflationMaint.value||2);
  STATE.discountRate = Number(dom.discountRate.value||3);

  const { baseAjustee, rec } = computeBaseAjustee();
  dom.baseAjustee.textContent = €2(baseAjustee);

  const worksCost = computeWorksCost();
  dom.coutTravaux.textContent = €(worksCost);
  dom.recapDetails.textContent = `base ${€(rec.base)} × indice ${rec.indice.toFixed(2)} × (1 + ${(rec.surcouts*100).toFixed(1)} %) + additions ${€(rec.additions)} €/m²`;

  // lots
  const { amounts, totalRatio, sumAmount } = computeLots(worksCost);
  STATE.lots.forEach((l, i)=>{
    const span = document.getElementById(`lot-amount-${i}`);
    if(span) span.textContent = €(amounts[i]);
  });
  dom.lotsTotal.textContent = totalRatio.toFixed(1) + "%";
  dom.lotsTotal.classList.toggle('ok', Math.abs(totalRatio-100) < 0.01);
  dom.lotsTotal.classList.toggle('ko', Math.abs(totalRatio-100) >= 0.01);
  dom.lotsSumAmount.textContent = €(sumAmount);

  // honos
  const honosTotal = renderHonosTable(worksCost);
  dom.coutHonos.textContent = €(honosTotal);

  // opex
  // Auto-suggestion for energy base according to selected systems (only if user hasn't touched the field after change of systems)
  const suggestEnergyBase = (REF.opex.energyEurPerM2[STATE.chauffage] ?? 10) + (REF.opex.ventilationEnergyAdj[STATE.ventilation] ?? 0);
  // do not overwrite user value silently. Provide tooltip-ish info by updating placeholder
  dom.opexEnergyBase.placeholder = suggestEnergyBase.toFixed(1);

  const opexPV = computeOpexPV(worksCost);
  dom.coutOpex.textContent = €(opexPV);

  const global = worksCost + honosTotal + opexPV;
  dom.coutGlobal.textContent = €(global);
  const m2 = STATE.surface>0 ? global/STATE.surface : 0;
  dom.coutGlobalM2.textContent = €2(m2);
}

function attachCoreListeners(){
  const inputs = [
    dom.typologie, dom.surface, dom.indiceGeo, dom.reglementation, dom.typeConstructif,
    dom.contrainteSol, dom.contrainteTerrain, dom.chauffage, dom.ventilation, dom.ajoutPerso,
    dom.opexHorizon, dom.opexEnergyBase, dom.opexMaintPct, dom.inflationEnergy, dom.inflationMaint, dom.discountRate
  ];
  inputs.forEach(i => {
    i.addEventListener('input', calcAndRender);
    if (i.tagName === 'SELECT') {
      i.addEventListener('change', calcAndRender);
    }
  });
  dom.btnCalc.addEventListener('click', calcAndRender);

  dom.chauffage.addEventListener('change', ()=>{
    // suggest OPEX base according to system (placeholder already updates in calc)
    calcAndRender();
  });
  dom.ventilation.addEventListener('change', ()=>{
    calcAndRender();
  });

  dom.btnPresetLots.addEventListener('click', ()=>{
    const preset = REF.lotsPresets[STATE.typologie];
    if(preset){
      STATE.lots = Object.entries(preset).map(([name,ratio])=>({name, ratio:Number(ratio)}));
      renderLotsTable();
      calcAndRender();
    } else {
      alert("Aucun preset pour la typologie sélectionnée.");
    }
  });
  dom.btnAddLot.addEventListener('click', ()=>{
    STATE.lots.push({name:"Nouveau lot", ratio:0});
    renderLotsTable();
    calcAndRender();
  });

  dom.btnSave.addEventListener('click', ()=>{
    saveState();
    alert("État du projet sauvegardé dans le navigateur.");
  });
  dom.btnLoad.addEventListener('click', ()=>{
    const s = loadState();
    if(!s){ alert("Aucun état sauvegardé trouvé."); return; }
    STATE = normalizeState(s, REF);
    initCoreInputs();
    ensureLotsInitialized();
    ensureHonosInitialized();
    renderLotsTable();
    calcAndRender();
  });
  dom.btnReset.addEventListener('click', ()=>{
    if(confirm("Réinitialiser l’ensemble des données (projet + référentiel) ?")){
      localStorage.removeItem(STORAGE_KEYS.STATE);
      localStorage.removeItem(STORAGE_KEYS.REF);
      REF = deepClone(DEFAULT_REF);
      STATE = {
        typologie: "Logement collectif",
        surface: 1000,
        indiceGeo: 1.00,
        reglementation: "RE2020",
        typeConstructif: "Trad béton",
        contrainteSol: "Standard",
        contrainteTerrain: "Plat",
        chauffage: "PAC air/eau",
        ventilation: "VMC double flux",
        ajoutPerso: 0,
        opexHorizon: REF.opex.horizonYears,
        opexEnergyBase: REF.opex.energyEurPerM2["PAC air/eau"],
        opexMaintPct: REF.opex.maintenancePctOfWorks * 100,
        inflationEnergy: REF.opex.inflationEnergy * 100,
        inflationMaint: REF.opex.inflationMaint * 100,
        discountRate: REF.opex.discountRate * 100,
        lots: [],
        honos: {}
      };
      initCoreInputs();
      ensureLotsInitialized();
      ensureHonosInitialized();
      renderLotsTable();
      calcAndRender();
      renderRefPanes();
    }
  });

  dom.btnExportJSON.addEventListener('click', ()=>{
    const payload = buildExportPayload();
    downloadFile("estimation.json", JSON.stringify(payload, null, 2));
  });
  dom.btnExportCSV.addEventListener('click', ()=>{
    const csv = buildCSV();
    downloadFile("estimation.csv", csv);
  });
  dom.importJSON.addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(data.REF) REF = normalizeRef(data.REF);
        if(data.STATE) STATE = normalizeState(data.STATE, REF);
        initCoreInputs();
        ensureLotsInitialized();
        ensureHonosInitialized();
        renderLotsTable();
        calcAndRender();
        renderRefPanes();
        alert("Données importées.");
      }catch(err){
        alert("JSON invalide : " + err.message);
      }
    };
    reader.readAsText(f);
  });
}

// ======= Export helpers =======
function buildExportPayload(){
  const { baseAjustee, rec } = computeBaseAjustee();
  const worksCost = computeWorksCost();
  const honosTotal = computeHonos(worksCost);
  const opexPV = computeOpexPV(worksCost);
  const global = worksCost + honosTotal + opexPV;

  return {
    meta: { generatedAt: new Date().toISOString() },
    REF,
    STATE,
    RESULTS: {
      baseAjustee, details: rec, worksCost, honosTotal, opexPV, global,
      globalPerM2: (STATE.surface>0 ? global/STATE.surface : 0),
      lotsBreakdown: STATE.lots.map(l => ({ name:l.name, ratio:l.ratio, amount: worksCost * l.ratio/100 }))
    }
  };
}

function buildCSV(){
  const p = buildExportPayload();
  const lines = [];
  lines.push("Clé;Valeur");
  lines.push(`Typologie;${STATE.typologie}`);
  lines.push(`Surface (m²);${STATE.surface}`);
  lines.push(`Indice géographique;${STATE.indiceGeo}`);
  lines.push(`Réglementation;${STATE.reglementation}`);
  lines.push(`Type constructif;${STATE.typeConstructif}`);
  lines.push(`Contrainte sol;${STATE.contrainteSol}`);
  lines.push(`Contrainte terrain;${STATE.contrainteTerrain}`);
  lines.push(`Chauffage;${STATE.chauffage}`);
  lines.push(`Ventilation;${STATE.ventilation}`);
  lines.push(`Ajout personnalisé (€/m²);${STATE.ajoutPerso}`);
  lines.push(`Base ajustée (€/m²);${p.RESULTS.baseAjustee}`);
  lines.push(`Coût travaux (€);${p.RESULTS.worksCost}`);
  lines.push(`Total honoraires (€);${p.RESULTS.honosTotal}`);
  lines.push(`OPEX actualisées (€);${p.RESULTS.opexPV}`);
  lines.push(`Coût global (€);${p.RESULTS.global}`);
  lines.push(`Coût global (€/m²);${p.RESULTS.globalPerM2}`);
  lines.push("");
  lines.push("Lot;Ratio (%);Montant (€)");
  p.RESULTS.lotsBreakdown.forEach(l => {
    lines.push(`${l.name};${l.ratio};${Math.round(l.amount)}`);
  });
  return lines.join("\n");
}

function downloadFile(filename, content){
  const blob = new Blob([content], {type: filename.endsWith(".json") ? "application/json" : "text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ======= Référentiel UI =======
function renderRefPanes(){
  // Tabs logic
  dom.refTabs.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      dom.refTabs.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    };
  });

  // Pane Typologies
  dom.tabPanes.typologies.innerHTML = "";
  const t1 = el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, "Typologie"), el('th', {}, "Base (€/m²)"))),
    el('tbody', {}, ...Object.entries(REF.typologies).map(([name,val])=> el('tr', {},
      el('td', {}, name),
      el('td', {}, el('input', {type:'number', step:'1', class:'fld', value:val,
        oninput:(e)=>{ REF.typologies[name]=Number(e.target.value||0); calcAndRender(); }
      }))
    )))
  );
  dom.tabPanes.typologies.appendChild(t1);

  // Pane Surcoûts
  dom.tabPanes.surcouts.innerHTML = "";
  const makePctTable = (title, obj) => el('div', {class:'mt'}, 
    el('div', {class:'badge'}, title),
    el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, "Paramètre"), el('th', {}, "Surcoût (%)"))),
      el('tbody', {}, ...Object.entries(obj).map(([k,v])=> el('tr', {},
        el('td', {}, k),
        el('td', {}, el('input', {type:'number', step:'0.1', class:'fld', value:(v*100).toFixed(2),
          oninput:(e)=>{ obj[k]=Number(e.target.value||0)/100; calcAndRender(); }
        }))
      )))
    )
  );
  dom.tabPanes.surcouts.appendChild(makePctTable("Réglementation", REF.reglementation));
  dom.tabPanes.surcouts.appendChild(makePctTable("Type constructif", REF.typeConstructif));
  dom.tabPanes.surcouts.appendChild(makePctTable("Contrainte sol", REF.contrainteSol));
  dom.tabPanes.surcouts.appendChild(makePctTable("Contrainte terrain", REF.contrainteTerrain));

  // Pane Systems
  dom.tabPanes.systems.innerHTML = "";
  const makeEurM2Table = (title, obj) => el('div', {class:'mt'},
    el('div', {class:'badge'}, title),
    el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, "Système"), el('th', {}, "Ajout (€/m²)"))),
      el('tbody', {}, ...Object.entries(obj).map(([k,v])=> el('tr', {},
        el('td', {}, k),
        el('td', {}, el('input', {type:'number', step:'1', class:'fld', value:v,
          oninput:(e)=>{ obj[k]=Number(e.target.value||0); calcAndRender(); }
        }))
      )))
    )
  );
  dom.tabPanes.systems.appendChild(makeEurM2Table("Chauffage (CAPEX additions)", REF.chauffage));
  dom.tabPanes.systems.appendChild(makeEurM2Table("Ventilation / CTA (CAPEX additions)", REF.ventilation));

  // Pane Honoraires
  dom.tabPanes.honos.innerHTML = "";
  const th = el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, "Intervenant"), el('th', {}, "% du coût travaux"))),
    el('tbody', {}, ...Object.entries(REF.honoraires).map(([k,v])=> el('tr', {},
      el('td', {}, k),
      el('td', {}, el('input', {type:'number', step:'0.1', class:'fld', value:(v*100).toFixed(2),
        oninput:(e)=>{ REF.honoraires[k]=Number(e.target.value||0)/100; ensureHonosInitialized(); calcAndRender(); }
      }))
    )))
  );
  dom.tabPanes.honos.appendChild(th);

  // Pane Presets
  dom.tabPanes.presets.innerHTML = "";
  for(const [typ,preset] of Object.entries(REF.lotsPresets)){
    const table = el('table', {class:'mt'});
    table.appendChild(el('thead', {}, el('tr', {}, el('th', {}, typ), el('th', {}, "Ratio (%)"))));
    const tb = el('tbody', {});
    for(const [lot,ratio] of Object.entries(preset)){
      tb.appendChild(el('tr', {},
        el('td', {}, lot),
        el('td', {}, el('input', {type:'number', step:'0.1', class:'fld', value:ratio,
          oninput:(e)=>{ REF.lotsPresets[typ][lot]=Number(e.target.value||0); if(STATE.typologie===typ) calcAndRender(); }
        }))
      ));
    }
    table.appendChild(tb);
    // control sum
    const sum = Object.values(preset).reduce((a,b)=>a+Number(b||0),0);
    const pill = el('span', {class:'pill ' + (Math.abs(sum-100)<0.01?'ok':'ko')}, sum.toFixed(1) + "%");
    const ctrl = el('div', {class:'mt-s'}, el('span', {class:'hint'}, "Somme des ratios : "), pill);
    dom.tabPanes.presets.appendChild(table);
    dom.tabPanes.presets.appendChild(ctrl);
  }
}

dom.btnSaveRef.addEventListener('click', ()=>{
  saveRef();
  alert("Référentiel sauvegardé.");
});
dom.btnResetRef.addEventListener('click', ()=>{
  if(confirm("Réinitialiser le référentiel aux valeurs par défaut ?")){
    REF = deepClone(DEFAULT_REF);
    saveRef();
    renderRefPanes();
    initCoreInputs();
    ensureLotsInitialized();
    ensureHonosInitialized();
    renderLotsTable();
    calcAndRender();
  }
});

// ======= App bootstrap =======
function bootstrap(){
  initCoreInputs();
  ensureLotsInitialized();
  ensureHonosInitialized();
  renderLotsTable();
  renderRefPanes();
  attachCoreListeners();
  calcAndRender();
}

document.addEventListener('DOMContentLoaded', bootstrap);
