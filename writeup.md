# Chrome Take-Home

## How to run and use

```shell
npm install
npm run dev
```
Server will start at `localhost:3000` with the API running and an in-memory SQLite db. 

### Using the API

Please refer to the OpenAPI spec. It has some examples for defining authz policies. The `POST /policies` endpoint has documentation for the evaluation logic of the policies to help you understand the mental model.

To see and test some actual examples, please refer to (and run) `sample_api_flow.sh`. It performs an e2e API flow, going through:
```
Creating an API key -> 
(and a few cycles of) 
Creating some policies --> 
Querying the db -> 
Deleting some policies
```

## Thought process

### Authz API

I tried to design the authz API in a way that:

1. Is intuitive to use but is flexible enough for the assignment at hand ("Simple things should be simple; complex things should be possible" — Alan Kay)
2. Prioritizes security if mistakes are made
3. Allows future complexity to be added incrementally

The allow-nothing design (refer to the API spec) ensures that users aren't permitted to perform actions unless they're explicitly granted authorization. This makes it harder to create security holes, and the deny policies allow easy "patching" if needed.

The design is flexible enough for simple cases like allowing access to all tables, or select to a single table, but allows more complicated policies like _"allow update to everything except table1, delete to table2, and select on all tables"._

With this design, one can imagine column-level access would be relatively straightforward: just add another `columns` parameter to the policy definition.

A place where I should've simplified more is in naming of "resource" (which in this design == "table"). I was originally planning to support DDLs and considered other resources (i.e. constraints, sequences), but this became too hairy and abstract. Ideally, I would've renamed "resource" to "table", and probably moved `/policies` to `/policies/tables` (or something like that) I but didn't want to do a big find-replace, and wanted to actually document this failing in my thought process.

### System design tradeoffs

This design trades off performance and a deeper integration with SQLite for more flexibility, portability (across different databases) and simplicity in implementation. There are one way doors (authz policy language), but the particular implementation (API server on top of db) is a two-way door that's reasonable for a POC. 

The resulting implementation is relatively simple, flexible, and easy to use — however, it doesn't consider scenarios such as policies being defined for nonexistent tables, or tables being deleted and policies having dangling references. It also has to make a round-trip (assuming policies are stored in some database, not in memory) for authz.

Some deeper integration with a DB (via system catalog in the case of PG, for example) would allow for this at the expense of coupling implementation to a database. I think in the future this would be a reasonable tradeoff to make.

Also, for simplicity, policies are stored in memory. In a production system, policies would probably be stored (indexed properly) in SQL database — this would make querying easier and more efficient, and would ensure relational integrity once you start to integrate more deeply with a database's system catalogs.

### Deployed setup

Deploying this would be relatively straightforward — an API server as a sidecar. Policies would be stored in the database they're operating on, making for a simpler implementation, and one that allows for a realistic deeper integration that most DB permissioning systems have. There would still be round trip time for authorizing (could be optimized by caching, indexes, etc.), but this is a tradeoff for a simpler, less coupled (and more realistic for this assignment) implementation.

### Tools used

A quick overview of tools used:
1. OpenAPI - Killing two birds with one stone (nice self-explanatory spec, and code-gen for the boring bits)
2. Node/express/TS - Great for prototyping. I set up `npm run dev` to have hot reload, so feel free to screw around (policies aren't persistent though).