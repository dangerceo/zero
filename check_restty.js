import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
    
    await page.goto('http://localhost:3847/terminal');
    await page.waitForTimeout(3000);
    
    const hasCanvas = await page.evaluate(() => !!document.querySelector('.terminal-container canvas'));
    console.log('HAS_CANVAS:', hasCanvas);
    
    await browser.close();
})();
