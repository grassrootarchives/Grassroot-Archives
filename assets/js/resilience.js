// Resilience strategies: numbered, coloured by spatial level, and optionally linked to a step in a hazard chain.
export const LEVELS = [
  { key: 'home', n: 1, name: 'Home', color: '#C0504A', hint: 'The household: what the family does in and around the house.' },
  { key: 'neighbourhood', n: 2, name: 'Neighbourhood', color: '#3F7A55', hint: 'The neighbourhood, including the village: what neighbours and the community do together.' },
  { key: 'region', n: 3, name: 'Wider region', color: '#4B5AA0', hint: 'The wider region: taluka, district, basin or state; what people do beyond the village.' }
];
export const levelOf = key => LEVELS.find(l => l.key === key) || LEVELS[0];

// Stories saved before strategies were numbered kept one text per level; read those as one strategy per level.
export function strategiesOf(r) {
  if (Array.isArray(r?.strategies)) return r.strategies;
  return LEVELS.filter(l => r?.[l.key]?.text?.trim() || r?.[l.key]?.when?.trim())
    .map(l => ({ level: l.key, when: r[l.key].when || '', text: r[l.key].text || '', hazard: null, link: null }));
}
export const hasResilience = r => strategiesOf(r).some(s => s.text?.trim() || s.when?.trim());
