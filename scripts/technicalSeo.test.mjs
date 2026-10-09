import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { canonicalUrl, isIndexablePath, isPreviewDeployment } from '../src/utils/seo.js';

test('canonical URLs ignore build host and normalize trailing slashes', () => {
  assert.equal(canonicalUrl('/'), 'https://munusshih.com/');
  assert.equal(canonicalUrl('/about/'), 'https://munusshih.com/about/');
  assert.equal(canonicalUrl('/sketches/pattern/'), 'https://munusshih.com/sketches/pattern/');
  assert.equal(isPreviewDeployment({VERCEL_ENV: 'production'}), false);
  assert.equal(isPreviewDeployment({VERCEL_ENV: 'preview'}), true);
  for (const route of ['/404.html', '/calendar/', '/sketches/pattern', '/api/resume.pdf']) assert.equal(isIndexablePath(route), false);
  for (const route of ['/', '/about', '/work', '/p5-zine']) assert.equal(isIndexablePath(route), true);
});

test('video controller defers downloads, pauses offscreen, resumes and handles hidden tabs', () => {
  let callback, observed = 0;
  const handlers = {};
  const videos = [0, 1].map(() => ({dataset: {src: '/movie.mp4'}, loads: 0, plays: 0, pauses: 0, getAttribute() {return this.src;}, load() {this.loads++;}, play() {this.plays++; return Promise.resolve();}, pause() {this.pauses++;}}));
  class Observer {constructor(fn) {callback=fn;} observe() {observed++;} disconnect() {}}
  const document = {hidden: false, querySelectorAll: () => videos, addEventListener: (name, fn) => handlers[name]=fn};
  vm.runInNewContext(fs.readFileSync(new URL('../src/scripts/lazyMedia.js', import.meta.url), 'utf8'), {document, window: {IntersectionObserver: Observer}, IntersectionObserver: Observer});
  assert.equal(observed, 2);
  assert.equal(videos[0].loads + videos[1].loads, 0);
  callback([{target: videos[0], isIntersecting: true}]);
  assert.equal(videos[0].loads, 1);
  assert.equal(videos[1].loads, 0);
  callback([{target: videos[0], isIntersecting: false}]);
  assert.equal(videos[0].pauses, 1);
  callback([{target: videos[0], isIntersecting: true}]);
  assert.equal(videos[0].loads, 1);
  document.hidden = true; handlers.visibilitychange();
  assert.equal(videos[0].pauses, 2);
  document.hidden = false; handlers.visibilitychange();
  assert.equal(videos[0].plays, 3);
  handlers['astro:page-load'](); assert.equal(observed, 2);
  handlers['astro:before-swap'](); assert.equal(videos[0].pauses, 3);
});

test('video controller provides a fallback when IntersectionObserver is unavailable', () => {
  const video = {dataset: {src: '/movie.mp4'}, getAttribute() {}, load() {}, play() {this.played=true;return Promise.reject(new Error('Autoplay denied'));}};
  vm.runInNewContext(fs.readFileSync(new URL('../src/scripts/lazyMedia.js', import.meta.url), 'utf8'), {document: {hidden: false, querySelectorAll: () => [video], addEventListener() {}}, window: {}});
  assert.equal(video.src, '/movie.mp4');
  assert.equal(video.played, true);
});


const { withSeoRoutes } = await import('./finalizeVercelRoutes.mjs');
test('Vercel output applies SEO rules before filesystem/slash routes without replacing adapter config', () => {
  const original = {version:3, images:{sizes:[640]}, routes:[{src:'^/(.*)$',status:404}]};
  const output = withSeoRoutes(original);
  assert.deepEqual(withSeoRoutes(output), output);
  assert.deepEqual(output.images, original.images);
  assert.equal(output.routes.at(-1), original.routes[0]);
  const alias = output.routes[1];
  for (const path of ['/Home', '/Home/', '/home', '/home/']) assert.match(path, new RegExp(alias.src));
  for (const path of ['/homework/', '/something-missing/']) assert.doesNotMatch(path, new RegExp(alias.src));
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.Location, canonicalUrl('/'));
  const header = output.routes[0];
  assert.match('preview-project.vercel.app',new RegExp(header.has[0].value));
  assert.doesNotMatch('munusshih.com',new RegExp(header.has[0].value));
  assert.equal(header.headers['X-Robots-Tag'],'noindex, follow');
});
