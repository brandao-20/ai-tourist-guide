import { createReadStream, statSync } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.webp', 'image/webp'],
  ['.map', 'application/json; charset=utf-8'],
]);

function readOption(name, fallback) {
  const longName = `--${name}`;
  const index = process.argv.indexOf(longName);

  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return fallback;
}

const host = readOption('host', process.env.HOST || '127.0.0.1');
const requestedPort = Number(readOption('port', process.env.PORT || '8080'));
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 8080;
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
const googleMapsBrowserApiKey = process.env.GOOGLE_MAPS_BROWSER_API_KEY || '';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendRuntimeConfig(res) {
  const body = `window.APP_CONFIG = ${JSON.stringify({
    API_BASE_URL: apiBaseUrl,
    GOOGLE_MAPS_BROWSER_API_KEY: googleMapsBrowserApiKey,
  }, null, 2)};
`;

  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function isInsidePublicDir(filePath) {
  const relativePath = path.relative(publicDir, filePath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}


const routeAliases = new Map([
  ['/home', '/index.html'],
  ['/features', '/index.html'],
  ['/contact', '/contact.html'],
  ['/sign-in', '/login.html'],
  ['/login', '/login.html'],
  ['/create-account', '/register.html'],
  ['/register', '/register.html'],
  ['/dashboard', '/home_logged.html'],
  ['/plan-trip', '/mainapp.html'],
  ['/saved-routes', '/favorites.html'],
  ['/profile', '/profile.html'],
  ['/edit-profile', '/edit_profile.html'],
  ['/route-details', '/route_details.html'],
  ['/about', '/index.html'],
  ['/learnmore', '/index.html'],
  ['/status', '/index.html'],
]);

const cleanPathAliases = new Map([
  ['/index.html', '/'],
  ['/features', '/'],
  ['/features.html', '/'],
  ['/contact.html', '/contact'],
  ['/login.html', '/login'],
  ['/register.html', '/register'],
  ['/home_logged.html', '/dashboard'],
  ['/mainapp.html', '/plan-trip'],
  ['/favorites.html', '/saved-routes'],
  ['/profile.html', '/profile'],
  ['/edit_profile.html', '/edit-profile'],
  ['/route_details.html', '/route-details'],
  ['/about.html', '/'],
  ['/learnmore.html', '/'],
  ['/status.html', '/'],
]);

function redirect(res, location, statusCode = 302) {
  res.writeHead(statusCode, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function getCleanRedirect(pathname, search = '') {
  const cleanPath = cleanPathAliases.get(pathname);
  if (!cleanPath) {
    return null;
  }
  return `${cleanPath}${search || ''}`;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    const stats = await stat(filePath);
    return stats.isFile();
  } catch (error) {
    return false;
  }
}

function getCacheHeader(filePath) {
  const relativePath = path.relative(publicDir, filePath).replace(/\\/g, '/');

  if (relativePath.startsWith('build/') || /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(relativePath)) {
    return 'public, max-age=3600';
  }

  return 'no-cache';
}

async function resolveStaticFile(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const aliasedPath = routeAliases.get(decodedPath) || decodedPath;
  const normalizedPath = aliasedPath === '/' ? '/index.html' : aliasedPath;
  const safePath = path.normalize(normalizedPath).replace(/^([.][.][\/\\])+/, '');
  const requestedPath = path.join(publicDir, safePath);

  if (!isInsidePublicDir(requestedPath)) {
    return null;
  }

  const requestedStats = await stat(requestedPath).catch(() => null);
  if (requestedStats?.isDirectory()) {
    const indexPath = path.join(requestedPath, 'index.html');
    return (await fileExists(indexPath)) ? indexPath : null;
  }

  if (requestedStats?.isFile()) {
    return requestedPath;
  }

  const extension = path.extname(requestedPath);
  if (!extension) {
    const htmlPath = `${requestedPath}.html`;
    return (await fileExists(htmlPath) && isInsidePublicDir(htmlPath)) ? htmlPath : null;
  }

  return null;
}

function streamFile(req, res, filePath, statusCode = 200) {
  const stats = statSync(filePath);
  const extension = path.extname(filePath).toLowerCase();

  res.writeHead(statusCode, {
    'Content-Type': mimeTypes.get(extension) || 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': getCacheHeader(filePath),
    'X-Content-Type-Options': 'nosniff',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

async function sendNotFound(req, res) {
  const notFoundPath = path.join(publicDir, '404.html');
  if (await fileExists(notFoundPath)) {
    streamFile(req, res, notFoundPath, 404);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'personalized-tourist-guide-ai-frontend',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (requestUrl.pathname === '/config.js') {
      sendRuntimeConfig(res);
      return;
    }

    if (requestUrl.pathname === '/logout' && ['GET', 'HEAD'].includes(req.method)) {
      redirect(res, `${apiBaseUrl.replace(/\/$/, '')}/logout`, 302);
      return;
    }

    const cleanRedirect = getCleanRedirect(requestUrl.pathname, requestUrl.search);
    if (cleanRedirect && ['GET', 'HEAD'].includes(req.method)) {
      redirect(res, cleanRedirect, 301);
      return;
    }

    if (!['GET', 'HEAD'].includes(req.method)) {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }
    const filePath = await resolveStaticFile(requestUrl.pathname);

    if (!filePath) {
      await sendNotFound(req, res);
      return;
    }

    streamFile(req, res, filePath);
  } catch (error) {
    sendJson(res, 500, { error: 'Frontend server error.' });
  }
});

server.listen(port, host, () => {
  console.log(`Frontend server listening on http://${host}:${port}`);
});
