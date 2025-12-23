const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshots() {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
  await delay(2000);

  // Screenshot 1: Main project browser
  console.log('Taking screenshot: Projects view...');
  await page.screenshot({
    path: path.join(screenshotDir, '01-projects-view.png'),
    fullPage: false
  });

  // Screenshot 2: Click on a project to see sessions
  console.log('Taking screenshot: Sessions list...');
  const projectItem = await page.$('[class*="cursor-pointer"]');
  if (projectItem) {
    await projectItem.click();
    await delay(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '02-sessions-list.png'),
      fullPage: false
    });
  }

  // Screenshot 3: Search tab
  console.log('Taking screenshot: Search view...');
  await page.keyboard.press('Escape');
  await delay(500);
  await page.keyboard.press('2'); // Switch to search tab
  await delay(1000);
  await page.screenshot({
    path: path.join(screenshotDir, '03-search-view.png'),
    fullPage: false
  });

  // Screenshot 4: Search with results
  console.log('Taking screenshot: Search results...');
  await page.keyboard.press('/');
  await delay(300);
  await page.keyboard.type('function');
  await delay(2000);
  await page.screenshot({
    path: path.join(screenshotDir, '04-search-results.png'),
    fullPage: false
  });

  // Screenshot 5: Statistics tab
  console.log('Taking screenshot: Statistics view...');
  await page.keyboard.press('Escape');
  await delay(300);
  await page.keyboard.press('3'); // Switch to stats tab
  await delay(1000);
  await page.screenshot({
    path: path.join(screenshotDir, '05-statistics-view.png'),
    fullPage: false
  });

  // Screenshot 6: Bookmarks tab
  console.log('Taking screenshot: Bookmarks view...');
  await page.keyboard.press('4'); // Switch to bookmarks tab
  await delay(1000);
  await page.screenshot({
    path: path.join(screenshotDir, '06-bookmarks-view.png'),
    fullPage: false
  });

  // Screenshot 7: Keyboard shortcuts modal
  console.log('Taking screenshot: Keyboard shortcuts...');
  await page.keyboard.press('?');
  await delay(800);
  await page.screenshot({
    path: path.join(screenshotDir, '07-keyboard-shortcuts.png'),
    fullPage: false
  });

  // Screenshot 8: Back to projects with session selected
  console.log('Taking screenshot: Session detail...');
  await page.keyboard.press('Escape');
  await delay(300);
  await page.keyboard.press('1'); // Back to projects
  await delay(500);

  // Try to click into a session
  const projectItems = await page.$$('[class*="cursor-pointer"]');
  if (projectItems.length > 0) {
    await projectItems[0].click();
    await delay(1000);
    const sessionItems = await page.$$('[class*="cursor-pointer"]');
    if (sessionItems.length > 1) {
      await sessionItems[1].click();
      await delay(1500);
      await page.screenshot({
        path: path.join(screenshotDir, '08-session-detail.png'),
        fullPage: false
      });
    }
  }

  console.log('All screenshots saved to:', screenshotDir);
  await browser.close();
}

takeScreenshots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
