import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const source = readFileSync('styles.css', 'utf8');
const variables = Object.fromEntries([...source.matchAll(/--([a-z-]+):([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const css = source.replace(/var\(--([a-z-]+)\)/g, (_, key) => {
  if (!(key in variables)) throw new Error('Missing CSS variable: ' + key);
  return variables[key];
});
writeFileSync('public/style.css', css);
const html = readFileSync('public/index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const path = match[1];
  if (/^(https?:|data:|#)/.test(path)) continue;
  if (!existsSync('public/' + path)) throw new Error('Missing asset: ' + path);
}
for (const file of ['public/app.js', 'public/access.js']) {
  execFileSync(process.execPath, ['--check', file], {stdio: 'inherit'});
}
console.log('Static site ready: public/index.html');
