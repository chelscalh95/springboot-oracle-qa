# Test plan: springboot-oracle REST API and Oracle database

## 1. Purpose
Validate the REST API of the `springboot-oracle` demo application and the integrity of the data it stores in Oracle Database, with repeatable automated tests. Secondary purpose: a portfolio demonstrating API testing, Oracle SQL validation, defect documentation and test-process discipline.

## 2. Scope
**In scope**
- The four endpoints that exist: `GET /data-app/individuals`, `GET /data-app/individuals/{id}`, `POST /data-app/individuals`, `DELETE /data-app/individuals/{id}`.
- Request validation and error handling of those endpoints.
- Persistence of API operations in table `PERSON` of the application's Oracle schema.
- Schema, constraints and data integrity of `PERSON` (Oracle SQL).
- Regression checks for candidate defects (section 9).

**Out of scope / exclusions**
- Browser or UI testing (the application has no UI).
- Exploratory testing as a separate objective.
- Security penetration and concurrency testing.
- Oracle UCP connection-pool behaviour, Oracle installation and the Jenkins pipeline of the upstream repository.
- Any Hansen Technologies software; only the repository's own functionality is tested.

## 3. Application under test
Spring Boot 3.2.0, Java 17, Spring MVC, Spring Data JPA (Hibernate), Bean Validation, Oracle JDBC (ojdbc11) with Oracle UCP. Profile `dev` (default) uses Oracle at `localhost:1521/FREEPDB1`; profile `local` uses in-memory H2 and is **not** a valid target for this plan. Details and findings: [README](../README.md).

## 4. Requirements basis
No requirements document exists. Test conditions are derived from (a) the upstream README, (b) behaviour observed in the source, and (c) explicit test assumptions. See the [traceability matrix](traceability-matrix.md), which keeps the three apart.

## 5. Test approach
| Level | Technique | Where |
|---|---|---|
| Preflight | Environment gate: Oracle reachable and identified, table present, API reachable, API writes land in the Oracle schema under test | `tests/preflight` |
| API functional | Status codes, headers, response structure and types against records created directly in Oracle | `tests/api/functional` |
| API validation | Data-driven invalid input, malformed requests, bad path values, unsupported methods; each proves nothing was persisted | `tests/api/validation` |
| Integration | API call, then verification in Oracle by SQL, then retrieval through the API; lifecycle, date and character round trips, SQL aggregates | `tests/integration` |
| Oracle validation | SQL-only checks of schema, keys, NULLs, duplicates, blanks, dates; constraint enforcement tests in rolled-back transactions | `tests/db` |
| Known-defect checks | Encode the expected behaviour for candidate defects; fail while the defect exists | `tests/known-defects` |

**Test data.** Every test generates a unique marker (`QA-` + 10 characters) and embeds it in the names of the records it creates. Assertions find "their" rows by marker; teardown deletes only rows carrying that marker, even when the test failed. `npm run db:cleanup` removes leftovers of killed runs (dry run by default).
**Independence.** No test depends on another or on execution order. Tests run serially (one worker) because they share one schema.
**No retries.** A failing test is investigated, never retried into green.
**Failure classification.** Preflight failures are environment/configuration problems, because dependants are reported as "did not run". Failures after a green preflight are test defects or application defects (see README, "Interpreting results").

## 6. Environment
| Item | Requirement |
|---|---|
| Oracle | Oracle Database 23c/23ai Free (documented target), service `FREEPDB1`, application schema `SPRINGORCL`; real Oracle only, never H2 or another substitute |
| Application | Built from this repository, run with profile `dev` and database settings supplied by `SPRING_DATASOURCE_*` environment variables |
| Test runner | Node.js 20.12 or later, Playwright Test, node-oracledb (Thin mode) |
| Secrets | Environment variables or a git-ignored `qa/.env`; never committed |

## 7. Dependencies
Docker (or an existing Oracle instance), Java 17 and Maven (or the repository's Maven wrapper), Node.js, network access to npm. For CI: GitHub Actions with the `QA_ORACLE_SYS_PASSWORD` and `QA_ORACLE_APP_PASSWORD` repository secrets.

## 8. Coverage
38 test cases ([`test-cases.csv`](test-cases.csv)) implemented as 70 Playwright tests (data-driven cases expand into several tests): 4 preflight, 14 Oracle validation, 4 API functional, 28 API validation, 13 integration and 7 known-defect checks. Every endpoint has success, not-found/invalid and persistence coverage; see the matrix.

## 9. Known risks and candidate defects
| Risk | Mitigation |
|---|---|
| Static analysis suggests six defects (`docs/defects/candidate-defects.md`) that are **unconfirmed** until the suite is executed | Dedicated known-defect project; assertions not weakened; statuses updated after the first real run |
| `data.sql` re-inserts seed rows at each restart, so absolute row counts are unreliable | Tests use markers and before/after comparisons; TC-DB-009 reports the duplicates |
| A table-level comparison can flake if another writer is active | Assumption TA-07; serial execution; dedicated schema recommended |
| Application accidentally started with the `local` (H2) profile | PF-04 fails and blocks the dependent tests |
| The upstream repository commits a demo database password | The suite and docs never use it; credentials come from the environment |
| Docker image tags, Oracle behaviour and the CI workflow were not exercised in the authoring environment | Documented as unverified; first-run checklist in the README |

## 10. Entry and exit criteria
**Entry:** Oracle healthy; `PERSON` table present; application started once against it; `ORACLE_*` variables set; preflight green.
**Exit (release-readiness view):**
1. All preflight tests pass, and no Oracle substitute was used (PF-01 evidence attached to the report).
2. `npm run test:core` passes completely.
3. Every failing known-defect check is linked to an open defect record with evidence; a fixed defect's check passes and stays in the gate.
4. No unreviewed failure; reports (HTML and JUnit) archived with the run.

## 11. Reporting and defect handling
HTML report (`qa/reports/html`) and JUnit XML (`qa/reports/junit.xml`, importable into most CI and test-management tools; import into Xray not verified). Defects use [`docs/defects/DEFECT_TEMPLATE.md`](defects/DEFECT_TEMPLATE.md). Test execution results are recorded in `test-cases.csv` (columns "Actual Result" and "Execution Status") after a real run; unexecuted cases stay "Not executed".

## 12. Execution status
No test has been executed yet. Reason: the environment in which the suite was authored had no Oracle, no Docker and no access to Maven Central, so neither the application nor the database could be started there.
