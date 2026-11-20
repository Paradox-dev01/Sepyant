// ============================================================================
// [SEPYANT 2.0] Automation seed data + script templates (Phase 4 — automation
// framework support). Pure frontend mock data: nothing here calls a backend,
// an AI provider, or executes any code — every "generated" script is produced
// locally from deterministic, framework-specific templates.
//
// Design rules:
//  - generateScript(framework, language, testCase) is pure and deterministic:
//    the same inputs always render byte-identical output (safe for SSR).
//  - The test-case-to-script mapping is computed by locating the step marker
//    comments in the generated source (locateSections) — line numbers are
//    never hardcoded, so templates can drift without breaking the view.
//  - Every script carries honest labeling: "generated locally from templates"
//    plus the case preconditions, and stays in the 45–90 line range.
// ============================================================================

import { Braces, Globe, Globe2, MousePointer2, Smartphone, type LucideIcon } from 'lucide-react';

// ------------------------------------------------------------------- types

export type FrameworkId = 'playwright' | 'selenium' | 'appium' | 'cypress' | 'postman';

/** Language selectors offered per framework. */
export type ScriptLang = 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' | 'json';

export type AutomationPriority = 'low' | 'medium' | 'high' | 'critical';

export type AutomationTestCase = {
  id: string;
  title: string;
  project: string;
  preconditions: string;
  steps: string[];
  expected: string;
  priority: AutomationPriority;
  /** Demo fixture values the script templates embed as constants. */
  data: Record<string, string>;
};

export type FrameworkMeta = {
  id: FrameworkId;
  name: string;
  tagline: string;
  description: string;
  languages: ScriptLang[];
  icon: LucideIcon;
  focus: string;
};

/** One row of the test-case → generated-code mapping. Lines are 1-based inclusive. */
export type StepMapping = { step: string; anchor: string; lines: [number, number] };

export type GeneratedScript = {
  code: string;
  mapping: StepMapping[];
  config: { title: string; steps: string[] };
};

// -------------------------------------------------------------- frameworks

export const FRAMEWORKS: FrameworkMeta[] = [
  {
    id: 'playwright',
    name: 'Playwright',
    tagline: 'Modern web automation',
    description: 'Cross-browser end-to-end automation with auto-waiting, traces and a powerful locator API.',
    languages: ['typescript', 'javascript', 'python'],
    icon: Globe,
    focus: 'Web E2E',
  },
  {
    id: 'selenium',
    name: 'Selenium',
    tagline: 'Browser automation standard',
    description: 'The long-standing WebDriver standard for browser suites, grids and legacy stacks.',
    languages: ['java', 'python', 'csharp'],
    icon: Globe2,
    focus: 'Web & grids',
  },
  {
    id: 'appium',
    name: 'Appium',
    tagline: 'Mobile app automation',
    description: 'Native and hybrid mobile automation for iOS and Android, built on the WebDriver protocol.',
    languages: ['java', 'python'],
    icon: Smartphone,
    focus: 'Mobile',
  },
  {
    id: 'cypress',
    name: 'Cypress',
    tagline: 'Frontend testing framework',
    description: 'Developer-friendly browser tests that run in the same event loop as the application.',
    languages: ['javascript', 'typescript'],
    icon: MousePointer2,
    focus: 'Frontend',
  },
  {
    id: 'postman',
    name: 'Postman',
    tagline: 'API testing collections',
    description: 'Request collections with pm.test scripts, environments and Newman CLI runs.',
    languages: ['json'],
    icon: Braces,
    focus: 'API',
  },
];

// -------------------------------------------------------------- test cases

export const AUTOMATION_TEST_CASES: AutomationTestCase[] = [
  {
    id: 'tc-checkout-promo',
    title: 'Guest checkout applies a valid promo code',
    project: 'E-commerce Website',
    preconditions: 'Storefront is reachable and promo code SAVE10 is active for a 10 percent discount.',
    steps: [
      'Open the storefront and add two items to the cart',
      'Proceed to checkout as a guest with a valid email address',
      'Enter promo code SAVE10 in the promo field and apply it',
    ],
    expected: 'Order total shows the 10 percent discount and the confirmation page displays the reduced amount.',
    priority: 'high',
    data: { email: 'qa.guest@sepyant.dev', promoCode: 'SAVE10', cartItems: '2' },
  },
  {
    id: 'tc-login-2fa',
    title: 'Login with 2FA succeeds with a valid OTP',
    project: 'E-commerce Website',
    preconditions: 'Test account qa+2fa@sepyant.dev exists with authenticator based 2FA enabled.',
    steps: [
      'Open the login page and enter the account email and password',
      'Enter the current 6 digit OTP from the authenticator within 30 seconds',
      'Submit the OTP code for verification',
    ],
    expected: 'User lands on the account dashboard within 3 seconds of OTP verification.',
    priority: 'critical',
    data: { email: 'qa+2fa@sepyant.dev', password: 'S3pyant!Demo', otp: '314159' },
  },
  {
    id: 'tc-shipping-recalc',
    title: 'Shipping cost recalculates when the delivery country changes',
    project: 'E-commerce Website',
    preconditions: 'Cart contains at least one shippable item and flat international rates are configured.',
    steps: [
      'Open the cart and continue to the shipping step of checkout',
      'Select Germany as the delivery country with standard shipping',
      'Change the delivery country to Australia and recheck the order summary',
    ],
    expected: 'Shipping line updates to the Australia rate and the order total is recalculated without a page reload.',
    priority: 'medium',
    data: { country: 'Germany', countryAlt: 'Australia', shippingMethod: 'Standard' },
  },
  {
    id: 'tc-kyc-liveness',
    title: 'Mobile KYC liveness check offers a retry after a failed scan',
    project: 'Banking App — Mobile',
    preconditions: 'Mobile app is installed with camera permission granted and an onboarding account pending KYC.',
    steps: [
      'Start onboarding and open the identity verification liveness screen',
      'Complete the liveness scan in poor lighting so the first attempt fails',
      'Tap Retry and repeat the scan in normal lighting',
    ],
    expected: 'A failed scan shows a readable error and the retry succeeds, advancing to the document upload step.',
    priority: 'high',
    data: { scanMode: 'Liveness', retryLabel: 'Retry', docUpload: 'Passport' },
  },
  {
    id: 'tc-transfer-limit',
    title: 'Transfer above the daily limit is rejected with a clear error',
    project: 'Banking App — Mobile',
    preconditions: 'Account has a verified balance above the 5000 EUR daily transfer limit and no transfers made today.',
    steps: [
      'Log in and open the Transfers screen',
      'Enter a recipient and an amount above the daily limit (6000 EUR)',
      'Confirm the transfer with the valid PIN',
    ],
    expected: 'The transfer is rejected with an explicit limit error and no funds are debited from the balance.',
    priority: 'critical',
    data: { recipient: 'Mara Vogel', amount: '6000 EUR', pin: '4821' },
  },
  {
    id: 'tc-api-rate-limit',
    title: 'Create order API returns 429 when the rate limit is exceeded',
    project: 'E-commerce Website',
    preconditions: 'API token with the default 100 requests per minute quota is issued and staging is deployed.',
    steps: [
      'Authenticate the client and obtain a valid API token',
      'Send 110 create order requests within one minute from the same token',
      'Inspect the status code of the requests past the quota',
    ],
    expected: 'Requests past the quota return HTTP 429 with a Retry-After header and no partial orders are created.',
    priority: 'medium',
    data: { token: 'stg-api-token-2f8c', requests: '110', endpoint: '/api/orders' },
  },
];

// ---------------------------------------------------------------- helpers

/** camelCase identifier from arbitrary text: 'shipping-recalc' -> 'shippingRecalc'. */
function camel(text: string): string {
  const pascal = text
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const out = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return /^\d/.test(out) ? `step${pascal}` : out || 'generated';
}

/** PascalCase identifier: 'tc-login-2fa' -> 'Login2fa'. */
function pascal(text: string): string {
  const c = camel(text);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** snake_case identifier: 'tc-login-2fa' -> 'tc_login_2fa'. */
function snake(text: string): string {
  return text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'generated_case';
}

/** kebab-case element id hint: 'promoCode' -> 'promo-code'. */
function kebab(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
}

const ACRONYMS = new Set(['otp', 'pin', 'kyc', 'api', 'url', 'ui', 'http', 'id']);

/** Human label for a fixture key: 'promoCode' -> 'Promo code', 'otp' -> 'OTP'. */
function labelOf(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+(alt|new|field|input|value|label)$/i, '')
    .trim()
    .toLowerCase();
  if (ACRONYMS.has(spaced)) return spaced.toUpperCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function dataEntries(tc: AutomationTestCase): [string, string][] {
  return Object.entries(tc.data);
}

function dataAt(tc: AutomationTestCase, i: number): [string, string] {
  const entries = dataEntries(tc);
  return entries[i % entries.length] ?? ['value', 'demo'];
}

/** Pick the fixture entry that best matches a step (by value first, then label). */
function dataForStep(tc: AutomationTestCase, i: number): [string, string] {
  const s = tc.steps[i].toLowerCase();
  const entries = dataEntries(tc);
  const byValue = entries.find(([, v]) => v.length >= 3 && s.includes(v.toLowerCase()));
  if (byValue) return byValue;
  const byKey = entries.find(([k]) => {
    const label = labelOf(k).toLowerCase();
    return label.length >= 3 && s.includes(label);
  });
  return byKey ?? dataAt(tc, i);
}

type StepRoute = 'navigate' | 'fill' | 'select' | 'click' | 'api' | 'retry';

/** Route a step to a template action by keyword, deterministically. */
function routeOf(step: string): StepRoute {
  const s = step.toLowerCase();
  if (/\b(open|start|navigate|visit|launch)\b/.test(s)) return 'navigate';
  if (/\b(select|choose|change|pick)\b/.test(s)) return 'select';
  if (/\b(enter|fill|type|input)\b/.test(s)) return 'fill';
  if (/\b(send|request|inspect|count|call)\b/.test(s)) return 'api';
  if (/\b(retry|repeat|rescan)\b/.test(s)) return 'retry';
  return 'click';
}

/** A plausible button caption for click-style steps. */
function buttonLabel(step: string, tc: AutomationTestCase, i: number): string {
  const s = step.toLowerCase();
  const table: [RegExp, string][] = [
    [/\b(proceed|continue)\b/, 'Continue'],
    [/\b(apply|promo)\b/, 'Apply'],
    [/\b(submit|verification|verify)\b/, 'Submit'],
    [/\b(confirm)\b/, 'Confirm'],
    [/\b(log in|login|sign in)\b/, 'Sign in'],
    [/\b(checkout)\b/, 'Checkout'],
    [/\b(retry|repeat|again)\b/, 'Retry'],
  ];
  for (const [re, label] of table) if (re.test(s)) return label;
  return labelOf(dataForStep(tc, i)[0]);
}

/** Trim long expected-result text for embedding in assertion strings. */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

// --------------------------------------------------------- line mapping

/**
 * Locate 1-based inclusive [start, end] line ranges for each marker inside the
 * generated code. A section spans from its marker line to the line before the
 * next marker (trailing blank lines trimmed). Markers that never appear are
 * skipped, so template drift can never crash the view.
 */
function locateSections(code: string, markers: string[]): Map<string, [number, number]> {
  const lines = code.split('\n');
  const found = markers
    .map((marker) => ({ marker, at: lines.findIndex((l) => l.includes(marker)) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);

  const result = new Map<string, [number, number]>();
  for (let i = 0; i < found.length; i++) {
    const start = found[i].at + 1;
    const rawEnd = i + 1 < found.length ? found[i + 1].at : lines.length;
    let end = rawEnd;
    while (end > start && lines[end - 1].trim() === '') end -= 1;
    result.set(found[i].marker, [start, end]);
  }
  return result;
}

function mappingFor(
  tc: AutomationTestCase,
  code: string,
  stepAnchor: (n: number) => string,
  finalAnchor: string
): StepMapping[] {
  const sections = locateSections(code, [...tc.steps.map((_, i) => stepAnchor(i + 1)), finalAnchor]);
  const out: StepMapping[] = [];
  tc.steps.forEach((step, i) => {
    const anchor = stepAnchor(i + 1);
    const range = sections.get(anchor);
    if (range) out.push({ step, anchor, lines: range });
  });
  return out;
}

// ------------------------------------------------------ per-step actions

function playwrightStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key] = dataForStep(tc, i);
  const label = labelOf(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `  await page.goto(BASE_URL + '/');`,
        `  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();`,
      ];
    case 'fill':
      return [
        `  const ${camel(key)}Field = page.getByLabel('${label}');`,
        `  await ${camel(key)}Field.fill(DATA.${camel(key)});`,
      ];
    case 'select':
      return [`  await page.getByLabel('${label}').selectOption({ label: DATA.${camel(key)} });`];
    case 'api':
      return [
        `  const health = await page.request.get(BASE_URL + '/api/health');`,
        `  expect(health.ok()).toBeTruthy();`,
      ];
    case 'retry':
      return [`  await page.getByRole('button', { name: /retry|try again/i }).click();`];
    default:
      return [`  await page.getByRole('button', { name: '${buttonLabel(step, tc, i)}' }).click();`];
  }
}

function seleniumJavaStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key, value] = dataForStep(tc, i);
  const id = kebab(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `        driver.get(BASE_URL + "/");`,
        `        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("h1")));`,
      ];
    case 'fill':
      return [
        `        WebElement ${camel(key)}Field = driver.findElement(By.id("${id}"));`,
        `        ${camel(key)}Field.sendKeys("${value}");`,
      ];
    case 'select':
      return [`        new Select(driver.findElement(By.id("${id}"))).selectByVisibleText("${value}");`];
    case 'api':
      return [
        `        driver.get(BASE_URL + "/api/health");`,
        `        wait.until(ExpectedConditions.urlContains("/api/"));`,
      ];
    case 'retry':
      return [`        wait.until(ExpectedConditions.elementToBeClickable(By.id("retry-button"))).click();`];
    default:
      return [`        wait.until(ExpectedConditions.elementToBeClickable(By.id("${id}-button"))).click();`];
  }
}

function seleniumPythonStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key, value] = dataForStep(tc, i);
  const id = kebab(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `    driver.get(BASE_URL + "/")`,
        `    wait.until(ec.visibility_of_element_located((By.CSS_SELECTOR, "h1")))`,
      ];
    case 'fill':
      return [
        `    field = driver.find_element(By.ID, "${id}")`,
        `    field.send_keys("${value}")`,
      ];
    case 'select':
      return [`    Select(driver.find_element(By.ID, "${id}")).select_by_visible_text("${value}")`];
    case 'api':
      return [
        `    driver.get(BASE_URL + "/api/health")`,
        `    wait.until(ec.url_contains("/api/"))`,
      ];
    case 'retry':
      return [`    wait.until(ec.element_to_be_clickable((By.ID, "retry-button"))).click()`];
    default:
      return [`    wait.until(ec.element_to_be_clickable((By.ID, "${id}-button"))).click()`];
  }
}

function seleniumCsharpStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key, value] = dataForStep(tc, i);
  const id = kebab(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `            _driver.Navigate().GoToUrl(BaseUrl + "/");`,
        `            _wait.Until(d => d.FindElement(By.CssSelector("h1")).Displayed);`,
      ];
    case 'fill':
      return [
        `            var ${pascal(key)}Field = _driver.FindElement(By.Id("${id}"));`,
        `            ${pascal(key)}Field.SendKeys("${value}");`,
      ];
    case 'select':
      return [`            new SelectElement(_driver.FindElement(By.Id("${id}"))).SelectByText("${value}");`];
    case 'api':
      return [
        `            _driver.Navigate().GoToUrl(BaseUrl + "/api/health");`,
        `            _wait.Until(d => d.Url.Contains("/api/"));`,
      ];
    case 'retry':
      return [`            _driver.FindElement(By.Id("retry-button")).Click();`];
    default:
      return [`            _driver.FindElement(By.Id("${id}-button")).Click();`];
  }
}

function appiumJavaStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key] = dataForStep(tc, i);
  const id = kebab(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `        driver.findElement(AppiumBy.accessibilityId("${id}-start")).click();`,
        `        Assertions.assertTrue(driver.findElement(AppiumBy.accessibilityId("${id}-screen")).isDisplayed());`,
      ];
    case 'fill':
      return [`        driver.findElement(AppiumBy.accessibilityId("${id}-input")).sendKeys("${dataForStep(tc, i)[1]}");`];
    case 'select':
      return [`        driver.findElement(AppiumBy.id("dev.sepyant.banking:id/${id}")).click();`];
    case 'retry':
      return [`        driver.findElement(AppiumBy.accessibilityId("retry-button")).click();`];
    default:
      return [`        driver.findElement(AppiumBy.accessibilityId("${id}-button")).click();`];
  }
}

function appiumPythonStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key, value] = dataForStep(tc, i);
  const id = kebab(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "${id}-start").click()`,
        `    assert driver.find_element(AppiumBy.ACCESSIBILITY_ID, "${id}-screen").is_displayed()`,
      ];
    case 'fill':
      return [`    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "${id}-input").send_keys("${value}")`];
    case 'select':
      return [`    driver.find_element(AppiumBy.ID, "dev.sepyant.banking:id/${id}").click()`];
    case 'retry':
      return [`    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "retry-button").click()`];
    default:
      return [`    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "${id}-button").click()`];
  }
}

function cypressStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key, value] = dataForStep(tc, i);
  const id = kebab(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `    cy.visit(BASE_URL + '/');`,
        `    cy.get('h1').should('be.visible');`,
      ];
    case 'fill':
      return [`    cy.get('[data-cy="${id}"]').clear().type('${value}');`];
    case 'select':
      return [`    cy.get('[data-cy="${id}"]').select('${value}');`];
    case 'api':
      return [`    cy.request('GET', BASE_URL + '/api/health').its('status').should('eq', 200);`];
    case 'retry':
      return [`    cy.contains('button', /retry|try again/i).click();`];
    default:
      return [`    cy.contains('button', '${buttonLabel(step, tc, i)}').click();`];
  }
}

// ---------------------------------------------------- framework templates

function playwrightScript(tc: AutomationTestCase, lang: 'typescript' | 'javascript'): string {
  const isTs = lang === 'typescript';
  const dataLines = [
    ...dataEntries(tc).map(([k, v]) => `  ${camel(k)}: '${v}',`),
    `  resultSummary: 'result-summary',`,
  ];
  const stepSections = tc.steps.map((step, i) => [`  // Step ${i + 1}: ${step}`, ...playwrightStepLines(tc, i), '']);
  const lines = [
    `/**`,
    ` * SEPYANT automation template — Playwright (${isTs ? 'TypeScript' : 'JavaScript'})`,
    ` * Case: ${tc.title}`,
    ` * Project: ${tc.project} · Priority: ${tc.priority}`,
    ` *`,
    ` * Preconditions: ${tc.preconditions}`,
    ` * Locators use role/label queries against the SEPYANT staging fixtures.`,
    ` * Generated locally from templates — review before committing to a suite.`,
    ` */`,
    isTs ? `import { test, expect } from '@playwright/test';` : `const { test, expect } = require('@playwright/test');`,
    ``,
    `const BASE_URL = 'https://staging.sepyant.dev';`,
    ``,
    `// Demo fixture values from the SEPYANT mock data set — wire these to your test data source.`,
    `const DATA = {`,
    ...dataLines,
    isTs ? `} as const;` : `};`,
    ``,
    `test.use({ viewport: { width: 1440, height: 900 } });`,
    ``,
    `test('@regression ${tc.id}: ${tc.title}', async ({ page }) => {`,
    `  test.setTimeout(60_000);`,
    ``,
    ...stepSections.flat(),
    `  // Expected result: ${tc.expected}`,
    `  await expect(page.getByTestId(DATA.resultSummary)).toContainText('${shorten(tc.expected, 44)}');`,
    `  await expect(page).toHaveURL(/confirmation/);`,
    `});`,
    ``,
    `/*`,
    ` * Run locally:`,
    ` *   npx playwright test tests/${tc.id}.${isTs ? 'spec.ts' : 'spec.js'} --project=chromium`,
    ` */`,
  ];
  return lines.join('\n');
}

function playwrightPythonScript(tc: AutomationTestCase): string {
  const stepSections = tc.steps.map((step, i) => [`    # Step ${i + 1}: ${step}`, ...playwrightPythonStepLines(tc, i), '']);
  const lines = [
    `"""SEPYANT automation template — Playwright (Python, pytest)`,
    `Case: ${tc.title}`,
    `Project: ${tc.project} · Priority: ${tc.priority}`,
    `Template: pytest-playwright, sync API.`,
    ``,
    `Preconditions: ${tc.preconditions}`,
    `Locators use role/label queries against the SEPYANT staging fixtures.`,
    `Generated locally from templates — review before committing to a suite.`,
    `"""`,
    `import pytest`,
    `from playwright.sync_api import Page, expect`,
    ``,
    ``,
    `BASE_URL = "https://staging.sepyant.dev"`,
    ``,
    ``,
    `@pytest.fixture`,
    `def page(browser_context) -> Page:`,
    `    context = browser_context.new_page()`,
    `    context.set_viewport_size({"width": 1440, "height": 900})`,
    `    yield context`,
    `    context.close()`,
    ``,
    ``,
    `def test_${snake(tc.id)}(page: Page) -> None:`,
    `    """${tc.title} — assembled from SEPYANT mock data."""`,
    `    page.set_default_timeout(10_000)`,
    ...stepSections.flat(),
    `    # Expected result: ${tc.expected}`,
    `    summary = page.get_by_test_id("result-summary")`,
    `    expect(summary).to_contain_text("${shorten(tc.expected, 44)}")`,
    `    expect(page).to_have_url(re.compile("confirmation"))`,
    ``,
    ``,
    `# Run locally:`,
    `#   pytest -v tests/${tc.id}.py --headed`,
  ];
  return lines.join('\n');
}

function playwrightPythonStepLines(tc: AutomationTestCase, i: number): string[] {
  const step = tc.steps[i];
  const [key, value] = dataForStep(tc, i);
  const label = labelOf(key);
  switch (routeOf(step)) {
    case 'navigate':
      return [
        `    page.goto(BASE_URL + "/")`,
        `    expect(page.get_by_role("heading", level=1)).to_be_visible()`,
      ];
    case 'fill':
      return [
        `    page.get_by_label("${label}").fill("${value}")`,
      ];
    case 'select':
      return [`    page.get_by_label("${label}").select_option("${value}")`];
    case 'api':
      return [
        `    response = page.request.get(BASE_URL + "/api/health")`,
        `    assert response.ok`,
      ];
    case 'retry':
      return [`    page.get_by_role("button", name=re.compile("retry|try again", re.I)).click()`];
    default:
      return [`    page.get_by_role("button", name="${buttonLabel(step, tc, i)}").click()`];
  }
}

function seleniumJavaScript(tc: AutomationTestCase): string {
  const className = pascal(tc.id.replace(/^tc-/, '')) || 'GeneratedCase';
  const methodName = camel(tc.id.replace(/^tc-/, '')) || 'generatedCase';
  const usesSelect = tc.steps.some((s) => routeOf(s) === 'select');
  const stepSections = tc.steps.map((step, i) => [`        // Step ${i + 1}: ${step}`, ...seleniumJavaStepLines(tc, i), '']);
  const lines = [
    `/*`,
    ` * SEPYANT automation template — Selenium WebDriver (Java, JUnit 5)`,
    ` * Case: ${tc.title}`,
    ` * Project: ${tc.project} · Priority: ${tc.priority}`,
    ` *`,
    ` * Preconditions: ${tc.preconditions}`,
    ` * Locators are placeholder By.id queries — map them to your real markup.`,
    ` * Generated locally from templates — review before committing to a suite.`,
    ` */`,
    `package dev.sepyant.generated;`,
    ``,
    `import io.github.bonigarcia.wdm.WebDriverManager;`,
    `import org.junit.jupiter.api.AfterEach;`,
    `import org.junit.jupiter.api.Assertions;`,
    `import org.junit.jupiter.api.BeforeEach;`,
    `import org.junit.jupiter.api.Test;`,
    `import org.openqa.selenium.By;`,
    `import org.openqa.selenium.WebDriver;`,
    `import org.openqa.selenium.WebElement;`,
    `import org.openqa.selenium.chrome.ChromeDriver;`,
    `import org.openqa.selenium.support.ui.ExpectedConditions;`,
    `import org.openqa.selenium.support.ui.WebDriverWait;`,
    ...(usesSelect ? [`import org.openqa.selenium.support.ui.Select;`] : []),
    ``,
    `import java.time.Duration;`,
    ``,
    `public class ${className}Test {`,
    ``,
    `    private static final String BASE_URL = "https://staging.sepyant.dev";`,
    ``,
    `    private WebDriver driver;`,
    `    private WebDriverWait wait;`,
    ``,
    `    @BeforeEach`,
    `    void setUp() {`,
    `        WebDriverManager.chromedriver().setup();`,
    `        driver = new ChromeDriver();`,
    `        wait = new WebDriverWait(driver, Duration.ofSeconds(10));`,
    `        driver.manage().window().maximize();`,
    `    }`,
    ``,
    `    @Test`,
    `    void ${methodName}() {`,
    ...stepSections.flat(),
    `        // Expected result: ${tc.expected}`,
    `        WebElement resultSummary = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-test='result-summary']")));`,
    `        Assertions.assertTrue(resultSummary.getText().contains("${shorten(tc.expected, 40)}"));`,
    `    }`,
    ``,
    `    @AfterEach`,
    `    void tearDown() {`,
    `        if (driver != null) {`,
    `            driver.quit();`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `/*`,
    ` * Run locally:`,
    ` *   mvn -Dtest=${className}Test test`,
    ` *   (requires selenium-java, junit-jupiter and webdrivermanager on the test classpath)`,
    ` */`,
  ];
  return lines.join('\n');
}

function seleniumPythonScript(tc: AutomationTestCase): string {
  const usesSelect = tc.steps.some((s) => routeOf(s) === 'select');
  const uiImport = usesSelect
    ? `from selenium.webdriver.support.ui import Select, WebDriverWait`
    : `from selenium.webdriver.support.ui import WebDriverWait`;
  const stepSections = tc.steps.map((step, i) => [`    # Step ${i + 1}: ${step}`, ...seleniumPythonStepLines(tc, i), '']);
  const lines = [
    `"""SEPYANT automation template — Selenium WebDriver (Python, pytest)`,
    `Case: ${tc.title}`,
    `Project: ${tc.project} · Priority: ${tc.priority}`,
    ``,
    `Preconditions: ${tc.preconditions}`,
    `Locators are placeholder queries — map them to your real markup.`,
    `Generated locally from templates — review before committing to a suite.`,
    `"""`,
    `import pytest`,
    `from selenium import webdriver`,
    `from selenium.webdriver.common.by import By`,
    `from selenium.webdriver.support import expected_conditions as ec`,
    uiImport,
    ``,
    ``,
    `BASE_URL = "https://staging.sepyant.dev"`,
    ``,
    ``,
    `@pytest.fixture`,
    `def driver():`,
    `    options = webdriver.ChromeOptions()`,
    `    options.add_argument("--window-size=1440,900")`,
    `    driver = webdriver.Chrome(options=options)`,
    `    driver.implicitly_wait(3)`,
    `    yield driver`,
    `    driver.quit()`,
    ``,
    ``,
    `def test_${snake(tc.id)}(driver):`,
    `    """${tc.title} — assembled from SEPYANT mock data."""`,
    `    wait = WebDriverWait(driver, 10)`,
    ...stepSections.flat(),
    `    # Expected result: ${tc.expected}`,
    `    summary = wait.until(`,
    `        ec.visibility_of_element_located((By.CSS_SELECTOR, "[data-test='result-summary']"))`,
    `    )`,
    `    assert "${shorten(tc.expected, 40)}" in summary.text`,
    ``,
    ``,
    `# Run locally:`,
    `#   pytest -v tests/${tc.id}.py`,
  ];
  return lines.join('\n');
}

function seleniumCsharpScript(tc: AutomationTestCase): string {
  const className = pascal(tc.id.replace(/^tc-/, '')) || 'GeneratedCase';
  const stepSections = tc.steps.map((step, i) => [`            // Step ${i + 1}: ${step}`, ...seleniumCsharpStepLines(tc, i), '']);
  const lines = [
    `/*`,
    ` * SEPYANT automation template — Selenium WebDriver (C#, NUnit)`,
    ` * Case: ${tc.title}`,
    ` * Project: ${tc.project} · Priority: ${tc.priority}`,
    ` *`,
    ` * Preconditions: ${tc.preconditions}`,
    ` * Locators are placeholder By.Id queries — map them to your real markup.`,
    ` * Generated locally from templates — review before committing to a suite.`,
    ` */`,
    `using System;`,
    `using NUnit.Framework;`,
    `using OpenQA.Selenium;`,
    `using OpenQA.Selenium.Chrome;`,
    `using OpenQA.Selenium.Support.UI;`,
    ``,
    `namespace Sepyant.Generated`,
    `{`,
    `    [TestFixture]`,
    `    public class ${className}Tests`,
    `    {`,
    `        private const string BaseUrl = "https://staging.sepyant.dev";`,
    ``,
    `        private IWebDriver _driver = null!;`,
    `        private WebDriverWait _wait = null!;`,
    ``,
    `        [SetUp]`,
    `        public void SetUp()`,
    `        {`,
    `            _driver = new ChromeDriver();`,
    `            _wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));`,
    `            _driver.Manage().Window.Maximize();`,
    `        }`,
    ``,
    `        [Test]`,
    `        public void ${className}()`,
    `        {`,
    ...stepSections.flat(),
    `            // Expected result: ${tc.expected}`,
    `            var resultSummary = _wait.Until(d => d.FindElement(By.CssSelector("[data-test='result-summary']")));`,
    `            StringAssert.Contains("${shorten(tc.expected, 40)}", resultSummary.Text);`,
    `        }`,
    ``,
    `        [TearDown]`,
    `        public void TearDown()`,
    `        {`,
    `            _driver.Quit();`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `/*`,
    ` * Run locally:`,
    ` *   dotnet test --filter ${className}Tests`,
    ` */`,
  ];
  return lines.join('\n');
}

function appiumJavaScript(tc: AutomationTestCase): string {
  const className = pascal(tc.id.replace(/^tc-/, '')) || 'GeneratedCase';
  const methodName = camel(tc.id.replace(/^tc-/, '')) || 'generatedCase';
  const stepSections = tc.steps.map((step, i) => [`        // Step ${i + 1}: ${step}`, ...appiumJavaStepLines(tc, i), '']);
  const lines = [
    `/*`,
    ` * SEPYANT automation template — Appium (Java, JUnit 5, UiAutomator2)`,
    ` * Case: ${tc.title}`,
    ` * Project: ${tc.project} · Priority: ${tc.priority}`,
    ` *`,
    ` * Preconditions: ${tc.preconditions}`,
    ` * Accessibility ids are placeholders — align them with the app's labels.`,
    ` * Generated locally from templates — review before committing to a suite.`,
    ` */`,
    `package dev.sepyant.generated;`,
    ``,
    `import io.appium.java_client.AppiumBy;`,
    `import io.appium.java_client.AppiumDriver;`,
    `import io.appium.java_client.android.AndroidDriver;`,
    `import org.junit.jupiter.api.AfterEach;`,
    `import org.junit.jupiter.api.Assertions;`,
    `import org.junit.jupiter.api.BeforeEach;`,
    `import org.junit.jupiter.api.Test;`,
    `import org.openqa.selenium.WebElement;`,
    `import org.openqa.selenium.remote.DesiredCapabilities;`,
    ``,
    `import java.net.URL;`,
    `import java.time.Duration;`,
    ``,
    `public class ${className}Test {`,
    ``,
    `    private static final String APPIUM_SERVER = "http://127.0.0.1:4723";`,
    ``,
    `    private AppiumDriver driver;`,
    ``,
    `    @BeforeEach`,
    `    void setUp() throws Exception {`,
    `        DesiredCapabilities caps = new DesiredCapabilities();`,
    `        caps.setCapability("platformName", "Android");`,
    `        caps.setCapability("appium:deviceName", "Pixel 7 - API 34");`,
    `        caps.setCapability("appium:automationName", "UiAutomator2");`,
    `        caps.setCapability("appium:appPackage", "dev.sepyant.banking");`,
    `        caps.setCapability("appium:appActivity", ".onboarding.OnboardingActivity");`,
    `        driver = new AndroidDriver(new URL(APPIUM_SERVER), caps);`,
    `        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(5));`,
    `    }`,
    ``,
    `    @Test`,
    `    void ${methodName}() {`,
    ...stepSections.flat(),
    `        // Expected result: ${tc.expected}`,
    `        WebElement status = driver.findElement(AppiumBy.accessibilityId("result-status"));`,
    `        Assertions.assertTrue(status.getText().contains("${shorten(tc.expected, 40)}"));`,
    `    }`,
    ``,
    `    @AfterEach`,
    `    void tearDown() {`,
    `        if (driver != null) {`,
    `            driver.quit();`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `/*`,
    ` * Run locally:`,
    ` *   mvn -Dtest=${className}Test test`,
    ` *   (Appium 2 server must be running: appium --port 4723)`,
    ` */`,
  ];
  return lines.join('\n');
}

function appiumPythonScript(tc: AutomationTestCase): string {
  const stepSections = tc.steps.map((step, i) => [`    # Step ${i + 1}: ${step}`, ...appiumPythonStepLines(tc, i), '']);
  const lines = [
    `"""SEPYANT automation template — Appium (Python, pytest, UiAutomator2)`,
    `Case: ${tc.title}`,
    `Project: ${tc.project} · Priority: ${tc.priority}`,
    ``,
    `Preconditions: ${tc.preconditions}`,
    `Accessibility ids are placeholders — align them with the app's labels.`,
    `Generated locally from templates — review before committing to a suite.`,
    `"""`,
    `import pytest`,
    `from appium import webdriver`,
    `from appium.options.android import UiAutomator2Options`,
    `from appium.webdriver.common.appiumby import AppiumBy`,
    ``,
    ``,
    `APPIUM_SERVER = "http://127.0.0.1:4723"`,
    ``,
    ``,
    `@pytest.fixture`,
    `def driver():`,
    `    options = UiAutomator2Options()`,
    `    options.platform_name = "Android"`,
    `    options.device_name = "Pixel 7 - API 34"`,
    `    options.automation_name = "UiAutomator2"`,
    `    options.app_package = "dev.sepyant.banking"`,
    `    options.app_activity = ".onboarding.OnboardingActivity"`,
    `    options.new_command_timeout = 120`,
    `    driver = webdriver.Remote(APPIUM_SERVER, options=options)`,
    `    driver.implicitly_wait(5)`,
    `    yield driver`,
    `    driver.quit()`,
    ``,
    ``,
    `def test_${snake(tc.id)}(driver):`,
    `    """${tc.title} — assembled from SEPYANT mock data."""`,
    ...stepSections.flat(),
    `    # Expected result: ${tc.expected}`,
    `    status = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "result-status")`,
    `    assert "${shorten(tc.expected, 40)}" in status.text`,
    ``,
    ``,
    `# Run locally:`,
    `#   pytest -v tests/${tc.id}.py`,
    `#   (Appium 2 server must be running: appium --port 4723)`,
  ];
  return lines.join('\n');
}

function cypressScript(tc: AutomationTestCase, lang: 'javascript' | 'typescript'): string {
  const ext = lang === 'typescript' ? 'ts' : 'js';
  const stepSections = tc.steps.map((step, i) => [`    // Step ${i + 1}: ${step}`, ...cypressStepLines(tc, i), '']);
  const lines = [
    `/*`,
    ` * SEPYANT automation template — Cypress (${lang === 'typescript' ? 'TypeScript' : 'JavaScript'})`,
    ` * Case: ${tc.title}`,
    ` * Project: ${tc.project} · Priority: ${tc.priority}`,
    ` *`,
    ` * Preconditions: ${tc.preconditions}`,
    ` * data-cy attributes are placeholders — align them with your app's test hooks.`,
    ` * Generated locally from templates — review before committing to a suite.`,
    ` */`,
    `/// <reference types="cypress" />`,
    ``,
    `const BASE_URL = 'https://staging.sepyant.dev';`,
    ``,
    `Cypress.config('defaultCommandTimeout', 8000);`,
    `Cypress.config('viewportWidth', 1440);`,
    `Cypress.config('viewportHeight', 900);`,
    ``,
    `describe('${tc.title}', () => {`,
    `  beforeEach(() => {`,
    `    cy.session('sepyant-guest', () => {`,
    `      cy.visit(BASE_URL);`,
    `    });`,
    `  });`,
    ``,
    `  it('passes every step — ${tc.project}', () => {`,
    ...stepSections.flat(),
    `    // Expected result: ${tc.expected}`,
    `    cy.get('[data-cy="result-summary"]').should('be.visible');`,
    `    cy.get('[data-cy="result-summary"]').should('contain.text', '${shorten(tc.expected, 44)}');`,
    `  });`,
    `});`,
    ``,
    `/*`,
    ` * Run locally:`,
    ` *   npx cypress run --spec cypress/e2e/${tc.id}.cy.${ext}`,
    ` *   (or explore interactively: npx cypress open)`,
    ` */`,
  ];
  return lines.join('\n');
}

function postmanCollection(tc: AutomationTestCase): string {
  const items = tc.steps.map((step, i) => {
    const route = routeOf(step);
    const method = route === 'navigate' ? 'GET' : 'POST';
    const [, value] = dataForStep(tc, i);
    return {
      name: `Step ${i + 1}: ${step}`,
      request: {
        method,
        header: { Authorization: 'Bearer {{apiToken}}' },
        ...(method === 'POST' ? { body: { mode: 'raw', raw: `{ "fixture": "${value}" }` } } : {}),
        url: `{{baseUrl}}/api/generated/${tc.id}/step-${i + 1}`,
      },
      response: [],
    };
  });

  const collection = {
    info: {
      _postman_id: `sepyant-${tc.id}`,
      name: `SEPYANT — ${tc.title}`,
      description: 'Generated locally from templates — demo output, not executed.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: 'https://staging.sepyant.dev' },
      { key: 'apiToken', value: 'REPLACE_WITH_TOKEN' },
    ],
    item: [
      ...items,
      {
        name: 'Verify expected result',
        event: [
          {
            listen: 'test',
            script: {
              exec: [
                `// Expected result: ${shorten(tc.expected, 70)}`,
                `pm.test('meets the expected result', () => {`,
                `  pm.expect(pm.response.code).to.be.oneOf([200, 201, 202, 429]);`,
                `});`,
              ],
            },
          },
        ],
        request: {
          method: 'GET',
          header: { Authorization: 'Bearer {{apiToken}}' },
          url: `{{baseUrl}}/api/generated/${tc.id}/verify`,
        },
        response: [],
      },
    ],
  };

  // Pretty-printed with 2-space indent, matching the Postman export format.
  return JSON.stringify(collection, null, 2);
}

// ------------------------------------------------------------- generator

type BuiltScript = {
  code: string;
  stepAnchor: (n: number) => string;
  finalAnchor: string;
};

function buildCode(framework: FrameworkId, language: ScriptLang, tc: AutomationTestCase): BuiltScript {
  switch (framework) {
    case 'playwright':
      if (language === 'python') {
        return { code: playwrightPythonScript(tc), stepAnchor: (n) => `# Step ${n}:`, finalAnchor: '# Expected result:' };
      }
      return {
        code: playwrightScript(tc, language === 'javascript' ? 'javascript' : 'typescript'),
        stepAnchor: (n) => `// Step ${n}:`,
        finalAnchor: '// Expected result:',
      };
    case 'selenium':
      if (language === 'java') {
        return { code: seleniumJavaScript(tc), stepAnchor: (n) => `// Step ${n}:`, finalAnchor: '// Expected result:' };
      }
      if (language === 'csharp') {
        return { code: seleniumCsharpScript(tc), stepAnchor: (n) => `// Step ${n}:`, finalAnchor: '// Expected result:' };
      }
      return { code: seleniumPythonScript(tc), stepAnchor: (n) => `# Step ${n}:`, finalAnchor: '# Expected result:' };
    case 'appium':
      if (language === 'java') {
        return { code: appiumJavaScript(tc), stepAnchor: (n) => `// Step ${n}:`, finalAnchor: '// Expected result:' };
      }
      return { code: appiumPythonScript(tc), stepAnchor: (n) => `# Step ${n}:`, finalAnchor: '# Expected result:' };
    case 'cypress':
      return {
        code: cypressScript(tc, language === 'typescript' ? 'typescript' : 'javascript'),
        stepAnchor: (n) => `// Step ${n}:`,
        finalAnchor: '// Expected result:',
      };
    case 'postman':
      return {
        code: postmanCollection(tc),
        stepAnchor: (n) => `"name": "Step ${n}:`,
        finalAnchor: '"name": "Verify expected result"',
      };
  }
}

/**
 * Build the mock automation script for a framework + language + case.
 * Deterministic and pure — the same inputs always produce the same code.
 */
export function generateScript(framework: FrameworkId, language: ScriptLang, testCase: AutomationTestCase): GeneratedScript {
  const built = buildCode(framework, language, testCase);
  return {
    code: built.code,
    mapping: mappingFor(testCase, built.code, built.stepAnchor, built.finalAnchor),
    config: CONFIG_STEPS[framework],
  };
}

// ------------------------------------------------------------ setup meta

export const CONFIG_STEPS: Record<FrameworkId, { title: string; steps: string[] }> = {
  playwright: {
    title: 'Playwright setup',
    steps: [
      'Create the project: npm init -y',
      'Install the runner: npm i -D @playwright/test',
      'Install browsers: npx playwright install chromium',
      'Add a playwright.config.ts with baseURL https://staging.sepyant.dev',
      'Drop the generated file into tests/ and run it',
    ],
  },
  selenium: {
    title: 'Selenium setup',
    steps: [
      'Create a Maven/pytest/NUnit project for your language',
      'Add selenium-java + webdrivermanager (Java), selenium (Python) or Selenium.WebDriver (C#)',
      'Save the generated file into your test tree',
      'Review the placeholder By.id / By.CSS_SELECTOR locators against your markup',
    ],
  },
  appium: {
    title: 'Appium setup',
    steps: [
      'Install the Appium 2 server: npm i -g appium',
      'Add the driver: appium driver install uiautomator2',
      'Start a device or emulator, then run appium --port 4723',
      'Save the generated file into your Maven/pytest test tree',
    ],
  },
  cypress: {
    title: 'Cypress setup',
    steps: [
      'Install: npm i -D cypress',
      'Open once to scaffold: npx cypress open',
      'Save the spec under cypress/e2e/',
      'Add data-cy attributes where the template relies on them',
    ],
  },
  postman: {
    title: 'Postman setup',
    steps: [
      'Import the collection JSON into Postman',
      'Set the baseUrl and apiToken collection variables',
      'Review the request URLs — templates use placeholder paths',
      'Run headless with Newman from the CLI',
    ],
  },
};

export const RUN_COMMAND: Record<FrameworkId, Partial<Record<ScriptLang, string>> & { _default?: string }> = {
  playwright: {
    typescript: 'npx playwright test --project=chromium',
    javascript: 'npx playwright test --project=chromium',
    python: 'pytest -v tests/ --headed',
    _default: 'npx playwright test',
  },
  selenium: {
    java: 'mvn -Dtest=<Class>Test test',
    python: 'pytest -v tests/web',
    csharp: 'dotnet test',
    _default: 'mvn test',
  },
  appium: {
    java: 'mvn -Dtest=<Class>Test test',
    python: 'pytest -v tests/appium',
    _default: 'pytest -v tests/appium',
  },
  cypress: {
    javascript: 'npx cypress run',
    typescript: 'npx cypress run',
    _default: 'npx cypress run',
  },
  postman: {
    json: 'newman run sepyant-postman-<caseid>.postman_collection.json',
    _default: 'newman run sepyant-postman-<caseid>.postman_collection.json',
  },
};

export function runCommandFor(framework: FrameworkId, language: ScriptLang): string {
  const perLang = RUN_COMMAND[framework];
  return perLang[language] ?? perLang._default ?? '';
}

export const SCRIPT_EXT: Record<FrameworkId, Partial<Record<ScriptLang, string>>> = {
  playwright: { typescript: 'spec.ts', javascript: 'spec.js', python: 'py' },
  selenium: { java: 'java', python: 'py', csharp: 'cs' },
  appium: { java: 'java', python: 'py' },
  cypress: { javascript: 'cy.js', typescript: 'cy.ts' },
  postman: { json: 'postman_collection.json' },
};

export function scriptFilename(framework: FrameworkId, language: ScriptLang, caseId: string): string {
  const ext = SCRIPT_EXT[framework][language] ?? 'txt';
  return `sepyant-${framework}-${caseId}.${ext}`;
}
