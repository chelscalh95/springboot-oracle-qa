# Case study: API and Oracle database testing for a Spring Boot application

**Status: built and statically checked, not yet executed.** Section 6 explains exactly what that means. Replace the "to be filled" placeholders only with real results from a real run.

## 1. Context

I am a Software Test Engineer with about eight years of experience, moving from mostly manual testing into API and database automation. To practice and demonstrate that, I took an existing open-source demo application and built a complete test project around it, aimed at the kind of work in an Associate Test Engineer role: REST API testing, Oracle SQL validation, automation, defect documentation and test-process discipline.

**Application under test:** [`iAMSagar44/springboot-oracle`](https://github.com/iAMSagar44/springboot-oracle), a Java 17 / Spring Boot 3.2 REST API backed by Oracle Database 23c. It manages one kind of record (a person with first name, last name and birth date) through four endpoints: list, get by id, create and delete.

**AI assistance:** I built this project with AI assistance, and I used a second, separate AI-guided walkthrough to learn how the Spring Boot application itself works (layers, configuration, Hibernate, Maven), so I could reason about failures rather than treat the code as a black box.

## 2. Goals and constraints

- Test the real application against a real Oracle database. No H2 or other substitute is ever acceptable, and the suite proves which database the application actually writes to.
- Use Playwright Test with TypeScript for API automation (no browser; the application has no UI).
- Validate persisted data with Oracle SQL: constraints, integrity, API-to-database consistency.
- Never claim a result that was not produced by a run. Never commit secrets.
- Keep it understandable and maintainable rather than impressive-looking.

## 3. What I found by inspecting the application first

I read every file before writing a test. Findings that shaped the design:

- There is no requirements document, no OpenAPI/Swagger, no health endpoint (the Actuator settings are present but the dependency is not) and no update endpoint.
- The only existing test boots the whole application and needs a live Oracle, so a plain `mvn package` fails without one.
- The table is not created by the application; the DDL lives only in the README.
- `data.sql` runs on every start, and nothing prevents duplicate rows.
- The repository's `.gitignore` ignores every file named `README.md`, which would have hidden my own documentation.
- The upstream repository commits a demo database password. My project never uses it; credentials come from environment variables.

## 4. Approach and design decisions

| Decision | Why |
|---|---|
| A **preflight** gate (Oracle reachable, table present, API reachable, API writes land in this Oracle schema) | An environment problem should show as "did not run", not as a wall of misleading failures. The last check also rules out the H2 profile. |
| **One SQL library** (`sql/validation-queries.sql`) used by the tests; the SQL reference is generated from it | The documentation cannot drift away from what the tests actually run. |
| **Unique marker per test** in the data it creates; teardown deletes only rows carrying that marker | Repeatable tests, safe cleanup, no dependence on execution order or seed rows. |
| **Direct SQL setup** for read tests; **SQL verification** after writes | Tests compare the API's answer with the database's, field by field. |
| **Known-defect checks in their own project**; assertions never weakened | The release gate stays meaningful, and each suspected defect has a precise test. |
| No retries, one worker | A flaky test gets investigated, not hidden; tests share one schema. |
| A script (`docs:check`) that cross-checks test IDs, the CSV, the traceability matrix and the SQL reference | Documentation and implementation agree, and a PASS status cannot be recorded by accident. |
| Clear separation of **documented**, **observed** and **assumed** expectations in the traceability matrix | No requirements exist, so I did not present my assumptions as requirements. |

## 5. What was built

- **38 test cases** (`docs/test-cases.csv`), implemented as **70 Playwright tests** in 7 projects: preflight, Oracle validation, API functional, API validation, integration and known-defect checks.
- **34 documented Oracle SQL statements**: schema and constraint checks, NULL, blank and duplicate detection, date and time-of-day checks, row counts, filters, aggregates and constraint-violation tests (ORA-01400, ORA-00001, ORA-12899) run inside rolled-back transactions.
- API-to-database integration tests: create/read/delete lifecycle, list versus table, date round trips (including a leap day), special characters and an SQL-injection-style string, batch verification with SQL aggregates.
- A Postman collection and environment template for manual exploration, a Docker Compose file for a local Oracle, and a GitHub Actions workflow (static checks; Oracle tests against a service container).
- Test plan, traceability matrix, defect template, a register of suspected defects and a README with PowerShell commands.

## 6. Results: what is verified and what is not

**Verified during authoring:**

| Check | Result |
|---|---|
| TypeScript type-check (strict) | Passed |
| Test discovery | 70 tests in 8 files listed |
| Docs-versus-tests consistency check | Passed (38 test cases, 38 IDs found in test titles, 34 SQL entries) |
| SQL syntax (parsed with the Oracle dialect) | 34 of 34 entries parse; syntax only |
| GitHub Actions workflow lint | No findings |
| Postman scripts | JSON valid; 12 scripts pass a syntax check |
| Secrets scan | No credentials in the files added by this project |
| Application code | Unchanged |

**Not executed:** the authoring environment had no Oracle, no Docker and no access to Maven Central, so the application could not be built or started. **No test has run against the application or Oracle.** Every test case is recorded as "Not executed", and the workflow, Docker image and Postman collection have never been run.

**Suspected defects (from reading the source; unconfirmed):**

| ID | Suspicion | Related check |
|---|---|---|
| DEF-001 | `GET` of an unknown id gives 500, not 404 | known-defect check |
| DEF-002 | `DELETE` of an unknown id gives 500, not 404 | known-defect check |
| DEF-003 | `POST` returns 201 with no body and no `Location` header | known-defect check |
| DEF-004 | `POST` with an existing `id` may overwrite that record | known-defect check |
| DEF-005 | Names over 255 characters cause a 500 instead of a 400 | known-defect check and an Oracle constraint test |
| DEF-006 | Restarting the app duplicates the seed rows | Oracle duplicate-detection check |

Each is documented as "suspected, not yet reproduced", with source line references as evidence. They become defects only after a real run confirms them.

**First real run (to be filled in):**

| Item | Result |
|---|---|
| Date and environment | _to be filled_ |
| Preflight | _to be filled_ |
| Core suite (passed / failed / skipped) | _to be filled_ |
| Known-defect checks, and which suspicions were confirmed or rejected | _to be filled_ |
| Test-code bugs found and fixed on first run | _to be filled_ |

## 7. Challenges and what I would do differently

- **Environment limits.** Not being able to run the application changed the project's shape: the honest status labels, the static verification and the first-run checklist exist because of it. With a working environment, I would run the suite as I wrote each layer instead of at the end.
- **No requirements.** I had to infer expected behaviour. I kept inferred expectations (for example "an unknown id returns 404") labelled as assumptions and open for a product owner to confirm.
- **Shared database state.** Seed duplication and table-wide comparisons made some checks depend on data state. I documented those dependencies instead of hiding them.
- **Next steps:** run the first-run checklist and record real results; confirm or reject each suspected defect with a reproduction; add unit and slice tests inside the application (`@WebMvcTest`, `@DataJpaTest`); consider Testcontainers for an Oracle instance owned by the tests.

## 8. Skills

**Demonstrated by this project (design and authoring):** REST API test design, negative and boundary testing, Oracle SQL for validation and troubleshooting, data-integrity checks, API-to-database integration testing, test data management and cleanup, Playwright with TypeScript, test planning, traceability, defect documentation, CI design, and careful separation of facts, inferences and assumptions.

**Still requiring execution or professional experience:** running and debugging this suite against a live system; working with Jira and Xray in a team workflow (the JUnit XML output is a plausible import path, never tried); release-readiness decisions on a real product; testing proprietary systems; Selenium or Cypress (not used here).

## 9. Repository map

```
qa/README.md                       how to run everything
qa/docs/test-plan.md               scope, approach, risks, exit criteria
qa/docs/test-cases.csv             38 test cases with status
qa/docs/traceability-matrix.md     documented vs observed vs assumed expectations
qa/docs/sql-reference.md           generated from sql/validation-queries.sql
qa/docs/defects/                   defect template and suspected-defect register
qa/postman/                        collection and environment template
.github/workflows/qa.yml           CI workflow
```
