# springboot-oracle QA: REST API and Oracle database test project

A practical test project for the [`springboot-oracle`](https://github.com/iAMSagar44/springboot-oracle) demo application (Spring Boot 3.2.0, Java 17, Oracle Database 23c). It tests the real REST API with **Playwright Test (TypeScript)** and validates the real **Oracle** data with SQL. It does not test a browser UI because the application has none.

## What has actually been verified

| | Status |
|---|---|
| Application inspected (source, config, schema, tests) | Done, by reading every file |
| TypeScript type-check (`npm run typecheck`) | Passed |
| Test discovery (`npm run test:list`): 70 tests in 8 files, 7 projects | Passed (needs no database) |
| Docs consistent with tests (`npm run docs:check`) | Passed (see "Verification log" at the end) |
| **Application build** | **Not run**: the authoring environment had no Maven and could not reach Maven Central |
| **Any test against the application or Oracle** | **Not executed**: no Oracle, Docker or app was available there |
| Docker compose file, GitHub Actions workflow, Postman collection | Authored, **never executed** |

Every test case is therefore recorded as "Not executed" in [`docs/test-cases.csv`](docs/test-cases.csv). Nothing in this project claims a pass. The defects in [`docs/defects/candidate-defects.md`](docs/defects/candidate-defects.md) are **suspected from reading the code, not reproduced**. Follow the [first-run checklist](#first-run-checklist) to turn this into real results.

## Application under test (as inspected)

- One JPA entity `Person` (`id`, `firstName`, `lastName`, `birthDate`), one controller under `/data-app`, table `PERSON` in the application's Oracle schema.
- Endpoints (there is no update endpoint, no Swagger/OpenAPI and no Actuator, although `management.*` properties exist):

| Method and path | Behaviour found in the source |
|---|---|
| `GET /data-app/individuals` | all persons, JSON array |
| `GET /data-app/individuals/{id}` | one person; unknown id throws a bare `RuntimeException` (no handler) |
| `POST /data-app/individuals` | Bean Validation (`firstName`, `lastName` not blank; `birthDate` required, not in the future); answers 201 with an empty body |
| `DELETE /data-app/individuals/{id}` | deletes; answers 204; unknown id throws as above |

- **Database profile:** `spring.profiles.active=dev` in `application.properties`. `dev` = Oracle at `localhost:1521/FREEPDB1`, schema `SPRINGORCL`, via Oracle UCP and ojdbc11. `local` = in-memory H2, which is **not** a valid target here.
- **Schema and data:** the application does not create its table; run the DDL from the upstream README (`npm run db:init` does this from `sql/00_schema.sql`). `data.sql` inserts two sample rows at **every** start (`spring.sql.init.mode=always`).
- **Existing tests:** only `contextLoads`, which needs a live Oracle (so `mvn package` fails without one; use `-DskipTests`).
- Full list of suspected defects and observations: [`docs/defects/candidate-defects.md`](docs/defects/candidate-defects.md).

## Technologies and why

| Tool | Why |
|---|---|
| Playwright Test + TypeScript | Required for API automation; built-in HTTP client, fixtures with guaranteed teardown, projects with dependencies, HTML and JUnit reports. No browser is installed or launched. |
| node-oracledb (Thin mode) | Executes SQL against the real Oracle with no Oracle Client install. Works with Oracle 12.1 and later, including 23c. |
| `@types/oracledb` | The installed driver version ships no type definitions. |
| `tsx` | Runs the TypeScript helper scripts (`db:init`, `db:cleanup`, docs checks). |
| Docker Compose + `gvenzl/oracle-free` | Repeatable local Oracle Free that can create the application user. Any Oracle reachable by the same settings works instead. |
| Node's `process.loadEnvFile` | Reads `qa/.env` without adding a dotenv dependency. |

## Repository structure

```
.github/workflows/qa.yml       CI: build + static checks; Oracle tests with a service container
qa/
  playwright.config.ts         projects, reporters, no retries, one worker
  docker-compose.yml           local Oracle Database Free
  .env.example                 settings template (copy to .env; never commit .env)
  sql/00_schema.sql            DDL for PERSON (from the upstream README)
  sql/validation-queries.sql   every SQL statement the tests run, with purpose and expected result
  src/                         config, API client, Oracle session, PersonDb, fixtures, test-data builder
  tests/preflight              environment gate (Oracle, table, API, API-to-Oracle binding)
  tests/db                     Oracle schema, integrity and constraint checks
  tests/api/functional         status codes, structure, types
  tests/api/validation         invalid input, malformed requests, bad ids, unsupported methods
  tests/integration            API <-> Oracle round trips
  tests/known-defects          expected behaviour for suspected defects
  scripts/                     db-init, db-cleanup, SQL-reference generator, docs consistency check
  postman/                     collection + environment template
  docs/                        test plan, test cases (CSV), traceability matrix, SQL reference, defect template and register
```

## Prerequisites

Node.js 20.12 or later, Java 17 and Maven (the repository's wrapper `mvnw.cmd` is fine), Docker Desktop (or an existing Oracle 23c instance).

## Oracle database setup

```powershell
cd qa
Copy-Item .env.example .env
notepad .env                      # set ORACLE_SYS_PASSWORD and ORACLE_PASSWORD (choose your own values)
docker compose up -d
docker compose ps                 # wait until the status shows (healthy)
npm ci
npm run db:init                   # creates table PERSON if it does not exist (never drops anything)
```

Already running Oracle (for example from the upstream README)? Skip Docker: set `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING` in `qa/.env`, then run `npm run db:init`.

## Start the application

The upstream `application-dev.properties` contains a demo password. Do not use or copy it: override the connection with environment variables (they take precedence over the property files).

```powershell
cd <repository root>
$env:SPRING_PROFILES_ACTIVE      = 'dev'
$env:SPRING_DATASOURCE_URL       = 'jdbc:oracle:thin:@//localhost:1521/FREEPDB1'
$env:SPRING_DATASOURCE_USERNAME  = 'SPRINGORCL'
$env:SPRING_DATASOURCE_PASSWORD  = '<same value as ORACLE_PASSWORD>'
.\mvnw.cmd spring-boot:run
```

`spring-boot:run` activates Spring DevTools, so error responses may carry more detail than a packaged jar would give. The tests do not depend on error-body content.

**Confirm it uses Oracle, not H2**
1. Start-up log shows `The following 1 profile is active: "dev"`.
2. PF-04 (automated): a record POSTed to the API must appear in the Oracle schema the tests query. If the app runs on H2 or another database, PF-04 fails and blocks everything that depends on it.
3. Manually: `SELECT COUNT(*) FROM person;` before and after a POST.

## Run the tests

```powershell
cd qa
npm run test:list        # discovery only, needs no database
npm test                 # everything
npm run test:core        # release gate: preflight, db, api, integration (no known-defect checks)
npm run test:db          # Oracle SQL validation only (needs Oracle, not the application)
npm run test:api         # API functional + validation
npm run test:integration # API <-> Oracle
npm run test:defects     # known-defect checks
npm run report           # open the HTML report
npm run db:cleanup       # dry run: lists leftover QA rows from killed runs
npm run db:cleanup -- --yes
```

Reports are written to `qa/reports/html` and `qa/reports/junit.xml` (each run overwrites them). The JUnit file is standard XML that most CI and test-management tools can ingest; import into Xray was not tried.

### Settings

| Variable | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://localhost:8080` | Application root (the `/data-app` path is built in) |
| `ORACLE_USER` | `SPRINGORCL` | Application schema the tests query |
| `ORACLE_PASSWORD` | none, required | Password for that schema |
| `ORACLE_CONNECT_STRING` | `localhost:1521/FREEPDB1` | Easy Connect string |
| `ORACLE_SYS_PASSWORD` | none | Only for `docker-compose.yml` |
| `QA_REPORT_DIR` | `reports` | Report output folder |

Settings come from the shell first, then `qa/.env`. Credentials are never stored in source control.

## How tests are designed

- **Projects and gating.** `preflight-db` and `preflight-api` run first; the rest depend on them. A failed preflight shows dependants as "did not run" instead of a wall of misleading failures.
- **Controlled data.** Each test creates records with its own unique marker in the names, finds "its" rows by marker, and deletes only those rows afterwards (fixture teardown runs even if the test fails). No test depends on another or on the seed rows, except TC-DB-008 and TC-DB-009, which check the seed data on purpose.
- **One SQL library.** All SQL lives in `sql/validation-queries.sql`; [`docs/sql-reference.md`](docs/sql-reference.md) is generated from it, so the SQL reference cannot drift from the tests.
- **Honest failures.** No retries, no weakened assertions. Failure messages state what was called and what came back.
- **Known-defect checks** assert the *expected* behaviour. While a defect exists its check fails and names the defect; after the fix it becomes the regression guard. They are a separate project so the release gate stays meaningful.
- **Docs cannot drift silently.** `npm run docs:check` verifies that test IDs, the CSV, the traceability matrix, SQL metadata and the generated SQL reference agree.

## Interpreting results

| What you see | Class | First step |
|---|---|---|
| `preflight-db` fails | Environment or configuration | Oracle not running, wrong `ORACLE_*`, or `db:init` not run (the message says which) |
| PF-03 fails | Environment | Application not running or wrong `API_BASE_URL` |
| PF-04 fails | Configuration | Application is not writing to this Oracle schema (H2 profile, other database/PDB/schema) |
| "did not run" | Dependency failed | Fix the preflight first |
| `tests/db` failure | Data or schema | Read the offending rows in the message; TC-DB-009 fails after the app has restarted (suspected DEF-006) |
| API or integration failure after a green preflight | Test defect or application defect | Compare with the expectation source in the matrix (documented, observed or assumption); only an application defect gets a defect report |
| `known-defects` failure | Expected until fixed | Compare with `docs/defects/candidate-defects.md`; update the status |

## Postman

Files in `postman/`: `springboot-oracle.postman_collection.json` and `springboot-oracle.postman_environment.json` (contains only `baseUrl`, no credentials).

1. Postman: Import both files, select the environment, check `baseUrl`.
2. Run the collection folder with the Collection Runner, in order: steps 02 to 05 depend on each other (the API does not return the new id, so step 03 finds it by a marker).
3. Step 06 expects 404 for a deleted record and is predicted to fail (suspected DEF-001).

Division of labour: Postman is for manual exploration and smoke checks (about ten requests). The full, repeatable coverage, including every Oracle comparison, is automated in Playwright. The collection has no test cases of its own in the CSV, to avoid maintaining the same logic twice. The collection has **not** been run.

Swagger/OpenAPI is not available in this application, so there is nothing to document for it.

## CI

`.github/workflows/qa.yml` (never run):
- **static-checks**: builds the app (`-DskipTests`), type-checks, runs `docs:check`, lists tests. Needs no database.
- **oracle-tests**: starts an Oracle service container (`gvenzl/oracle-free`), creates the table, starts the built jar with `SPRING_DATASOURCE_*` pointing at it, runs `npm run test:core` (job fails if any test fails), then the known-defect checks (reported, non-blocking), and uploads the reports and the application log. Oracle results exist only when this job actually connected to the service container.
- Needs repository secrets `QA_ORACLE_SYS_PASSWORD` and `QA_ORACLE_APP_PASSWORD`. Pull requests from forks skip this job because they receive no secrets.

## Known limitations

- Nothing has been executed against the application or Oracle (see the top of this file).
- No requirements document exists; expectations are marked documented, observed or assumed in the [traceability matrix](docs/traceability-matrix.md).
- Table-level checks (TC-INT-002, TC-VAL-003, TC-VAL-004, TC-INT-006) assume no other writer during the run; use a dedicated schema.
- TC-DB-008 and TC-DB-009 depend on data state (the number of application starts since the table was created).
- The Docker image tag, the privileges of the user the image creates (needed for `CREATE TABLE`), and the Oracle dictionary queries were not exercised. If `db:init` fails with ORA-01031 or ORA-01950, grant the schema `CREATE TABLE` and a tablespace quota as an administrator, or create the user as the upstream README describes.
- Performance, concurrency, security and UI testing, and exploratory testing, are out of scope.

## First-run checklist

1. `npm ci`, `npm run typecheck`, `npm run test:list` (no database needed).
2. Start Oracle, `npm run db:init`, start the application once, check the log for profile `dev`.
3. `npx playwright test --project=preflight-db --project=preflight-api` must be green. If not, fix the environment before anything else.
4. `npm run test:db`, then `npm run test:core`.
5. `npm run test:defects`: for each failure, reproduce by hand (Postman or `curl`), then set the status in `docs/defects/candidate-defects.md` to Confirmed or Rejected and attach the report.
6. Record real results in `docs/test-cases.csv` (columns "Actual Result" and "Execution Status") and in the matrix. `docs:check` refuses a PASS status unless `QA_ALLOW_PASSED_STATUS=1` is set (PowerShell: `$env:QA_ALLOW_PASSED_STATUS = '1'`), so a pass can only be recorded deliberately after a run.

## Documents

[Test plan](docs/test-plan.md) · [Test cases](docs/test-cases.csv) · [Traceability matrix](docs/traceability-matrix.md) · [SQL reference](docs/sql-reference.md) · [Defect template](docs/defects/DEFECT_TEMPLATE.md) · [Candidate defects](docs/defects/candidate-defects.md)

## Verification log

What was actually run while authoring this project (no Oracle, Docker, Maven or running application was available, so none of it exercises the system under test):

| Check | Result |
|---|---|
| `npm run typecheck` (TypeScript 7.0.2, strict) | Passed |
| `npm run test:list` | 70 tests in 8 files across 7 projects listed; needs no database or secrets |
| `npm run docs:check` | Passed: 38 test cases, 38 IDs found in test titles, 34 SQL entries, matrix and SQL reference current |
| SQL syntax (sqlglot, Oracle dialect) | 34 of 34 library entries parse. Syntax only: nothing was executed on Oracle. The `RETURNING ... INTO` clause of FX-01 was removed before parsing because sqlglot does not parse it |
| SQL library cross-check | All 31 `sql('ID')` references in the code resolve; bind names in the code match the placeholders |
| GitHub Actions workflow | `actionlint` 1.7.7: no findings. The workflow itself has never run |
| `docker-compose.yml`, Postman files | YAML and JSON parse; the 12 Postman scripts pass a JavaScript syntax check. Neither was executed |
| Secrets scan | No credentials in the files added by this project; `.env` is git-ignored and absent; the workflow and compose file reference secrets or environment variables only. The upstream `README.md` and `application-dev.properties` contain a demo password that predates this project |
| Application code | `src/`, `pom.xml` and `Jenkinsfile` are unchanged |

Not run: application build, any test against the application or Oracle, Docker image pull, the CI workflow, the Postman collection.
