// Plain-language explanations of river sections (zones), used by the chips under each valley map.
// A valley can give a zone its own description in the admin; otherwise one is chosen from the zone's name.
const TEXTS = [
  [/head|source|upper|ghat|hill/i, {
    what: 'Where the river begins: steep slopes, often forested, with the heaviest rain of the monsoon. Streams are small and fast, and springs and shallow wells feed the villages.',
    look: 'Little water can be held back on steep ground, so the dry months can be hard even here. Landslides, cut-off paths and soil washing away are the risks of the rains.' }],
  [/piedmont|mid|middle|foothill/i, {
    what: 'The river leaves the hills, widens and slows. Towns, dams, weirs and canals cluster here, and water is drawn off for farms, industry and cities.',
    look: 'What is taken, stored and released in this stretch shapes everything downstream: watch for reservoirs, canal head-works, sand mining and fast-growing settlements.' }],
  [/flood\s*plain|floodplain/i, {
    what: 'Flat land beside the river, built from its own silt: fertile and well watered, and the first to flood when the river overtops its banks.',
    look: 'Fields and homes close to the banks, embankments and causeways, and how often families have had to move or rebuild.' }],
  [/command/i, {
    what: 'Land served by a canal system from a dam upstream. Farming here depends on canal releases, and the farms at the far end of a canal often get water last.',
    look: 'Who gets water, when, and how far each household is from the canal; borewells that fill the gaps; crops that change with the releases.' }],
  [/tail|lower|delta|mouth|end/i, {
    what: 'The last stretch of the river, at the end of canals and pipelines. Flow depends on what upstream users leave; the land is flatter and often drier.',
    look: 'Drought tends to last longest here, and floods spread widest when they come. Tankers, long walks for water and seasonal migration are common signs of distress.' }]
];

export function zoneText(zone) {
  const own = String(zone?.description || '').trim();
  const hit = TEXTS.find(([re]) => re.test(zone?.name || ''))?.[1];
  return { what: own || hit?.what || 'A stretch of the river, set by the archive team for this valley.', look: own ? '' : (hit?.look || '') };
}
