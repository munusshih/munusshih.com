#!/usr/bin/env python3
"""Fail a build if rendered local links or lazy media point to missing files."""
import sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote, parse_qs

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist')
errors, checked = set(), set()

class Page(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and (attrs.get('rel') in {'preconnect', 'dns-prefetch'} or (route == '/404.html' and attrs.get('rel') == 'canonical')):
            return
        refs = [attrs.get(key) for key in ('href', 'src', 'poster', 'data-src')]
        refs += [part.strip().split()[0] for part in attrs.get('srcset', '').split(',') if part.strip()]
        for ref in filter(None, refs):
            url = urlsplit(urljoin('https://munusshih.com' + route, ref))
            if url.netloc != 'munusshih.com' or url.scheme not in {'http', 'https'}:
                continue
            target = unquote(url.path)
            if target in {'/_vercel/image', '/_image'}:
                target = unquote(parse_qs(url.query).get('url', [''])[0])
                if not target.startswith('/'):
                    continue
            if target.startswith(('/api/', '/_vercel/insights/', '/_vercel/speed-insights/')):
                continue  # Dynamic endpoints supplied by the adapter.
            file = root / target.lstrip('/')
            checked.add(target)
            if not file.is_file() and not (file / 'index.html').is_file():
                errors.add((route, target))

pages = [p for p in root.rglob('*.html') if 'assets' not in p.relative_to(root).parts]
if not pages:
    sys.exit(f'No generated pages found in {root}')
for page in pages:
    relative = page.relative_to(root).as_posix()
    route = '/' + relative.removesuffix('index.html')
    Page().feed(page.read_text())
for route, target in sorted(errors):
    print(f'MISSING {route} -> {target}')
print(f'Checked {len(pages)} pages, {len(checked)} local URLs; {len(errors)} broken references.')
sys.exit(bool(errors))
