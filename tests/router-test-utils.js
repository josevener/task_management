const path = require('path');
const http = require('http');
const express = require('express');

const ROOT_DIR = path.resolve(__dirname, '..');

function resolveRepoPath(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

function stubModule(relativePath, exports) {
  const resolvedPath = require.resolve(resolveRepoPath(relativePath));
  const previousEntry = require.cache[resolvedPath];

  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports,
  };

  return () => {
    if (previousEntry) {
      require.cache[resolvedPath] = previousEntry;
      return;
    }

    delete require.cache[resolvedPath];
  };
}

function loadRouterApp(routerRelativePath, routerExportName, mockModules = {}) {
  const restores = Object.entries(mockModules).map(([relativePath, exports]) => (
    stubModule(relativePath, exports)
  ));

  const routerResolvedPath = require.resolve(resolveRepoPath(routerRelativePath));
  delete require.cache[routerResolvedPath];

  const routerModule = require(routerResolvedPath);
  const { errorHandler } = require(resolveRepoPath('middleware/error-handler.js'));
  const router = routerModule[routerExportName];

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(errorHandler);

  return {
    app,
    restore() {
      delete require.cache[routerResolvedPath];
      restores.reverse().forEach((restore) => restore());
    },
  };
}

async function withTestServer(app, callback) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function requestJson(routePath, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (body && typeof body !== 'string') {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${routePath}`, {
      method: options.method || 'GET',
      headers,
      body,
    });

    let parsedBody = null;
    try {
      parsedBody = await response.json();
    }
    catch (_error) {
      parsedBody = null;
    }

    return {
      status: response.status,
      body: parsedBody,
    };
  }

  try {
    return await callback(requestJson);
  }
  finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

module.exports = {
  loadRouterApp,
  withTestServer,
};
