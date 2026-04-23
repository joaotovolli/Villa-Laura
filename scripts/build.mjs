import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const distDir = path.join(root, "dist");
const assetsDir = path.join(distDir, "assets");
const sourceImagesDir = path.join(root, "assets", "source");
const publicDir = path.join(root, "public");
const stylesPath = path.join(root, "src", "styles.css");
const appScriptPath = path.join(root, "src", "app.js");
const configPath = path.join(root, "site.config.json");

const rawConfig = await readFile(configPath, "utf8");
const config = JSON.parse(rawConfig);

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

const publicFiles = ["_headers", "favicon.svg"];
for (const file of publicFiles) {
  await copyFile(path.join(publicDir, file), path.join(distDir, file));
}

const styles = await readFile(stylesPath, "utf8");
const appScript = await readFile(appScriptPath, "utf8");

const normalisePhone = (value) => value.replace(/[^\d+]/g, "");
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const extractVideoId = (url) => {
  const parsed = new URL(url);
  if (parsed.hostname.includes("youtu.be")) {
    return parsed.pathname.replace("/", "");
  }
  if (parsed.pathname.startsWith("/shorts/")) {
    return parsed.pathname.split("/")[2];
  }
  if (parsed.searchParams.has("v")) {
    return parsed.searchParams.get("v");
  }
  return "";
};

const imageOutputs = [];

for (const [index, image] of config.gallery.entries()) {
  const inputPath = path.join(sourceImagesDir, image.source);
  const slug = `photo-${index + 1}`;
  const webpName = `${slug}.webp`;
  const jpegName = `${slug}.jpg`;

  await sharp(inputPath)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 76 })
    .toFile(path.join(assetsDir, webpName));

  await sharp(inputPath)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(assetsDir, jpegName));

  imageOutputs.push({
    alt: image.alt,
    webp: `./assets/${webpName}`,
    jpeg: `./assets/${jpegName}`,
    large: index === 0
  });
}

const videoCards = config.videos
  .map((video) => {
    const videoId = extractVideoId(video.url);
    const embed = `https://www.youtube-nocookie.com/embed/${videoId}`;
    return `
      <article class="video-card reveal">
        <iframe
          class="video-frame"
          src="${embed}"
          title="${escapeHtml(video.title)}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
        <div>
          <h3>${escapeHtml(video.title)}</h3>
          <p>${escapeHtml(video.description)}</p>
        </div>
      </article>
    `;
  })
  .join("");

const galleryCards = imageOutputs
  .map(
    (image) => `
      <figure class="gallery-card reveal${image.large ? " gallery-card--large" : ""}">
        <picture>
          <source srcset="${image.webp}" type="image/webp" />
          <img src="${image.jpeg}" alt="${escapeHtml(image.alt)}" loading="lazy" />
        </picture>
      </figure>
    `
  )
  .join("");

const guideBlocks = config.guideSections
  .map(
    (section) => `
      <article class="guide-block reveal">
        <h3>${escapeHtml(section.title)}</h3>
        <ul class="guide-list">
          ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    `
  )
  .join("");

const infoPanels = config.localInfo
  .map(
    (item) => `
      <article class="panel reveal">
        <h3 class="panel__title">${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </article>
    `
  )
  .join("");

const highlightItems = config.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
const whatsappHref = `https://wa.me/${normalisePhone(config.links.whatsapp).replace("+", "")}`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(config.site.name)} | Guest Guide</title>
    <meta name="description" content="${escapeHtml(config.site.description)}" />
    <meta name="theme-color" content="#254855" />
    <meta property="og:title" content="${escapeHtml(config.site.name)}" />
    <meta property="og:description" content="${escapeHtml(config.site.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(config.site.domain)}" />
    <meta property="og:image" content="${imageOutputs[0].jpeg}" />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>${styles}</style>
  </head>
  <body>
    <div class="site-shell">
      <header class="topbar">
        <div class="topbar__inner">
          <a class="brand" href="#top" aria-label="${escapeHtml(config.site.name)} home">
            <span class="brand__name">${escapeHtml(config.site.name)}</span>
            <span class="brand__tag">${escapeHtml(config.site.tagline)}</span>
          </a>
          <nav class="nav" aria-label="Primary">
            <a href="#about">About</a>
            <a href="#videos">Video Guides</a>
            <a href="#guide">House Guide</a>
            <a href="#gallery">Gallery</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section class="hero">
          <div class="hero__media reveal">
            <picture>
              <source srcset="${imageOutputs[0].webp}" type="image/webp" />
              <img class="hero__image" src="${imageOutputs[0].jpeg}" alt="${escapeHtml(imageOutputs[0].alt)}" fetchpriority="high" />
            </picture>
            <div class="hero__copy">
              <div class="eyebrow">${escapeHtml(config.hero.eyebrow)}</div>
              <h1>${escapeHtml(config.hero.title)}</h1>
              <p class="hero__lede">${escapeHtml(config.hero.body)}</p>
              <div class="hero__actions">
                <a class="button button--solid" href="${whatsappHref}" target="_blank" rel="noreferrer">WhatsApp Support</a>
                <a class="button button--ghost" href="${config.links.airbnb}" target="_blank" rel="noreferrer">Book on Airbnb</a>
              </div>
            </div>
          </div>

          <aside class="hero__panel reveal">
            <div class="meta-grid">
              <div class="meta-card">
                <div class="meta-card__label">Support</div>
                <div class="meta-card__value">WhatsApp</div>
                <div>${escapeHtml(config.links.whatsapp)}</div>
              </div>
              <div class="meta-card">
                <div class="meta-card__label">Bookings</div>
                <div class="meta-card__value">Airbnb</div>
                <div>Private holiday home listing</div>
              </div>
              <div class="meta-card">
                <div class="meta-card__label">Guide Library</div>
                <div class="meta-card__value">${config.videos.length} video walkthroughs</div>
                <div>Appliances, keys, access, and house basics</div>
              </div>
              <div class="meta-card">
                <div class="meta-card__label">Location</div>
                <div class="meta-card__value">Sardinia, Italy</div>
                <div>Simple support for a relaxed stay</div>
              </div>
            </div>
          </aside>
        </section>

        <section class="section section--split" id="about">
          <div class="reveal">
            <div class="section__kicker">About Villa Laura</div>
            <h2>${escapeHtml(config.about.title)}</h2>
            <p class="section__intro">${escapeHtml(config.about.body)}</p>
          </div>
          <div class="panel reveal">
            <h3 class="panel__title">What this site is for</h3>
            <ul class="highlight-list">${highlightItems}</ul>
          </div>
        </section>

        <section class="section" id="videos">
          <div class="reveal">
            <div class="section__kicker">Video Guides</div>
            <h2>Quick help, right when you need it.</h2>
            <p class="section__intro">Each guide is embedded here for fast access on mobile, with the full library also available on YouTube.</p>
          </div>
          <div class="video-grid">${videoCards}</div>
        </section>

        <section class="section section--split" id="guide">
          <div class="reveal">
            <div class="section__kicker">House Guide</div>
            <h2>Practical information without extra clutter.</h2>
            <p class="section__intro">This first version focuses on the essentials guests typically need most during a stay.</p>
          </div>
          <div class="panel-grid">${infoPanels}</div>
          <div class="guide-grid" style="grid-column: 1 / -1;">${guideBlocks}</div>
        </section>

        <section class="section" id="gallery">
          <div class="reveal">
            <div class="section__kicker">Gallery</div>
            <h2>The view, the light, the atmosphere.</h2>
            <p class="section__intro">A compact set of curated images keeps the site visually strong while staying quick to load.</p>
          </div>
          <div class="gallery-grid">${galleryCards}</div>
        </section>

        <section class="section" id="contact">
          <div class="contact-grid">
            <article class="contact-card reveal">
              <div class="section__kicker" style="color: rgba(255,253,248,0.72);">Contact</div>
              <h2>${escapeHtml(config.contact.title)}</h2>
              <p>${escapeHtml(config.contact.body)}</p>
              <div class="contact-actions">
                <a class="button button--accent" href="${whatsappHref}" target="_blank" rel="noreferrer">Open WhatsApp</a>
                <a class="button button--outline" href="${config.links.airbnb}" target="_blank" rel="noreferrer">Open Airbnb</a>
                <a class="button button--outline" href="${config.links.youtubeChannel}" target="_blank" rel="noreferrer">Open YouTube Channel</a>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer class="footer">
        <div class="footer__line">
          <p>${escapeHtml(config.site.name)} is a guest-support website. Bookings stay on Airbnb, and day-to-day help goes through WhatsApp.</p>
        </div>
      </footer>
    </div>
    <script type="module">${appScript}</script>
  </body>
</html>`;

await writeFile(path.join(distDir, "index.html"), html, "utf8");
