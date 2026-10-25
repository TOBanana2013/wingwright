# Rebuilds index.html from src/template.html, src/real.js and src/physics.js
t = open('src/template.html').read()
real = open('src/real.js').read().replace("if (typeof module !== 'undefined') module.exports = REAL;", "").strip()
i = t.index('const REAL = {'); j = t.index('\n};', i) + 3; t = t[:i] + real + t[j:]
open('src/template.html', 'w').write(t)
phys = open('src/physics.js').read(); phys = phys[:phys.index("if (typeof module !== 'undefined')")]
page = t.replace('/*PHYSICS*/', phys)
head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
# the <title>, fonts and <style> stay at the top of the page; everything after </style> is the body
cut = page.index('</style>') + len('</style>')
open('index.html', 'w').write(head + page[:cut] + '\n</head>\n<body>\n' + page[cut:] + '\n</body>\n</html>\n')
print('built index.html')
