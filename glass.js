const fs = require('fs');

const file = 'Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/bg-zinc-900(?![/\w])/g, 'bg-zinc-900/40 backdrop-blur-md');
content = content.replace(/bg-zinc-950(?![/\w])/g, 'bg-zinc-950/40 backdrop-blur-md');

fs.writeFileSync(file, content);
console.log('Done!');
