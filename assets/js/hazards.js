// Hazard chains: the sequence of events through which a hazard turns into distress.
// Each link has a stable key (stored with strategies), so wording can change without breaking old stories.
export const HAZARDS = {
  drought: {
    name: 'Drought', note: 'Slow to start; often lasts several years.', colors: ['#F6E9CC', '#C08442'],
    links: [
      { key: 'rain', short: 'Rain fails', text: 'Rain fails or comes late; sowing fails and the kharif crop is lost.' },
      { key: 'groundwater', short: 'Water table drops', text: 'Open wells and shallow borewells dry; rivers and weir backwaters shrink.' },
      { key: 'drinking', short: 'Drinking water short', text: 'Tankers, irregular and unequal supply, poor water quality, hours spent fetching water.' },
      { key: 'fodder', short: 'Fodder runs out', text: 'Livestock sold cheaply or sent to cattle camps; milk income lost.' },
      { key: 'income', short: 'Income and debt', text: 'Crop, dairy and labour income stop; families borrow and sell assets.' },
      { key: 'migration', short: 'People leave', text: 'Seasonal migration for cane cutting and construction; children leave school.' },
      { key: 'longtail', short: 'The long tail', text: 'Chronic debt, land sold or leased out, farmer distress, early marriage.' }
    ]
  },
  flood: {
    name: 'Flood', note: 'Fast onset; a long aftermath.', colors: ['#DDEBF6', '#3D78A8'],
    links: [
      { key: 'trigger', short: 'The trigger', text: 'Extreme rain, a sudden dam release, or blocked drains and building on streams.' },
      { key: 'inundation', short: 'Inundation', text: 'People displaced, homes damaged; grain, seed, tools and documents lost; livestock drown.' },
      { key: 'fields', short: 'Fields', text: 'Standing crop lost; topsoil stripped or buried under sand and silt; wells contaminated.' },
      { key: 'health', short: 'Health', text: 'Waterborne disease and leptospirosis, snakebites, clinics closed.' },
      { key: 'disruption', short: 'Disruption', text: 'Roads, power and schools cut; markets close; daily-wage income stops.' },
      { key: 'aftermath', short: 'Aftermath', text: 'Relief tied to lost paperwork, debt to rebuild, relocation or giving up riverbank land.' }
    ]
  }
};

export function findLink(hazard, key) {
  const h = HAZARDS[hazard]; if (!h) return null;
  const i = h.links.findIndex(l => l.key === key);
  return i < 0 ? null : { hazard: h, n: i + 1, ...h.links[i] };
}
export const linkLabel = (hazard, key) => { const l = findLink(hazard, key); return l ? `${l.hazard.name} · ${l.n} ${l.short}` : ''; };
