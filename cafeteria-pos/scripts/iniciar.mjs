// Prepara y arranca el POS con un solo comando, en Windows, Mac o Linux:
//
//   npm run iniciar                 instala lo que falte, prepara la base y arranca
//   npm run iniciar -- --preparar   solo prepara (no arranca)
//   npm run iniciar -- --reconstruir  vuelve a compilar la interfaz
//   npm run iniciar -- --sin-navegador  no abre el navegador al arrancar
//
// Es seguro ejecutarlo todas las veces: lo que ya está listo se omite y los
// datos de la cafetería nunca se borran.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(RAIZ, 'server');
const WEB = path.join(RAIZ, 'web');
const PUERTO = 4000;
const soloPreparar = process.argv.includes('--preparar');
const reconstruir = process.argv.includes('--reconstruir');
const abrirNavegador = !process.argv.includes('--sin-navegador');

// Abre una URL en el navegador por defecto. Si no se puede, no pasa nada:
// la dirección igual queda escrita en la terminal.
function abrir(url) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

const paso = (n, texto) => console.log(`\n☕ [${n}/5] ${texto}`);
const correr = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

const [mayor] = process.versions.node.split('.').map(Number);
if (mayor < 22) {
  console.error(`\n✖ Necesitas Node.js 22 o superior (tienes ${process.versions.node}).`);
  console.error('  Descárgalo en https://nodejs.org (versión "LTS") y vuelve a intentar.\n');
  process.exit(1);
}

try {
  paso(1, 'Instalando dependencias (solo la primera vez, puede tardar unos minutos)…');
  for (const dir of [SERVER, WEB]) {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) correr('npm ci', dir);
  }

  paso(2, 'Configuración…');
  const env = path.join(SERVER, '.env');
  if (!fs.existsSync(env)) fs.copyFileSync(path.join(SERVER, '.env.example'), env);

  paso(3, 'Preparando la base de datos…');
  correr('npx prisma migrate deploy', SERVER);
  correr('node prisma/seed.js', SERVER);

  paso(4, 'Compilando la interfaz…');
  const publico = path.join(SERVER, 'public');
  if (reconstruir || !fs.existsSync(path.join(publico, 'index.html'))) {
    correr('npm run build', WEB);
    fs.rmSync(publico, { recursive: true, force: true });
    fs.cpSync(path.join(WEB, 'dist'), publico, { recursive: true });
  } else {
    console.log('   Ya compilada (usa --reconstruir para forzar).');
  }
} catch {
  console.error('\n✖ Algo falló en la preparación. Revisa el mensaje de arriba.\n');
  process.exit(1);
}

if (soloPreparar) {
  console.log('\n✔ Listo. Arráncalo con: npm run iniciar\n');
  process.exit(0);
}

paso(5, 'Arrancando el POS…');
const yaAbierto = await fetch(`http://localhost:${PUERTO}/api/health`).then((r) => r.ok, () => false);
if (yaAbierto) {
  console.log(`\n✔ El POS ya está funcionando en otra ventana: abre http://localhost:${PUERTO}\n`);
  if (abrirNavegador) abrir(`http://localhost:${PUERTO}`);
  process.exit(0);
}
const servidor = spawn(process.execPath, ['src/index.js'], { cwd: SERVER, stdio: 'inherit' });
servidor.on('exit', (code) => process.exit(code ?? 0));

// En Mac, evita que el equipo se duerma mientras el POS está encendido (las
// tablets de comanda perderían la conexión). Se desactiva solo al apagarlo.
if (process.platform === 'darwin') {
  spawn('caffeinate', ['-i', '-w', String(servidor.pid)], { stdio: 'ignore' }).on('error', () => {});
}
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => servidor.kill(s));

// Direcciones para abrir desde otros equipos del local (tablet de comanda,
// pantalla del cliente) conectados a la misma red wifi.
const enRed = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i.address}:${PUERTO}`);

// El aviso final solo se muestra cuando el servidor responde de verdad.
async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    if (servidor.exitCode !== null) return false;
    try {
      if ((await fetch(`http://localhost:${PUERTO}/api/health`)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

esperarServidor().then((ok) => {
  if (!ok) return;
  console.log('\n────────────────────────────────────────────────');
  console.log(`  ✔ POS funcionando. Abre en el navegador:`);
  console.log(`      http://localhost:${PUERTO}`);
  if (enRed.length) console.log(`  Desde tablets o celulares en el mismo wifi:\n      ${enRed.join('\n      ')}`);
  console.log('  Usuario: cajero@cafeteria.cl   Contraseña: demo1234');
  console.log('  No cierres esta ventana mientras uses el POS.');
  console.log('  Para apagarlo: Control + C en esta ventana.');
  console.log('────────────────────────────────────────────────\n');
  if (abrirNavegador) abrir(`http://localhost:${PUERTO}`);
});
