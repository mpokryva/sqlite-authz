import express, { NextFunction, Request, Response } from 'express';
import type { components } from './model';
import basicAuth, { IBasicAuthedRequest } from 'express-basic-auth';
import { PolicyAuthorizer } from './policyAuthorizer';
import { AST, Parser } from 'node-sql-parser';
import * as OpenApiValidator from 'express-openapi-validator';
const parser = new Parser();
import sqlite3 from 'sqlite3';

type ErrorResponse =
  components['responses']['ErrorResponse']['content']['application/json'];
type APIKeyResponse =
  components['responses']['APIKeyResponse']['content']['application/json'];
type Action = components['schemas']['Action'];

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(':memory:');

const authorizer = new PolicyAuthorizer();

// TODO: Clean up (reorganize)
const app = express();
app.use(express.json());
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
app.use(
  OpenApiValidator.middleware({
    apiSpec: './authz-api.yaml',
    validateRequests: true, // (default)
    validateResponses: true, // false by default
  }),
);
app.use((err, _req: Request, res: Response, _next: NextFunction) => {
  // format error
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});
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

const apiKeys = new Set<string>();
let apiKeyCounter = 0;
app.post('/api_keys', (_: Request, res: Response) => {
  const newApiKey = `api_key_${apiKeyCounter}`;
  apiKeys.add(newApiKey);
  // Probably a race condition, but we'll ignore it for the purposes of this assignment.
  apiKeyCounter++;
  const apiKeyResponse: APIKeyResponse = {
    api_key: newApiKey,
  };
  res.status(201).send(apiKeyResponse);
});

interface TableAndAction {
  table?: string;
  action: Action | 'bypass';
}

function tableAndActionFromQuery(query: string): TableAndAction {
  const parsed = parser.parse(query); // Convert SQL to AST (Abstract Syntax Tree)
  // Table may be null if we're creating a user, sequence, w/e.
  console.log(`ast: ${JSON.stringify(parsed)}`);
  const action = resolveActionOrBypass(parsed.ast);
  console.log(`action resolved to: ${action}`);
  return {
    table: resolveTable(parsed.tableList),
    action: action,
  };
}

function resolveTable(tableList: string[]): string | undefined {
  if (tableList.length > 1) {
    throw new Error('Multiple table authorization currently not supported');
  }
  if (tableList.length === 0) {
    return undefined;
  }
  // The parser parses the action as i.e "insert::null::my_table1"
  //  not pretending this is robust.
  const resolvedTable = tableList[0].split('::')[2];
  console.log(`Resolved table: ${resolvedTable}`);
  return resolvedTable;
}

function resolveActionOrBypass(ast: AST | AST[]): Action | 'bypass' {
  const astArray: AST[] = Array.isArray(ast) ? ast : [ast];
  if (astArray.length > 1) {
    throw new Error('multiple expressions not currently supported');
  }
  const singleAst = astArray[0];
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

app.post('/policies', (req: IBasicAuthedRequest, res: Response) => {
  console.log('Policy body: ', req.body);
  const createdPolicy = authorizer.addPolicy(req.auth.user, req.body);
  res.status(201).send(createdPolicy);
});

app.get('/policies', (req: IBasicAuthedRequest, res: Response) => {
  res.send(authorizer.listPolicies(req.auth.user));
});

app.delete('/policies/:id', (req: IBasicAuthedRequest, res: Response) => {
  const deleted = authorizer.deletePolicy(req.auth.user, req.params.id);
  if (deleted) {
    res.status(204).send();
  } else {
    console.log('policy not found');
    const errResponse: ErrorResponse = {
      message: `Policy with id ${req.params.id} not found`,
    };
    res.status(404).send(errResponse);
  }
});

app.post('/query', (req: IBasicAuthedRequest, res: Response) => {
  const query = req.body.query;
  console.log(`received query: ${query}`);
  if (!query) {
    res.send({ error: 'must provide query' });
    return;
  }
  try {
    const tableAndAction = tableAndActionFromQuery(query);
    if (tableAndAction.action === 'bypass') {
      console.log('Bypassing authz');
      executeQueryAndSendResponse(query, res);
      return;
    }
    console.log('Authorizing...');
    const authorized = authorizer.authorized({
      principal: req.auth.user,
      action: tableAndAction.action,
      resource: tableAndAction.table,
    });
    if (authorized) {
      console.log('Authorized!');
      executeQueryAndSendResponse(query, res);
    } else {
      console.log('Not authorized to execute query');
      const unauthorizedResponse: ErrorResponse = {
        message: 'Unauthorized to perform query',
      };
      res.status(403).send(unauthorizedResponse);
    }
  } catch (err) {
    // 500 for now
    const errResponse: ErrorResponse = { message: err.message };
    res.status(500).send(errResponse);
  }
});

function executeQueryAndSendResponse(query: string, res: Response): void {
  db.all(query, (err, rows) => {
    if (err) {
      // We'll assume it's a 400 for now.
      const errResponse: ErrorResponse = {
        message: 'Bad query, maybe?',
        // @ts-ignore
        errors: [err],
      };
      res.status(400).send(errResponse);
      return;
    } else {
      res.send({ data: rows });
    }
  });
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
