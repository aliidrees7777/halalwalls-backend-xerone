// One-time: create (or reuse) the HalalWalls Premium prices — monthly, yearly,
// and lifetime. Run: node scripts/create-stripe-price.mjs → prints each Price ID.
import dotenv from 'dotenv';
// Local dev tool: load the local env (falls back to a plain .env).
import fs from 'fs';
dotenv.config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DESC = 'No ads, exclusive wallpapers, premium collections, 24/7 priority support.';

const PLANS = [
  { key: 'halalwalls_premium_monthly', name: 'HalalWalls Premium (Monthly)', amount: 299, recurring: { interval: 'month' } },
  { key: 'halalwalls_premium_yearly', name: 'HalalWalls Premium (Yearly)', amount: 999, recurring: { interval: 'year' } },
  { key: 'halalwalls_premium_lifetime', name: 'HalalWalls Premium (Lifetime)', amount: 2999, recurring: null },
];

for (const p of PLANS) {
  const existing = await stripe.prices.list({ lookup_keys: [p.key], active: true, limit: 1 });
  if (existing.data.length) {
    console.log(`${p.key} => ${existing.data[0].id} (existing)`);
    continue;
  }
  const product = await stripe.products.create({ name: p.name, description: DESC });
  const params = { product: product.id, unit_amount: p.amount, currency: 'usd', lookup_key: p.key };
  if (p.recurring) params.recurring = p.recurring;
  const price = await stripe.prices.create(params);
  console.log(`${p.key} => ${price.id} (created)`);
}
