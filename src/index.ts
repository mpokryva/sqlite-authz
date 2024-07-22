import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import type { components } from './model';
import basicAuth, { IBasicAuthedRequest } from 'express-basic-auth';
import { PolicyAuthorizer } from './policyAuthorizer';

type ErrorResponse = components['schemas']['Error'];

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

const authorizer = new PolicyAuthorizer();

// TODO: Clean up (reorganize)
const app = express();
app.use(bodyParser.json());
const apiKeyAuthMiddleware = basicAuth({
  authorizer: apiKeyAuthorizer,
  unauthorizedResponse: unauthorizedResponse,
});
app.use(
  (req, res, next) => {
    shouldAuthenticate(req) ? apiKeyAuthMiddleware(req, res, next) : next();
  },
  (_req: basicAuth.IBasicAuthedRequest, _res, next) => {
    next();
  },
);
const port = 3000;

function shouldAuthenticate(req: Request): boolean {
  return !(req.path === '/api_keys' && req.method === 'POST');
}

function unauthorizedResponse(_: Request): ErrorResponse {
  return { message: 'Must provide a valid API key' };
}

function apiKeyAuthorizer(user: string, _: string): boolean {
  return apiKeys.has(user);
}

const apiKeys = new Set<String>();
let apiKeyCounter = 0;
app.post('/api_keys', (_: Request, res: Response) => {
  let newApiKey = `api_key_${apiKeyCounter}`;
  apiKeys.add(newApiKey);
  // Probably a race condition, but we'll ignore it for the purposes of this assignment.
  apiKeyCounter++;
  res.send({
    key: newApiKey,
  });
});

app.post('/query', (req: IBasicAuthedRequest, res: Response) => {
  const query = req.body.query;
  if (!query) {
    res.send({ error: 'must provide query' });
    return;
  }
  // TODO: Enforce
  authorizer.authorized({
    principal: req.auth.user,
    action: 'blah',  // TODO: Parse,
    resource: 'blah' // TODO: Parse
  })
  db.all(query, (err, rows) => {
    if (err) {
      res.status(400).send(err);
      return;
    } else {
      res.send({ data: rows });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
