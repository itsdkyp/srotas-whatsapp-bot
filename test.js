const res = await fetch('https://github.com/itsdkyp/srotas-whatsapp-bot/releases/latest', { redirect: 'manual' });
const loc = res.headers.get('location');
console.log(loc);
const version = loc.split('/').pop().replace('v', '');
console.log(version);
