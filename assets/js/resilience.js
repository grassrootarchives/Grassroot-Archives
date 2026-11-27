// The three spatio-temporal levels of resilience strategies recorded for a story.
export const LEVELS = [
  { key: 'home', n: 1, name: 'Home', hint: 'The household: what the family does in and around the house.' },
  { key: 'neighbourhood', n: 2, name: 'Neighbourhood', hint: 'The neighbourhood, including the village: what neighbours and the community do together.' },
  { key: 'region', n: 3, name: 'Wider region', hint: 'The wider region: taluka, district, basin or state; what people do beyond the village.' }
];
export const hasResilience = r => LEVELS.some(l => r?.[l.key]?.text?.trim() || r?.[l.key]?.when?.trim());
