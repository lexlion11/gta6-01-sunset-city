// Sunset City — game constants. One place for every tuning number and palette entry.

export const WORLD = 4000; // the world is WORLD x WORLD pixels
export const BLOCK = 400; // city block size; road centerlines sit on multiples of BLOCK
export const ROAD = 72; // road width
export const LANE = ROAD / 4; // lane offset right of a road centerline
export const WATER_X = 3560; // the ocean starts at this x (east edge)
export const BEACH_X = 3450; // sandy strip before the water

// Fixed places on the map.
export const PLACES = {
  hospital: { x: 620, y: 620 },
  policeStation: { x: 2020, y: 620 },
  garage: { x: 3220, y: 2780 }, // mission 1 delivery
  docks: { x: 3520, y: 2400 }, // mission 5 delivery (pier)
  playerStart: { x: 820, y: 2000 },
};

export const COLORS = {
  ground: '#e6d6b0',
  beach: '#eed9a4',
  water: '#2f8fb8',
  waterDeep: '#256c8c',
  wave: 'rgba(255,255,255,0.35)',
  road: '#4b4b54',
  roadEdge: '#3c3c44',
  roadLine: '#d9c97a',
  sidewalk: '#c8bd9e',
  sidewalkEdge: '#b3a888',
  park: '#82b06c',
  parkDark: '#5f8c4c',
  tree: '#3f7a38',
  treeLight: '#5c9a4c',
  trunk: '#6b4a2f',
  shadow: 'rgba(50,36,22,0.28)',
  buildingShadow: 'rgba(50,36,22,0.35)',
  pier: '#8a6a44',
  pierDark: '#6e5234',
};

// Downtown blocks get tall towers; the outskirts stay low.
export const DOWNTOWN = { i0: 3, i1: 5, j0: 3, j1: 5 };

export const PLAYER = {
  speed: 215,
  radius: 11,
  maxHealth: 100,
  punchRange: 36,
  punchDamage: 16,
  hurtCooldown: 0.5,
};

export const VEHICLE_TYPES = {
  sedan: {
    w: 30, l: 56, maxSpeed: 270, reverseSpeed: 90, accel: 230, turn: 2.5,
    health: 100, grip: 0.985, colors: ['#c94f4f', '#4f7fc9', '#c9c94f', '#8a8a96', '#5c8a5c'],
  },
  sports: {
    w: 28, l: 52, maxSpeed: 390, reverseSpeed: 110, accel: 350, turn: 3.1,
    health: 80, grip: 0.99, colors: ['#d94f2f', '#2fc4c4', '#e0c060', '#b03fd0'],
  },
  truck: {
    w: 38, l: 78, maxSpeed: 195, reverseSpeed: 70, accel: 150, turn: 1.75,
    health: 190, grip: 0.975, colors: ['#8a6a4a', '#5a5a6a', '#9a9a9a', '#7a5a3a'],
  },
  police: {
    w: 30, l: 56, maxSpeed: 310, reverseSpeed: 100, accel: 290, turn: 2.7,
    health: 130, grip: 0.985, colors: ['#dfe6ee'],
  },
};

export const BULLET = { speed: 950, life: 0.85, damage: 22, radius: 3.5 };
export const COP_BULLET = { speed: 700, life: 0.9, damage: 11, radius: 3.5 };

export const WANTED = {
  max: 5,
  decayDelay: 16, // seconds without a crime before the heat starts cooling
  decayRate: 0.11, // stars per second of decay
  carjack: 1,
  pedHit: 0.6,
  pedKill: 1,
  copKill: 1.5,
  wreckCopCar: 1,
};

export const POLICE = {
  carStars: 2, // police cars appear from this many stars
  copStars: 3, // police on foot appear from this many stars
  maxCars: 4,
  maxCops: 4,
  copHealth: 60,
  copSpeed: 135,
  copRange: 430,
  copFireInterval: 1.15,
  bustRange: 34,
  spawnMinDist: 620,
  spawnMaxDist: 1050,
  chaseDespawn: 1500,
};

export const TRAFFIC = { count: 15, cruise: 0.55, brakeDist: 58, overtakeNudge: 0.6 };
export const PEDS = { count: 22, speed: 62, fleeSpeed: 165, fleeRadius: 340, fleeTime: 4.5 };

export const MISSIONS = [
  {
    id: 1, title: 'First Score', giver: 'Mara', reward: 500,
    intro: "Riley. Mara here. There's a beauty parked two blocks from my place. Bring it to my garage, and there's five hundred in it for you.",
    stages: [
      { type: 'steal', text: 'Steal the marked sports car', vehicle: 'sports', vx: 1200, vy: 1600, vcolor: '#d94f2f' },
      { type: 'deliver', text: 'Deliver the car to the garage', x: 3220, y: 2780 },
    ],
  },
  {
    id: 2, title: 'Package Run', giver: 'Dex', reward: 800,
    intro: "Need a courier I can trust. Four packages, four drops. No questions, cash on completion. You in?",
    stages: [
      { type: 'collect', text: 'Collect the package at the docks', x: 3520, y: 1400 },
      { type: 'deliverpkg', text: 'Drop it at the lockup in Little Cove', x: 820, y: 1200 },
      { type: 'collect', text: 'Collect the package at the park', x: 1400, y: 3000 },
      { type: 'deliverpkg', text: 'Drop it at the warehouse downtown', x: 1600, y: 1600 },
    ],
  },
  {
    id: 3, title: 'Shake Down', giver: 'Mara', reward: 1200,
    intro: "A rival crew's pushing product on my block. Their boy Vito works the alley near the park. Go have a word with him. Loudly.",
    stages: [
      { type: 'goto', text: 'Meet Mara at the alley near the park', x: 1500, y: 2700 },
      { type: 'kill', text: 'Deal with Vito', x: 1560, y: 2620 },
    ],
  },
  {
    id: 4, title: 'Getaway', giver: 'Dex', reward: 2000,
    intro: "Cops are all over my last job. I need them looking the other way for sixty seconds while my crew moves. Be the distraction, Riley.",
    stages: [
      { type: 'survive', text: 'Survive a 3-star wanted level for 60s', wanted: 3, time: 60 },
    ],
  },
  {
    id: 5, title: 'Big Score', giver: 'Mara', reward: 5000,
    intro: "The big one. Dex's crew left the keys in a custom rig by the pier. Take it, lose whatever heat finds you, and bring it to my dock. Five grand, Riley. Retirement money.",
    stages: [
      { type: 'steal', text: 'Steal the custom rig', vehicle: 'truck', vx: 3300, vy: 2100, vcolor: '#b03fd0' },
      { type: 'survive', text: 'Lose the heat — survive 45s', wanted: 3, time: 45 },
      { type: 'deliver', text: 'Deliver the rig to the docks', x: 3520, y: 2400 },
    ],
  },
];

export const SAVE_KEY = 'sunsetcity.save.v1';
