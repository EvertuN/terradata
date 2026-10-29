const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_DIR = path.join(__dirname, '..', 'docs', 'assets');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function scrollToExactText(page, searchText, offset = -20) {
  const result = await page.evaluate((text, off) => {
    // Find leaf text node or specific text inside main content (exclude navigation header)
    const candidates = Array.from(document.querySelectorAll('div, span, h1, h2, h3, p'));
    const matched = candidates.find(el => {
      // Exclude top navigation buttons
      if (el.closest('.segmentedContainer') || el.closest('[role="tab"]') || el.closest('nav')) return false;
      const t = el.textContent ? el.textContent.trim() : '';
      return t === text || (t.includes(text) && t.length < text.length + 25);
    });

    if (matched) {
      const rect = matched.getBoundingClientRect();
      window.scrollBy({ top: rect.top + off, behavior: 'instant' });
      return true;
    }
    return false;
  }, searchText, offset);

  await new Promise(r => setTimeout(r, 1200));
  return result;
}

async function captureAll() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050'],
    defaultViewport: {
      width: 1440,
      height: 940,
      deviceScaleFactor: 1.5,
    },
  });

  try {
    const page = await browser.newPage();

    // 1. Landing Screen
    console.log('1. Capturing Landing Page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-landing.png'),
    });

    // 2. Search and select Ariquemes, Rondônia
    console.log('Searching for Ariquemes...');
    const input = await page.waitForSelector('input');
    await input.type('Ariquemes', { delay: 40 });
    await new Promise(r => setTimeout(r, 1500));

    console.log('Selecting Rondônia suggestion...');
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div'));
      const rondonia = all.find(el => el.textContent.trim() === 'Rondônia • Brasil');
      if (rondonia) {
        let cur = rondonia;
        while (cur && cur.parentElement) {
          if (cur.getAttribute('role') === 'button' || cur.style.cursor === 'pointer' || cur.onclick) break;
          cur = cur.parentElement;
        }
        (cur || rondonia).click();
      }
    });

    console.log('Waiting for Ariquemes dashboard...');
    await page.waitForFunction(
      () => document.body.innerText.includes('Ariquemes') && !document.body.innerText.includes('Atualizando dados...'),
      { timeout: 15000 }
    ).catch(() => {});

    // Allow time for weather, Wikipedia photo, Leaflet tiles, and Wikidata POIs
    await new Promise(r => setTimeout(r, 5000));

    // 2. Dashboard Top
    console.log('Capturing screenshot-dashboard.png ...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-dashboard.png'),
    });

    // 3. Smart Insights & Itinerary
    console.log('Capturing screenshot-insights-itinerary.png ...');
    await scrollToExactText(page, 'Smart Insights do Dia', -25);
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-insights-itinerary.png'),
    });

    // 4. Air Quality & Interactive Radar Map
    console.log('Capturing screenshot-air-map.png ...');
    await scrollToExactText(page, 'Recomendação de Saúde', -80);
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-air-map.png'),
    });

    // 5. POIs
    console.log('Capturing screenshot-pois.png ...');
    await scrollToExactText(page, 'Pontos de Interesse', -25);
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-pois.png'),
    });

    // 6. Nearby Cities
    console.log('Capturing screenshot-nearby.png ...');
    await scrollToExactText(page, 'Cidades Vizinhas', -25);
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-nearby.png'),
    });

    // 7. Snapshot Modal
    console.log('Opening Snapshot Modal...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, button, [role="button"]'));
      const snap = all.find(e => e.textContent && e.textContent.trim() === 'Snapshot');
      if (snap) {
        let cur = snap;
        while (cur && cur.parentElement) {
          if (cur.getAttribute('role') === 'button' || cur.style.cursor === 'pointer' || cur.onclick) break;
          cur = cur.parentElement;
        }
        (cur || snap).click();
      }
    });

    await new Promise(r => setTimeout(r, 2200));
    console.log('Capturing screenshot-snapshot.png ...');
    await page.screenshot({
      path: path.join(TARGET_DIR, 'screenshot-snapshot.png'),
    });

    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

captureAll();
