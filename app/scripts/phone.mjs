// Try RIFFBOX on a phone, without putting it online.
//   npm run phone
// Builds the app, then serves it in https on this computer's local network
// (self-signed certificate: the phone shows a warning to accept once).
// The phone and the computer must be on the same Wi-Fi.
import { networkInterfaces } from 'node:os';
import basicSsl from '@vitejs/plugin-basic-ssl';
import qrcode from 'qrcode-terminal';
import { build, preview } from 'vite';

const PORT = Number(process.env.PORT) || 5443;

/** IPv4 addresses on the local network (Wi-Fi first), skipping loopback and virtual adapters. */
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (/^(lo|docker|br-|veth|vbox|vmnet|utun|awdl|llw|tailscale|zt)/i.test(name)) continue;
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push({ name, ip: a.address });
  }
  const score = ({ name, ip }) => (/^(wl|wi-?fi|en0)/i.test(name) ? 0 : 1) + (/^192\.168\./.test(ip) ? 0 : 1);
  return out.sort((a, b) => score(a) - score(b));
}

console.log('\n  Construction de l’app…\n');
await build({ logLevel: 'warn' });

const server = await preview({
  plugins: [basicSsl()],
  preview: { host: true, port: PORT, strictPort: true },
  logLevel: 'warn',
});

const urls = lanAddresses().map(a => `https://${a.ip}:${PORT}/`);
console.log('\n  RIFFBOX est servie sur ce réseau local.\n');
if (!urls.length) {
  console.log('  Aucune adresse réseau trouvée : cet ordinateur est-il connecté au Wi-Fi ?');
  console.log(`  Sur cet ordinateur seulement : https://localhost:${PORT}/\n`);
} else {
  console.log('  Sur le téléphone (même Wi-Fi), ouvrez :\n');
  for (const u of urls) console.log(`    ${u}`);
  console.log('\n  ou scannez ce code avec l’appareil photo :\n');
  qrcode.generate(urls[0], { small: true }, q => console.log(q.replace(/^/gm, '    ')));
  console.log(`  Le téléphone affichera un avertissement de sécurité (certificat local) :
    · Android / Chrome : « Paramètres avancés » puis « Continuer vers le site ».
    · iPhone / Safari : « Afficher les détails » puis « Consulter ce site web ».
  Ensuite, micro, son, maintien de l’écran et pédalier devraient fonctionner.
  L’installation sur l’écran d’accueil et le mode hors ligne demandent un
  vrai certificat : ici, ils risquent de ne pas marcher (normal, pas un bug).

  Ctrl+C pour arrêter.
`);
}

const stop = () => { server.httpServer.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
