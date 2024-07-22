import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import type { components } from './model';
import basicAuth, { IBasicAuthedRequest } from 'express-basic-auth';
import { PolicyAuthorizer } from './policyAuthorizer';
import { AST, Parser } from 'node-sql-parser';
const parser = new Parser();

type ErrorResponse = components['schemas']['Error'];
type Action = components['schemas']['Action'];

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

interface TableAndAction {
  table?: string;
  action: Action | 'bypass';
}

function tableAndActionFromQuery(query: string): TableAndAction {
  // The SQL statement to parse
  // Parse the SQL statement
  const parsed = parser.parse(query); // Convert SQL to AST (Abstract Syntax Tree)
  if (parsed.tableList.length > 1) {
    throw new Error('Multiple table authorization currently not supported');
  }
  // Table may be null if we're creating a user, sequence, w/e.
  const table = parsed.tableList.length === 0 ? parsed.tableList[0] : undefined;
  return {
    table: table,
    action: resolveActionOrBypass(parsed.ast),
  };
}

function resolveActionOrBypass(ast: AST | AST[]): Action | 'bypass' {
  if (Array.isArray(ast)) {
    throw new Error('multiple expressions not currently supported');
  }
  const singleAst = ast as AST;
  switch (singleAst.type) {
    case 'use':
    case 'create':
    case 'alter':
    case 'drop':
      return 'bypass';
    case 'select':
      return 'select';
    case 'insert':
    case 'replace':
      // I believe this is on conflict insert: https://www.sqlite.org/lang_replace.html
      return 'insert';
    case 'delete':
      return 'delete';
    case 'update':
      return 'update';
  }
}

// TODO: Make sure exceptions return nice errors.

app.post('/query', (req: IBasicAuthedRequest, res: Response) => {
  const query = req.body.query;
  if (!query) {
    res.send({ error: 'must provide query' });
    return;
  }
  // TODO: Enforce
  try {
    const tableAndAction = tableAndActionFromQuery(query);
    if (tableAndAction.action !== 'bypass') {
      console.log('Authorizing...');
      if (
        authorizer.authorized({
          principal: req.auth.user,
          action: tableAndAction.action,
          resource: tableAndAction.table,
        })
      ) {
        console.log('Authorized!');
        executeQueryAndSendResponse(query, res);
      } else {
        console.log('Not authorized to execute query');
        const unauthorizedResponse: ErrorResponse = {
          message: 'Unauthrized to perform query',
        };
        res.status(403).send(unauthorizedResponse);
      }
    } else {
      console.log('Bypassing authz');
    }
  } catch (err) {
    // 500 for now
    const errResponse: ErrorResponse = { message: err.message };
    res.status(500).send(errResponse);
  }
});

function executeQueryAndSendResponse(query: string, res: Response) {
  db.all(query, (err, rows) => {
    if (err) {
      res.status(400).send(err);
      return;
    } else {
      res.send({ data: rows });
    }
  });
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
