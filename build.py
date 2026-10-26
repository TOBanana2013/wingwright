"""Builds index.html (the whole game in one file) from the files in src/.

src/template.html  page, styles, UI, renderer and game modes; holds two placeholders
src/real.js        real aircraft data, pasted in at /*REAL*/
src/physics.js     flight physics and worlds, pasted in at /*PHYSICS*/
Only index.html is written; nothing in src/ is changed.
"""
from pathlib import Path

ROOT = Path(__file__).parent
EXPORT = "if (typeof module !== 'undefined')"   # Node-only export line, not needed in the browser


def strip_export(code):
    return code[:code.index(EXPORT)].rstrip() + '\n' if EXPORT in code else code


def build():
    page = (ROOT / 'src/template.html').read_text()
    for marker, name in (('/*REAL*/', 'real.js'), ('/*PHYSICS*/', 'physics.js')):
        assert page.count(marker) == 1, f'{marker} must appear exactly once in template.html'
        page = page.replace(marker, strip_export((ROOT / 'src' / name).read_text()))
    cut = page.index('</style>') + len('</style>')   # title, fonts and styles go in <head>
    head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    (ROOT / 'index.html').write_text(head + page[:cut] + '\n</head>\n<body>\n' + page[cut:] + '\n</body>\n</html>\n')
    print('built index.html')


if __name__ == '__main__':
    build()
