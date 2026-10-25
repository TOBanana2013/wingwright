# Rebuilds index.html from src/template.html, src/real.js and src/physics.js
t = open('src/template.html').read()
real = open('src/real.js').read().replace("if (typeof module !== 'undefined') module.exports = REAL;", "").strip()
i = t.index('const REAL = {'); j = t.index('\n};', i) + 3; t = t[:i] + real + t[j:]
open('src/template.html', 'w').write(t)
phys = open('src/physics.js').read(); phys = phys[:phys.index("if (typeof module !== 'undefined')")]
open('index.html', 'w').write(t.replace('/*PHYSICS*/', phys))
print('built index.html')
