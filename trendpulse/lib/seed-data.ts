import type Database from "better-sqlite3";

// Deterministic PRNG so demo data is stable between runs.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function series(seed: number, start: number, drift: number, n = 12) {
  const r = rng(seed);
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) { v = Math.max(1, v * (1 + drift + (r() - 0.5) * 0.18)); out.push(Math.round(v)); }
  return out;
}

export function seedProducts(d: Database.Database) {
  // Catalog adapted from chec/commercejs-nextjs-demo-store seeds (BSD-3-Clause).
  const cats = [
    ["facial-products", "Facial Products", "/collections/1.png"],
    ["hair-products", "Hair Products", "/collections/2.png"],
    ["body-products", "Body Products", "/collections/3.png"],
  ];
  const ic = d.prepare("INSERT INTO categories (slug,name,image) VALUES (?,?,?)");
  cats.forEach((c) => ic.run(...c));
  const products: [string, string, number, number, string][] = [
    ["Face & Body Roller", "Enrich your morning and evening beauty ritual and help reduce the appearance of puffiness.", 1800, 3, "body-products"],
    ["Cure Scrub Kit", "Cleanse and rejuvenate your skin with bamboo bristle scrubbing brushes.", 5100, 3, "body-products"],
    ["Molecule Body Oil", "A silky smooth finish: the perfect post-shower treatment.", 2300, 3, "body-products"],
    ["Lip Fantastic", "Nourishing lip treatment for soft, smooth lips all day.", 2400, 3, "facial-products"],
    ["Hair Beauty Bath", "A restorative bath treatment for shiny, healthy hair.", 2500, 3, "hair-products"],
    ["Shampoo & Conditioner Set", "Gentle daily cleansing and conditioning duo.", 6500, 3, "hair-products"],
    ["Rose Hair & Body Oil", "Lightweight multi-use oil scented with rose.", 3800, 3, "hair-products"],
    ["Complexion Cream", "Daily moisturiser for a balanced, radiant complexion.", 3200, 3, "facial-products"],
    ["Eye Purity Gels", "Cooling gel pads that refresh tired eyes.", 1800, 3, "facial-products"],
  ];
  const ip = d.prepare(
    "INSERT INTO products (slug,name,description,price_cents,image,category_id,stock) VALUES (?,?,?,?,?,(SELECT id FROM categories WHERE slug=?),?)");
  const exts = ["png", "png", "png", "png", "png", "png", "png", "jpg", "jpg"];
  const stock = [40, 25, 60, 18, 33, 12, 27, 50, 8];
  products.forEach((p, i) => {
    const slug = p[0].toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    ip.run(slug, p[0], p[1], p[2], `/products/${i + 1}.${exts[i]}`, p[4], stock[i]);
  });
}

export function seedAnalytics(d: Database.Database) {
  const comps = [
    ["Lumea Skin", "lumeaskin.com", "Skincare", "Shopify", 412000, 186000, 64, 38, 24.5, "Meta Ads", 42],
    ["Pawsome Co.", "pawsome.co", "Pets", "Shopify", 288000, 121000, 112, 27, 18.2, "TikTok", 31],
    ["NordFit Gear", "nordfit.com", "Fitness", "Shopify", 531000, 264000, 205, 51, 9.8, "Google", 58],
    ["Kinfolk Home", "kinfolkhome.com", "Home", "WooCommerce", 197000, 74000, 340, 12, -3.1, "SEO", 77],
    ["Glowbar", "glowbar.shop", "Beauty", "Shopify", 356000, 158000, 48, 44, 31.9, "TikTok", 29],
    ["Trailmate", "trailmate.io", "Outdoors", "BigCommerce", 243000, 109000, 87, 19, 6.4, "Meta Ads", 64],
    ["Bloomwear", "bloomwear.co", "Apparel", "Shopify", 622000, 301000, 410, 63, 12.7, "Instagram", 46],
    ["Sipsmith Tea", "sipsmithtea.com", "Food & Drink", "Shopify", 134000, 52000, 36, 9, 2.2, "Email", 24],
  ] as const;
  const ic = d.prepare(`INSERT INTO competitors (name,domain,niche,platform,monthly_visits,est_revenue,product_count,active_ads,growth_pct,traffic_series,top_channel,avg_price)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  comps.forEach((c, i) => {
    const drift = c[8] / 100 / 12;
    ic.run(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], JSON.stringify(series(i + 7, c[4] / 2.2, drift)), c[9], c[10]);
  });

  const trends = [
    ["Portable neck fan", "Gadgets", 94, 212, 29, 143, 87, "Summer demand spike; short-form video demos show the 'hands-free cooling' benefit in 3 seconds."],
    ["LED sunset lamp", "Home", 89, 148, 24, 221, 134, "Strong visual hook for TikTok/Reels; low price allows impulse buys and bundles."],
    ["Posture corrector brace", "Health", 81, 63, 35, 98, 52, "Problem/solution creative with before-after framing converts well across Meta."],
    ["Heatless curl set", "Beauty", 86, 177, 19, 164, 96, "Overnight-hair-routine content went viral; cheap to ship and high margin."],
    ["Pet hair roller", "Pets", 78, 54, 15, 187, 61, "Evergreen pain point with satisfying demo videos; steady ad volume."],
    ["Mini waffle maker", "Kitchen", 72, 91, 27, 76, 38, "Recipe content drives organic reach; gifting angle lifts Q4 demand."],
    ["Magnetic phone wallet", "Accessories", 68, 38, 22, 132, 44, "Mature product, ad saturation rising — differentiation needed."],
    ["Cordless dust blower", "Home", 83, 120, 42, 59, 41, "Rapid growth, still few sellers: early-mover window."],
    ["Collagen gummies", "Wellness", 75, 46, 32, 203, 118, "Subscription-friendly; influencer UGC is the dominant creative format."],
    ["Car trunk organizer", "Auto", 64, 21, 31, 112, 29, "Slow, steady seller; strong SEO and Google Shopping performance."],
  ] as const;
  const it = d.prepare(`INSERT INTO trends (product,niche,score,growth_pct,avg_price,stores_selling,active_ads,series,why) VALUES (?,?,?,?,?,?,?,?,?)`);
  trends.forEach((t, i) => it.run(t[0], t[1], t[2], t[3], t[4], t[5], t[6], JSON.stringify(series(i + 31, 30, t[3] / 100 / 10)), t[7]));

  const hooks = [
    ["Stop scrolling — this fixed my hair in 7 days", "UGC testimonial with before/after cut-ins and a 20% launch discount.", "Shop now"],
    ["I didn't believe it either…", "Skeptic-to-believer story; founder voiceover over product demo.", "Learn more"],
    ["3 reasons 40,000 customers switched", "Social proof stack with review screenshots and a guarantee badge.", "Shop now"],
    ["Your dog will thank you", "Emotional pet reaction footage; free shipping over $40.", "Shop now"],
    ["The $19 upgrade your routine is missing", "Price-anchored hook comparing to a $80 salon alternative.", "Get offer"],
    ["Watch what happens in 10 seconds", "Fast demo, text overlays, strong payoff at second 8.", "Shop now"],
    ["Why gym bros are switching to this", "Creator-led comparison with a limited-time bundle.", "Shop now"],
    ["Last chance: bundle & save 30%", "Urgency + scarcity countdown on a best-selling bundle.", "Shop now"],
  ];
  const ia = d.prepare(`INSERT INTO ads (competitor_id,platform,format,hook,copy,cta,days_running,est_spend,engagement) VALUES (?,?,?,?,?,?,?,?,?)`);
  const r = rng(99);
  const platforms = ["Meta", "TikTok", "Instagram", "YouTube"];
  const formats = ["Video", "Image", "Carousel", "UGC video"];
  for (let c = 1; c <= comps.length; c++) {
    for (let k = 0; k < 3; k++) {
      const h = hooks[Math.floor(r() * hooks.length)];
      const days = 3 + Math.floor(r() * 120);
      ia.run(c, platforms[Math.floor(r() * 4)], formats[Math.floor(r() * 4)], h[0], h[1], h[2], days,
        Math.round((days * (40 + r() * 260)) / 10) * 10, Math.round(500 + r() * 48000));
    }
  }
}
