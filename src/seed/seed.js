/**
 * Seed script — populates HalalWalls (Supabase Postgres) with browsable demo
 * data so the public wallpaper APIs return real results.
 *
 * Run:  npm run seed
 * Tables: hw_categories, hw_wallpapers.
 *
 * Covers every category slug + browse mode the frontend uses:
 *   categories: islamic, anime, superheroes, minimalist, gaming, movies, cars, sport, space
 *   browse:     latest (createdAt), popular (downloadCount), random, live (isLive)
 */
require('dotenv').config();
const prisma = require('../lib/prisma');

// ── categories (slugs match the frontend FilterId union) ──
const CATEGORIES = [
  { slug: 'islamic', name: 'Islamic', description: 'Mosques, calligraphy and Islamic art.', order: 1 },
  { slug: 'anime', name: 'Anime', description: 'Anime characters, scenes and posters.', order: 2 },
  { slug: 'superheroes', name: 'Superheroes', description: 'Comic and movie superheroes.', order: 3 },
  { slug: 'minimalist', name: 'Minimalist', description: 'Clean, simple, calm wallpapers.', order: 4 },
  { slug: 'gaming', name: 'Gaming', description: 'Game art, characters and worlds.', order: 5 },
  { slug: 'movies', name: 'Movies', description: 'Film posters and cinematic scenes.', order: 6 },
  { slug: 'cars', name: 'Cars', description: 'Supercars, classics and concepts.', order: 7 },
  { slug: 'sport', name: 'Sport', description: 'Athletes, action and stadiums.', order: 8 },
  { slug: 'space', name: 'Space', description: 'Galaxies, planets and nebulae.', order: 9 },
];

const u = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
const p = (s) => `https://picsum.photos/seed/${s}/1200/800`;

// ── wallpapers ──  [title, categorySlug, resolution, image, tags, {isLive,isPremium}]
const RAW = [
  ['Neon Metropolis', 'space', '1920x1080', u('1519501025264-65ba15a82390'), ['neon', 'city', 'night']],
  ['Cosmic Drift', 'space', '3840x2160', u('1419242902214-272b3f66ee7a'), ['galaxy', 'stars', 'nebula'], { isLive: true }],
  ['Spiral Galaxy', 'space', '3840x2160', p('spiral-galaxy'), ['galaxy', 'stars']],
  ['Warrior Sunset', 'anime', '1920x1080', u('1578632767115-351597cf2477'), ['warrior', 'sunset']],
  ['Infinite Domain', 'anime', '3840x2160', u('1620641788421-7a1c342ea42e'), ['anime', 'art']],
  ['Power Aura', 'anime', '3840x2160', u('1444703686981-a3abbc4d4fe3'), ['aura', 'energy'], { isLive: true }],
  ['Crimson Guardian', 'superheroes', '1920x1080', u('1531259683007-016a7b628fc3'), ['hero', 'comic']],
  ['Spider-Verse Hero', 'superheroes', '2560x1440', u('1635805737707-575885ab0820'), ['spider', 'hero']],
  [
    'The Batman Silent Watcher In The Night',
    'superheroes',
    '2560x1440',
    u('1478720568477-152d9b164e26'),
    ['The Batman', 'Batman', 'Superheroes', 'DC Comics', 'Dark Knight', 'Gotham', 'Comic Book'],
    { isPremium: true },
  ],
  ['Alpine Reflection', 'minimalist', '2560x1440', u('1464822759023-fed622ff2c3b'), ['alpine', 'calm']],
  ['Forest Sunset', 'minimalist', '1920x1080', u('1448375240586-882707db888b'), ['forest', 'sunset']],
  ['Mecha Protocol', 'gaming', '3440x1440', u('1614728263952-84ea256f9679'), ['mecha', 'cyberpunk']],
  ['Medieval Battlefield', 'gaming', '2560x1440', u('1518709268805-4e9042af9f23'), ['medieval', 'battle']],
  ['Cyber Arena', 'gaming', '2560x1440', p('cyber-arena'), ['cyberpunk', 'arena'], { isLive: true }],
  ['Prehistoric Valley', 'movies', '2560x1440', u('1506905925346-21bda4d32df4'), ['valley', 'cinematic']],
  ['Desert Odyssey', 'movies', '3840x2160', p('desert-odyssey'), ['desert', 'epic'], { isPremium: true }],
  ['Velocity GT', 'cars', '1920x1080', u('1503376780353-7e6692767b70'), ['supercar', 'road']],
  ['Midnight Hypercar', 'cars', '3840x2160', p('midnight-hypercar'), ['hypercar', 'night']],
  ['Stadium Lights', 'sport', '1920x1080', p('stadium-lights'), ['stadium', 'football']],
  ['Court Vision', 'sport', '2560x1440', p('court-vision'), ['basketball', 'action']],
  ['Blue Mosque at Dusk', 'islamic', '3840x2160', p('blue-mosque'), ['mosque', 'architecture']],
  ['Golden Calligraphy', 'islamic', '1920x1080', p('golden-calligraphy'), ['calligraphy', 'gold'], { isPremium: true }],
  ['Crescent Skyline', 'islamic', '2560x1440', p('crescent-skyline'), ['crescent', 'night'], { isLive: true }],
];

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sizeFor = (w, h) => Math.round(((w * h) / (1920 * 1080)) * 1.42 * 100) / 100;

async function seed() {
  await prisma.$connect();
  console.log('✅ Connected to HalalWalls DB (Supabase Postgres)');

  const labelBySlug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.name]));
  const now = Date.now();

  // ── wallpapers ── (deleting wallpapers cascades to hw_favorites) ──
  await prisma.wallpaper.deleteMany();
  const docs = RAW.map((row, i) => {
    const [title, categorySlug, resolution, image, tags = [], flags = {}] = row;
    const [width, height] = resolution.split('x').map(Number);
    return {
      title,
      slug: slugify(title),
      description: `${title} — ${labelBySlug[categorySlug]} wallpaper in stunning detail.`,
      category: labelBySlug[categorySlug],
      categorySlug,
      tags,
      image,
      originalUrl: image,
      thumbnailUrl: image,
      resolution,
      preferredResolution: resolution,
      resolutions: ['1920x1080', '2560x1440', '3840x2160'],
      width,
      height,
      sizeMB: sizeFor(width, height),
      author: 'halalwalls',
      isPremium: !!flags.isPremium,
      isLive: !!flags.isLive,
      status: 'active',
      downloadCount: (RAW.length - i) * 137 + ((i * 53) % 90),
      views: ((RAW.length - i) * 137 + ((i * 53) % 90)) * 3,
      createdAt: new Date(now - i * 36 * 60 * 60 * 1000), // stagger for "latest"
    };
  });
  const inserted = await prisma.wallpaper.createMany({ data: docs });
  console.log(`🖼️  Seeded ${inserted.count} wallpapers`);

  // ── categories (with cached counts) ──
  await prisma.category.deleteMany();
  const catDocs = CATEGORIES.map((c) => ({
    name: c.name,
    slug: c.slug,
    description: c.description,
    order: c.order,
    image: docs.find((d) => d.categorySlug === c.slug)?.image || null,
    count: docs.filter((d) => d.categorySlug === c.slug).length,
  }));
  const insertedCats = await prisma.category.createMany({ data: catDocs });
  console.log(`🗂️  Seeded ${insertedCats.count} categories`);

  await prisma.$disconnect();
  console.log('✅ Seed complete. Disconnected.');
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
