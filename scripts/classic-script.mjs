// Rewrites dist-single/index.html so the app runs as one classic <script> at the end of <body>.
// Some file previewers sandbox or rewrite pages and don't run inline ES modules reliably.
import fs from 'node:fs'

const file = new URL('../dist-single/index.html', import.meta.url)
let html = fs.readFileSync(file, 'utf8')
const open = '<script type="module" crossorigin>'
const start = html.indexOf(open)
if (start === -1) process.exit(0)
const end = html.indexOf('</script>', start)
const code = html.slice(start + open.length, end)
html = html.slice(0, start) + html.slice(end + '</script>'.length)
html = html.replace('</body>', `<script>${code}</script>\n</body>`)
fs.writeFileSync(file, html)
console.log('classic script: ok')
