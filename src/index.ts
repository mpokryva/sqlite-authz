import express, { Request, Response } from 'express';
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run("CREATE TABLE lorem (info TEXT)");

  const stmt = db.prepare("INSERT INTO lorem VALUES (?)");
  for (let i = 0; i < 10; i++) {
    stmt.run("Ipsum " + i);
  }
  stmt.finalize();

});


const app = express();
const port = 3000;

app.get('/', (_: Request, res: Response) => {
  db.all("SELECT rowid AS id, info FROM lorem", (_, rows) => {
    if (rows) {
      res.send(rows);
    } else {
      res.send("No data!");
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


