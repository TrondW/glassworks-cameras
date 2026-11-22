// Cross-platform headless Chrome / Chromium CDP driver for WebGL camera audits.
// Auto-detects Chrome/Chromium on macOS (Metal GPU), Linux/CI (SwiftShader/ANGLE), and Windows,
// or respects CHROME_PATH. Uses a temporary profile inside .audit-cache/chrome and closes cleanly.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
export const CACHE_DIR = process.env.AUDIT_CACHE || join(REPO_ROOT, '.audit-cache');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveChromeBinary() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      ]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ];
  for (const p of candidates) if (existsSync(p)) return p;
  for (const cmd of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const found = execFileSync('which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (found) return found;
    } catch {}
  }
  throw new Error('Could not find Chrome or Chromium. Install Chrome/Chromium or set CHROME_PATH=/path/to/chrome.');
}

/**
 * Launch headless Chrome on `url` via CDP and return { send, evaluate, net, errors, close }.
 */
export async function openPage(url, { width = 1600, height = 1000, dsf = 2, profile = 'audit', cache = false, timeout = 300 } = {}) {
  const bin = resolveChromeBinary();
  const prof = join(CACHE_DIR, 'chrome', `${profile}-${process.pid}`);
  rmSync(prof, { recursive: true, force: true });
  mkdirSync(prof, { recursive: true });
  const port = 9400 + Math.floor(Math.random() * 500);
  const isMac = process.platform === 'darwin';
  const useSoftware = Boolean(process.env.CI || process.env.SOFTWARE_GL);

  const flags = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${prof}`,
    `--window-size=${width},${height}`,
    ...(isMac
      ? ['--use-angle=metal', '--disable-features=MacAppCodeSignClone', '--enable-gpu']
      : useSoftware
        ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        : ['--no-sandbox', '--enable-gpu']),
    '--ignore-gpu-blocklist',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-precise-memory-info',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--hide-scrollbars',
    'about:blank',
  ];

  const chrome = spawn(bin, flags, { stdio: 'ignore' });
  const kill = setTimeout(() => { console.error('TIMEOUT'); chrome.kill(); process.exit(2); }, timeout * 1000);
  let target;
  const startTries = 5 * (+process.env.CHROME_START_S || 30);
  for (let i = 0; i < startTries && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) {
    clearTimeout(kill);
    chrome.kill();
    throw new Error(`Chrome did not start (binary: ${bin})`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map(), reqs = new Map(), net = [], errors = [], listeners = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Network.responseReceived') reqs.set(m.params.requestId, { url: m.params.response.url, status: m.params.response.status });
    if (m.method === 'Network.loadingFinished') { const r = reqs.get(m.params.requestId); if (r) net.push({ ...r, bytes: m.params.encodedDataLength }); }
    if (m.method === 'Network.loadingFailed') net.push({ ...(reqs.get(m.params.requestId) || {}), failed: m.params.errorText });
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (m.params.type === 'error') errors.push(t.slice(0, 300));
      for (const f of listeners) f(m.params.type, t);
    }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error((r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 800));
    return r.result?.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  if (!cache) await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: false });
  if (url && url !== 'about:blank') await send('Page.navigate', { url });

  return {
    send, evaluate, net, errors, onConsole: (f) => listeners.push(f),
    async close() {
      clearTimeout(kill);
      await send('Browser.close').catch(() => {});
      await sleep(300);
      chrome.kill();
      await sleep(300);
      rmSync(prof, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    },
  };
}
