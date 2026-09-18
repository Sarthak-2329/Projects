const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/home/sarthak-surale/.gemini/antigravity/brain/a084ab2d-f426-4cf2-95de-575312fdd5b6';
const SCRATCH_DIR = path.join(ARTIFACT_DIR, 'scratch');
const SOLAR_PDF = path.join(SCRATCH_DIR, 'solar_system.pdf');
const CAPITALS_PDF = path.join(SCRATCH_DIR, 'world_capitals.pdf');
const TXT_FILE = path.join(SCRATCH_DIR, 'sample.txt');

// Ensure sample text file exists for negative testing
fs.writeFileSync(TXT_FILE, 'This is not a PDF document.');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('🚀 Launching Chromium for E2E Browser Testing...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 950 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log(`  [BROWSER CONSOLE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('  [BROWSER ERROR]:', err));
  page.on('requestfailed', req => console.log('  [REQ FAILED]:', req.method(), req.url(), req.failure()?.errorText));

  const results = [];
  function logStep(name, status, details = '') {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} [${name}] ${details}`);
    results.push({ name, passed: status, details });
  }

  try {
    // -------------------------------------------------------------
    // Step 1: Initial Page Load
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Initial Page Load ---');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await sleep(1000);

    const title = await page.textContent('.app-header h1');
    const hasTitle = title.includes('RAG Document Parser');
    logStep('Step 1: Page Load', hasTitle, `Header: "${title}"`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step01_initial_state.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 2: Upload solar_system.pdf
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Upload solar_system.pdf ---');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(SOLAR_PDF);
    await sleep(500);

    const uploadBtn = await page.locator('.upload-btn');
    await uploadBtn.click();

    // Wait for success status message
    await page.waitForSelector('.status-message.success', { timeout: 30000 });
    const upload1Msg = await page.textContent('.status-message.success');
    logStep('Step 2: Upload solar_system.pdf', upload1Msg.includes('8 chunks created'), upload1Msg);

    // Verify document card appears
    await page.waitForSelector('.doc-card');
    const docCards1 = await page.locator('.doc-card').count();
    logStep('Step 2: Document Card 1', docCards1 === 1, `Found ${docCards1} document cards`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step02_solar_system_uploaded.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 3: Upload world_capitals.pdf
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Upload world_capitals.pdf ---');
    await fileInput.setInputFiles(CAPITALS_PDF);
    await sleep(500);
    await uploadBtn.click();

    // Wait for second success status
    await page.waitForFunction(() => {
      const msg = document.querySelector('.status-message.success');
      return msg && msg.textContent.includes('world_capitals.pdf');
    }, { timeout: 30000 });

    const upload2Msg = await page.textContent('.status-message.success');
    logStep('Step 3: Upload world_capitals.pdf', upload2Msg.includes('6 chunks created'), upload2Msg);

    await page.waitForFunction(() => document.querySelectorAll('.doc-card').length === 2, { timeout: 5000 });
    const docCards2 = await page.locator('.doc-card').count();
    logStep('Step 3: Both Document Cards Visible', docCards2 === 2, `Found ${docCards2} cards`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step03_both_documents_uploaded.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 4: Re-ingestion Idempotency Check via UI
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Re-ingest solar_system.pdf (Idempotency Check) ---');
    await fileInput.setInputFiles(SOLAR_PDF);
    await sleep(500);
    await uploadBtn.click();

    await page.waitForFunction(() => {
      const msg = document.querySelector('.status-message.success');
      return msg && msg.textContent.includes('solar_system.pdf');
    }, { timeout: 30000 });

    const cardsText = await page.locator('.documents-grid').innerText();
    const stillTwoDocs = (await page.locator('.doc-card').count()) === 2;
    const solarBadgeText = await page.locator('.doc-card:has-text("solar_system.pdf") .chunk-badge').textContent();
    const idempotent = stillTwoDocs && solarBadgeText.includes('8 chunks');
    logStep('Step 4: Re-ingestion Idempotent', idempotent, `Cards: ${stillTwoDocs ? 2 : 'not 2'}, Solar chunks: "${solarBadgeText}"`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step04_reingest_idempotency.png'), fullPage: true });

    // Helper to ask a question and wait for answer
    async function askQuestion(questionText) {
      await sleep(2000); // polite pause between queries
      const chatInput = page.locator('.chat-input');
      await chatInput.fill(questionText);
      await sleep(300);
      const sendBtn = page.locator('.chat-send-btn');
      await sendBtn.click();
      
      // Wait for thinking indicator to appear then disappear, or wait for answer
      await page.waitForSelector('.thinking-indicator', { timeout: 8000 }).catch(() => {});
      await page.waitForSelector('.thinking-indicator', { state: 'detached', timeout: 60000 });
      await sleep(1500);
      
      const lastAnswer = page.locator('.chat-answer').last();
      return lastAnswer;
    }

    // -------------------------------------------------------------
    // Step 5: Question 1 — Mars / Olympus Mons (solar_system.pdf, Page 2)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Question 1 (Olympus Mons on Mars) ---');
    const ans1 = await askQuestion('How tall is Olympus Mons on Mars?');
    const ans1Text = await ans1.textContent();
    const hasMarsFact = ans1Text.includes('21.9') || ans1Text.toLowerCase().includes('olympus');
    logStep('Step 5: Question 1 Answer', hasMarsFact, `Answer snippet: "${ans1Text.slice(0, 100)}..."`);

    // Verify & Expand Citation
    const cite1Header = ans1.locator('.citation-header').first();
    const cite1HeaderText = await cite1Header.textContent();
    const cite1Correct = cite1HeaderText.includes('solar_system.pdf') && cite1HeaderText.includes('Page 2');
    logStep('Step 5: Question 1 Citation Header', cite1Correct, cite1HeaderText);

    await cite1Header.click();
    await sleep(500);
    const cite1Body = await ans1.locator('.citation-body').first().textContent();
    const cite1BodyValid = cite1Body.includes('Olympus Mons') || cite1Body.includes('volcano');
    logStep('Step 5: Question 1 Citation Body Expanded', cite1BodyValid, `Body preview: "${cite1Body.slice(0, 80)}..."`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step05_question1_olympus_mons.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 6: Question 2 — Great Red Spot (solar_system.pdf, Page 3)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Question 2 (Jupiter Great Red Spot) ---');
    const ans2 = await askQuestion('How long has the Great Red Spot storm on Jupiter been raging?');
    const ans2Text = await ans2.textContent();
    const hasJupiterFact = ans2Text.includes('350');
    logStep('Step 6: Question 2 Answer', hasJupiterFact, `Answer: "${ans2Text.slice(0, 100)}..."`);

    const cite2Header = ans2.locator('.citation-header').first();
    const cite2HeaderText = await cite2Header.textContent();
    const cite2Correct = cite2HeaderText.includes('solar_system.pdf') && cite2HeaderText.includes('Page 3');
    logStep('Step 6: Question 2 Citation Header', cite2Correct, cite2HeaderText);

    await cite2Header.click();
    await sleep(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step06_question2_great_red_spot.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 7: Question 3 — Eiffel Tower in Paris (world_capitals.pdf, Page 2)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Question 3 (Eiffel Tower in Paris) ---');
    const ans3 = await askQuestion('When was the Eiffel Tower built and how tall is it?');
    const ans3Text = await ans3.textContent();
    const hasParisFact = ans3Text.includes('1889') || ans3Text.includes('330');
    logStep('Step 7: Question 3 Answer', hasParisFact, `Answer: "${ans3Text.slice(0, 100)}..."`);

    const cite3Header = ans3.locator('.citation-header').first();
    const cite3HeaderText = await cite3Header.textContent();
    const cite3Correct = cite3HeaderText.includes('world_capitals.pdf') && cite3HeaderText.includes('Page 2');
    logStep('Step 7: Question 3 Citation Header', cite3Correct, cite3HeaderText);

    await cite3Header.click();
    await sleep(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step07_question3_eiffel_tower.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 8: Question 4 — Brasilia facts (world_capitals.pdf, Page 3)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Question 4 (Brasilia facts) ---');
    const ans4 = await askQuestion('Who designed Brasilia and when was it inaugurated?');
    const ans4Text = await ans4.textContent();
    const hasBrasiliaFact = ans4Text.includes('Costa') || ans4Text.includes('Niemeyer') || ans4Text.includes('1960');
    logStep('Step 8: Question 4 Answer', hasBrasiliaFact, `Answer: "${ans4Text.slice(0, 100)}..."`);

    const cite4Header = ans4.locator('.citation-header').first();
    const cite4HeaderText = await cite4Header.textContent();
    const cite4Correct = cite4HeaderText.includes('world_capitals.pdf') && cite4HeaderText.includes('Page 3');
    logStep('Step 8: Question 4 Citation Header', cite4Correct, cite4HeaderText);

    await cite4Header.click();
    await sleep(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step08_question4_brasilia.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 9: No-Hallucination Case ("I don't know")
    // -------------------------------------------------------------
    console.log('\n--- Step 9: No-Hallucination Case (Chocolate Cake Recipe) ---');
    const ans5 = await askQuestion('What is the recipe for baking chocolate cake?');
    const ans5Text = await ans5.textContent();
    const isIDKText = ans5Text.toLowerCase().includes("don't know") || ans5Text.toLowerCase().includes("do not know");
    const hasIDKClass = await ans5.evaluate(el => el.classList.contains('idk'));
    const hasIDKIcon = await ans5.locator('.idk-icon').count() > 0;
    const hasNoCitations = await ans5.locator('.citations-container').count() === 0;
    const idkValid = isIDKText && hasIDKClass && hasIDKIcon && hasNoCitations;

    logStep('Step 9: No-Hallucination / IDK Handling', idkValid, 
      `Text: "${ans5Text.trim()}", Has .idk: ${hasIDKClass}, Icon: ${hasIDKIcon}, CitationsCount: ${hasNoCitations ? 0 : 'present'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step09_no_hallucination_idk.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 10: Multi-document scoping — Scoped to world_capitals.pdf
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Multi-Document Scoping (Scoped to world_capitals.pdf) ---');
    console.log('Waiting 10s for API rate-limit window...');
    await sleep(10000);
    const capitalsCard = page.locator('.doc-card:has-text("world_capitals.pdf")');
    await capitalsCard.click();
    await sleep(500);

    const isCapitalsActive = await capitalsCard.evaluate(el => el.classList.contains('active'));
    const scopeText1 = await page.locator('.active-scope-label').textContent();
    logStep('Step 10: Active Scope Set', isCapitalsActive && scopeText1.includes('world_capitals.pdf'), scopeText1);

    // Ask about Mars while scoped to World Capitals!
    const ans6 = await askQuestion('How tall is Olympus Mons?');
    const ans6Text = await ans6.textContent();
    const scopedIDK1 = ans6Text.toLowerCase().includes("don't know") || ans6Text.toLowerCase().includes("do not know") || ans6Text.toLowerCase().includes("cannot answer");
    logStep('Step 10: Cross-Document Leakage Prevented (Mars in Capitals scope)', scopedIDK1, `Answer: "${ans6Text.trim()}"`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step10_scoped_query_world_capitals.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 11: Multi-document scoping — Scoped to solar_system.pdf
    // -------------------------------------------------------------
    console.log('\n--- Step 11: Multi-Document Scoping (Scoped to solar_system.pdf) ---');
    console.log('Waiting 10s for API rate-limit window...');
    await sleep(10000);
    const solarCard = page.locator('.doc-card:has-text("solar_system.pdf")');
    await solarCard.click();
    await sleep(500);

    const isSolarActive = await solarCard.evaluate(el => el.classList.contains('active'));
    const scopeText2 = await page.locator('.active-scope-label').textContent();
    logStep('Step 11: Active Scope Changed', isSolarActive && scopeText2.includes('solar_system.pdf'), scopeText2);

    // Ask about Paris while scoped to Solar System!
    const ans7 = await askQuestion('What is the capital of France and what is its population?');
    const ans7Text = await ans7.textContent();
    const scopedIDK2 = ans7Text.toLowerCase().includes("don't know") || ans7Text.toLowerCase().includes("do not know") || ans7Text.toLowerCase().includes("cannot answer");
    logStep('Step 11: Cross-Document Leakage Prevented (Paris in Solar scope)', scopedIDK2, `Answer: "${ans7Text.trim()}"`);

    // Reset scope by clicking active card
    await solarCard.click();
    await sleep(500);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step11_scoped_query_solar_system.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 12: Negative Test — Upload Non-PDF file
    // -------------------------------------------------------------
    console.log('\n--- Step 12: Negative Test — Upload Non-PDF ---');
    await fileInput.setInputFiles(TXT_FILE);
    await sleep(500);
    await uploadBtn.click();

    await page.waitForSelector('.status-message.error', { timeout: 5000 });
    const uploadErrMsg = await page.textContent('.status-message.error');
    const nonPdfHandled = uploadErrMsg.includes('Only PDF files are supported');
    logStep('Step 12: Non-PDF Upload Error Handling', nonPdfHandled, uploadErrMsg);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step12_non_pdf_error.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 13: Negative Test — Empty Question Submission
    // -------------------------------------------------------------
    console.log('\n--- Step 13: Negative Test — Empty Question Submission ---');
    const chatInput = page.locator('.chat-input');
    await chatInput.fill('   ');
    const isSendDisabled = await page.locator('.chat-send-btn').isDisabled();
    logStep('Step 13: Empty Question Send Button Disabled', isSendDisabled, 'Button is disabled for whitespace');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step13_empty_question_disabled.png'), fullPage: true });

    // -------------------------------------------------------------
    // Step 14: Negative Test — Backend Unreachable Error Handling
    // -------------------------------------------------------------
    console.log('\n--- Step 14: Negative Test — Backend Unreachable ---');
    // We will trigger a fetch error by trying to query when backend is killed
    // Or in frontend UI, test if backend unreachable shows real error
    // Let's kill backend temporarily to test the real network failure UI message
    console.log('Stopping FastAPI server to test unreachable state...');
    const { execSync } = require('child_process');
    try {
      execSync('pkill -9 -f "uvicorn main:app"');
    } catch(e) {}
    await sleep(2000);

    await chatInput.fill('What is Mars?');
    await sleep(300);
    const sendBtn = page.locator('.chat-send-btn');
    await sendBtn.click();

    // Wait for the newest error banner to appear
    await sleep(2500);
    const lastError = page.locator('.chat-answer.chat-error').last();
    await lastError.waitFor({ state: 'visible', timeout: 10000 });
    const unreachableMsg = await lastError.textContent();
    const unreachableHandled = unreachableMsg.includes('Could not reach the backend') || unreachableMsg.includes('FastAPI server');
    logStep('Step 14: Backend Unreachable Error Handling', unreachableHandled, unreachableMsg);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step14_backend_unreachable_error.png'), fullPage: true });

    // Restart backend after test
    console.log('Restarting FastAPI backend...');
    execSync('nohup /home/sarthak-surale/Documents/Programming/Projects/RAG_Document_parser/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn_e2e.log 2>&1 &', {
      env: process.env
    });
    await sleep(3000);

  } catch (err) {
    console.error('❌ Exception during browser test:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'error_screenshot.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
    console.log('\n=============================================');
    console.log('E2E BROWSER VALIDATION SUMMARY');
    console.log('=============================================');
    let passedCount = 0;
    for (const r of results) {
      if (r.passed) passedCount++;
      console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'}: ${r.name} - ${r.details}`);
    }
    console.log(`\nTotal: ${passedCount}/${results.length} passed.`);
  }
})();
