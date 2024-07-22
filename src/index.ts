import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
// import type { components } from './model';
import expressBasicAuth from 'express-basic-auth';

// type ErrorResponse = components["schemas"]["Error"];



const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

// TODO: Remove eventually
db.serialize(() => {
  db.run("CREATE TABLE lorem (info TEXT)");

  const stmt = db.prepare("INSERT INTO lorem VALUES (?)");
  for (let i = 0; i < 10; i++) {
    stmt.run("Ipsum " + i);
  }
  stmt.finalize();

});


// TODO: Clean up (reorganize)
const app = express();
app.use(bodyParser.json());
const apiKeyAuthMiddleware = expressBasicAuth({authorizer: apiKeyAuthorizer});
app.use((req, res, next) => shouldAuthenticate(req) ? apiKeyAuthMiddleware(req, res, next) : next());
const port = 3000;

function shouldAuthenticate(req: Request): boolean {
 return (!(req.path === "/api_keys" && req.method === "POST"));
}

function apiKeyAuthorizer(user: string, _: string): boolean {
  return apiKeys.has(user);
}

app.get('/', (_: Request, res: Response) => {
  db.all("SELECT rowid AS id, info FROM lorem", (_, rows) => {
    if (rows) {
      res.send(rows);
    } else {
      res.send("No data!");
    }
  });
});

const apiKeys = new Set<String>();
let apiKeyCounter = 0;
app.post("/api_keys", (_: Request, res: Response) => {
  let newApiKey = `api_key_${apiKeyCounter}`;
  apiKeys.add(newApiKey);
  // TODO: Race condition?
  apiKeyCounter++;
  res.send({
    key: newApiKey
  });
});

app.post("/query", (req: Request, res: Response) => {
  const query = req.body.query;
  if (!query) {
    res.send({"error": "must provide query"});
  } else {
    db.all(query, (err, rows) => {
      if (err) {
        res.status(400).send(err);
        return;
      } else {
       res.send({data: rows});
      }
    });
  }
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


