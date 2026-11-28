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
  },
  rainfall: {
    name: 'Extreme rainfall', note: 'Weeks of very heavy rain, even where no flood follows.', colors: ['#DCEEEA', '#2F7F78'],
    links: [
      { key: 'downpour', short: 'Days of heavy rain', text: 'Weeks of intense monsoon rain, cloudbursts and strong wind; nothing gets the chance to dry.' },
      { key: 'damp', short: 'Water gets in', text: 'Roofs leak, walls seep, floors and verandahs stay wet; mud and thatch homes weaken.' },
      { key: 'cold', short: 'Cold and wet', text: 'Wet clothes and bedding, chill and wind; people and livestock struggle to stay warm.' },
      { key: 'work', short: 'Work stops', text: 'Farm work, grazing and daily-wage work pause; income stops for days at a time.' },
      { key: 'cutoff', short: 'Cut off', text: 'Landslides, washed-out paths and swollen streams cut hamlets off from schools, clinics and markets.' },
      { key: 'spoil', short: 'Stores spoil', text: 'Grain, seed and fodder rot or turn mouldy; firewood stays wet.' },
      { key: 'illness', short: 'Illness', text: 'Fevers, colds and chest infections; waterborne disease, malaria and dengue; snakebites.' }
    ]
  }
};

export function findLink(hazard, key) {
  const h = HAZARDS[hazard]; if (!h) return null;
  const i = h.links.findIndex(l => l.key === key);
  return i < 0 ? null : { hazard: h, n: i + 1, ...h.links[i] };
}
export const linkLabel = (hazard, key) => { const l = findLink(hazard, key); return l ? `${l.hazard.name} · ${l.n} ${l.short}` : ''; };
