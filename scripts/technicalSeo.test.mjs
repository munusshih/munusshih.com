import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { canonicalUrl, isIndexablePath, isPreviewDeployment } from '../src/utils/seo.js';

test('canonical URLs ignore build host and normalize trailing slashes', () => {
  assert.equal(canonicalUrl('/'), 'https://www.munusshih.com/');
  assert.equal(canonicalUrl('/about/'), 'https://www.munusshih.com/about');
  assert.equal(canonicalUrl('/sketches/pattern/'), 'https://www.munusshih.com/sketches/pattern');
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
