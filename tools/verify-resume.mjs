// Run against a local server and a headless browser with remote debugging enabled.
// node tools/verify-resume.mjs [debugPort=9224] [site=http://127.0.0.1:8765]
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const [, source] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(source);
const port = process.argv[2] || 9224;
const site = process.argv[3] || 'http://127.0.0.1:8765';
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(target => target.type === 'page');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, {once: true}));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({data}) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400)
    errors.push(message.params.response.url + ': ' + message.params.response.status);
  if (!message.id) return;
  const entry = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) entry.reject(message.error); else entry.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, {resolve, reject});
  socket.send(JSON.stringify({id, method, params}));
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const previews = new URL('./previews/', import.meta.url);
await mkdir(previews, {recursive: true});
const screenshot = async name => {
  await pause(180);
  const result = await send('Page.captureScreenshot', {format: 'png'});
  await writeFile(new URL(name + '.png', previews), Buffer.from(result.data, 'base64'));
};
const viewport = async (width, height = 1000) => {
  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
  await pause(150);
};
const scrollTo = async selector => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`);
  await pause(200);
};
const click = async selector => {
  const rect = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', clickCount:1, ...rect});
  await send('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', clickCount:1, ...rect});
};

try {
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await viewport(1440);
  await send('Page.navigate', {url: site});
  await pause(1800);
  await evaluate(`localStorage.clear();document.documentElement.dataset.theme='light'`);
  if (await evaluate('document.documentElement.lang') !== 'zh-CN') await evaluate(`document.querySelector('#a-lang').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('.a-cert').length`), 19);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--acid').trim()`), '#00cbcc');
  await screenshot('desktop-home');
  await scrollTo('#acid-profile');
  await screenshot('desktop-profile');
  await scrollTo('#acid-practice');
  await screenshot('desktop-practice');
  await scrollTo('#acid-certs');
  await screenshot('desktop-certificates');
  await click('.a-stream-button:last-child');
  await pause(600);
  assert.ok(await evaluate(`document.querySelector('.a-stream').scrollLeft > 100`));
  await evaluate(`document.querySelectorAll('.a-filter')[3].click()`);
  await pause(150);
  assert.equal(await evaluate(`document.querySelectorAll('.a-cert:not(.hide)').length`), 1);
  assert.equal(await evaluate(`document.querySelector('.a-stream-button:last-child').disabled`), true);
  await click('.a-cert:not(.hide)');
  assert.equal(await evaluate(`document.querySelector('#a-dialog').open`), true, 'pointer click opens certificate');
  const initialTitle = await evaluate(`document.querySelector('#a-dialog-title').textContent`);
  await send('Input.dispatchKeyEvent', {type:'keyDown', key:'ArrowRight', code:'ArrowRight', windowsVirtualKeyCode:39});
  await pause(320);
  assert.notEqual(await evaluate(`document.querySelector('#a-dialog-title').textContent`), initialTitle);
  await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
  assert.equal(await evaluate(`document.querySelector('#a-dialog').open`), false);
  await evaluate(`document.querySelector('.a-filter').click()`);
  // Decode all image assets, including certificates outside the horizontal viewport.
  const badImages = await evaluate(`Promise.all([...document.querySelectorAll('img[src]')].map(async img => {img.loading='eager';try{await img.decode();return null}catch{return img.getAttribute('src')}})).then(results=>results.filter(Boolean))`);
  assert.deepEqual(badImages, []);
  // Exercise every original image in the modal, especially the PNG-only certificate.
  for (let i = 0; i < 19; i++) {
    await evaluate(`document.querySelectorAll('.a-cert')[${i}].click()`);
    assert.equal(await evaluate(`document.querySelector('#a-dialog-img').decode().then(()=>true)`), true);
    await evaluate(`document.querySelector('#a-dialog').close()`);
  }
  const streamPoint = await evaluate(`(() => {const r=document.querySelector('.a-stream').getBoundingClientRect();return {x:r.x+250,y:r.y+120}})()`);
  await send('Input.dispatchMouseEvent', {type:'mouseMoved', ...streamPoint});
  await send('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', buttons:1, clickCount:1, ...streamPoint});
  await send('Input.dispatchMouseEvent', {type:'mouseMoved', button:'left', buttons:1, x:streamPoint.x-150,y:streamPoint.y});
  await send('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', clickCount:1,x:streamPoint.x-150,y:streamPoint.y});
  assert.ok(await evaluate(`document.querySelector('.a-stream').scrollLeft >= 140`), 'mouse drag moves certificate stream');
  assert.equal(await evaluate(`document.querySelector('#a-dialog').open`), false, 'drag does not open preview');
  await evaluate(`const s=document.querySelector('.a-stream');s.scrollLeft=s.scrollWidth`);
  const scrollBefore = await evaluate('scrollY');
  await send('Input.dispatchMouseEvent', {type:'mouseWheel', deltaX:0,deltaY:160,...streamPoint});
  await pause(250);
  assert.ok(await evaluate('scrollY') > scrollBefore, 'wheel hands off to page at stream end');
  for (const width of [320, 390, 700, 768, 1024, 1440]) {
    await viewport(width);
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), `no horizontal page overflow at ${width}`);
    assert.ok(await evaluate(`(() => {const a=document.querySelector('.a-avatar').getBoundingClientRect(), b=document.querySelector('.a-mega').getBoundingClientRect();return a.left>=b.right || a.top>=b.bottom || a.bottom<=b.top})()`), `hero text does not overlap portrait at ${width}`);
    for (const language of ['en','zh-CN']) {
      if (await evaluate('document.documentElement.lang') !== language) await evaluate(`document.querySelector('#a-lang').click()`);
      assert.ok(await evaluate(`(() => {const c=document.querySelector('.a-practice-copy');return c.scrollHeight<=c.clientHeight+1})()`), `practice text fits at ${width}, ${language}`);
    }
  }
  await viewport(390, 844);
  await evaluate(`scrollTo({top:0,behavior:'instant'})`);
  await screenshot('mobile-home');
  await scrollTo('#acid-practice');
  await screenshot('mobile-practice');
  await scrollTo('#acid-certs');
  await evaluate(`document.querySelector('.a-stream').scrollLeft=0`);
  await screenshot('mobile-certificates');
  const touchPoint = await evaluate(`(() => {const r=document.querySelector('.a-stream').getBoundingClientRect();return {x:r.x+230,y:r.y+100}})()`);
  await send('Emulation.setTouchEmulationEnabled', {enabled:true});
  await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[touchPoint]});
  for (const offset of [20,50,90,140]) await send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:touchPoint.x-offset,y:touchPoint.y}]});
  await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  assert.ok(await evaluate(`document.querySelector('.a-stream').scrollLeft > 100`), 'touch drag moves stream');
  assert.equal(await evaluate(`document.querySelector('#a-dialog').open`), false, 'touch swipe does not open preview');
  await send('Emulation.setTouchEmulationEnabled', {enabled:false});
  await click('#a-lang');
  assert.equal(await evaluate('document.documentElement.lang'), 'en');
  assert.equal(await evaluate(`document.querySelector('.a-title').textContent`), 'PROFILE');
  await viewport(320);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'English mobile layout');
  await click('#a-lang');
  await click('#a-theme');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await viewport(1440);
  await evaluate(`scrollTo({top:0,behavior:'instant'})`);
  await screenshot('desktop-dark');
  await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.a-cert')).transform`), 'none');
  await evaluate(`document.querySelectorAll('.a-filter')[3].click()`);
  await send('Emulation.setEmulatedMedia', {media:'print'});
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.a-cert.hide')).display`), 'block', 'print includes filtered-out certificates');
  await evaluate(`scrollTo({top:0,behavior:'instant'})`);
  await screenshot('print-styles');
  await send('Emulation.setEmulatedMedia', {media:'screen',features:[]});
  assert.deepEqual(errors, [], 'no page exceptions or failed asset requests');
  console.log('PASS: scripts; 19 certificate images; six viewport widths; certificate buttons, filters, pointer preview, keyboard navigation and Escape; language/theme; reduced motion; print styles.');
} finally {
  socket.close();
}
