#!/usr/bin/env python3
"""Check generated routes, SEO directives and unchanged copy after an Astro build."""
import argparse
import json
import re
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

ORIGIN = 'https://munusshih.com'
UTILITY = {'/404.html', '/calendar', '/sketches/pattern'}

class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.canonical = []
        self.meta = {}
        self.h1 = 0
        self.text = []
        self.skip = 0
        self.videos = []
        self.images = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in {'script', 'style', 'noscript'}:
            self.skip += 1
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical.append(a.get('href'))
        if tag == 'meta':
            self.meta[a.get('name', a.get('property'))] = a.get('content', '')
        if tag == 'h1': self.h1 += 1
        if not self.skip:
            if tag == 'video': self.videos.append(a)
            if tag == 'img': self.images.append(a)
        if tag == 'video': self.skip += 1

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'noscript', 'video'}: self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip and data.strip(): self.text.append(' '.join(data.split()))

def audit(directory, baseline=None, preview=False):
    pages, failures, warnings = [], [], []
    sitemap = set()
    for file in directory.glob('sitemap-*.xml'):
        root = ET.parse(file).getroot()
        if root.tag.endswith('urlset'):
            sitemap.update(ORIGIN + '/' if e.text == ORIGIN else e.text for e in root.iter() if e.tag.endswith('loc'))
    for file in sorted(directory.rglob('*.html')):
        if 'assets' in file.relative_to(directory).parts: continue
        relative = file.relative_to(directory).as_posix()
        route = '/' if relative == 'index.html' else '/' + relative.removesuffix('/index.html')
        html = file.read_text()
        page = Page(html)
        if route == '/about':
            blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S)
            try:
                profile = json.loads(blocks[0])
                person = profile['mainEntity']
                if profile['@type'] != 'ProfilePage' or person['@type'] != 'Person' or person['@id'] != ORIGIN + '/about/#person': failures.append('about: invalid profile entity linkage')
                if person['jobTitle'] != 'Assistant Professor' or person['affiliation']['name'] != 'Pratt Institute': failures.append('about: invalid affiliation')
                normalize = lambda value: re.sub(r'\s+([,.;:!?])', r'\1', ' '.join(''.join(c for c in value if unicodedata.category(c) != 'Cf').split()))
                if normalize(person['description']) not in normalize(' '.join(page.text)): failures.append('about: schema description is not published bio')
                if not person['image'].startswith(ORIGIN + '/assets/'): failures.append('about: invalid portrait URL')
            except (IndexError, KeyError, ValueError): failures.append('about: missing/invalid ProfilePage JSON-LD')
        canonical_path = '/404/' if route == '/404.html' else route.rstrip('/') + '/'
        canonical = ORIGIN + canonical_path
        if page.canonical != [canonical]: failures.append(f'{route}: canonical {page.canonical}')
        noindex = 'noindex' in page.meta.get('robots', '')
        if noindex != (preview or route in UTILITY): failures.append(f'{route}: incorrect noindex')
        if (canonical in sitemap) != (route not in UTILITY): failures.append(f'{route}: sitemap inclusion')
        for key in ['og:url', 'twitter:url']:
            if page.meta.get(key) != canonical: failures.append(f'{route}: incorrect {key}')
        if not page.meta.get('description'): warnings.append(f'{route}: empty description (copy deferred)')
        if page.h1 != 1 and route not in UTILITY: warnings.append(f'{route}: {page.h1} H1 elements (copy/semantics deferred)')
        if baseline and (baseline / relative).exists():
            old = Page((baseline / relative).read_text())
            if old.text != page.text: failures.append(f'{route}: visible text changed')
            if old.meta.get('description') != page.meta.get('description'): failures.append(f'{route}: description changed')
        for video in page.videos:
            if 'autoplay' in video or video.get('preload') != 'none' or video.get('src') or not video.get('data-src'):
                failures.append(f'{route}: video downloads before visibility')
        pages.append({'route': route, 'canonical': canonical, 'noindex': noindex, 'h1': page.h1, 'textCharacters': sum(map(len, page.text)), 'videos': len(page.videos), 'images': len(page.images), 'imagesWithDimensions': sum(bool(i.get('width') and i.get('height')) for i in page.images)})
    expected = {p['canonical'] for p in pages if p['route'] not in UTILITY}
    if sitemap != expected: failures.append(f'sitemap mismatch: {sitemap.symmetric_difference(expected)}')
    if f'Sitemap: {ORIGIN}/sitemap-index.xml' not in (directory / 'robots.txt').read_text(): failures.append('robots sitemap host mismatch')
    return {'pages': pages, 'failures': failures, 'warnings': warnings, 'sitemapUrls': len(sitemap)}

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--dir', type=Path, default=Path('dist'))
    p.add_argument('--baseline', type=Path)
    p.add_argument('--preview', action='store_true')
    p.add_argument('--output', type=Path)
    args = p.parse_args()
    report = audit(args.dir, args.baseline, args.preview)
    if args.output: args.output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    raise SystemExit(bool(report['failures']))
