# Requirements traceability matrix

The repository contains **no requirements document, user stories or acceptance criteria**. The only written statements about the system are in the upstream `README.md`. Everything else is either behaviour observed in the source code or an assumption I introduced. The three sources are kept apart on purpose:

| Prefix | Meaning | Authority |
|---|---|---|
| `DOC-` | Stated in the upstream README | Documented requirement |
| `OBS-` | Observed by reading the source code | Implemented behaviour; **not** a stated requirement |
| `TA-` | Test assumption I introduced because no requirement exists | **Not** a requirement; open for confirmation by a product owner |

**Execution result:** no test has been executed against the real application and Oracle yet (the authoring environment had no Oracle, Docker or Maven Central access). Every result below is therefore "Not executed". See [`test-cases.csv`](test-cases.csv) for per-test detail.

## A. Documented (README)

| ID | Statement | Test cases | Execution result |
|---|---|---|---|
| DOC-01 | The REST API is served at `/data-app/individuals` | PF-03, TC-API-001, TC-API-002, TC-API-003, TC-API-004 | Not executed |
| DOC-02 | Profile `dev` uses Oracle, profile `local` uses H2 | PF-04 (proves the app writes to this Oracle schema) | Not executed |
| DOC-03 | Table `Person`: `id` identity primary key, `first_name`/`last_name` VARCHAR2(255) NOT NULL, `birth_date` DATE NOT NULL | PF-02, TC-DB-001, TC-DB-002, TC-DB-003, TC-DB-004, TC-DB-010, TC-DB-011, TC-DB-012 | Not executed |
| DOC-04 | Sample rows are inserted by `data.sql` at start-up | TC-DB-008, TC-DB-009 | Not executed |
| DOC-05 | Target database is Oracle Database 23c Free (service `FREEPDB1`) | PF-01 | Not executed |

## B. Observed behaviour (source code)

| ID | Observed behaviour | Test cases | Execution result |
|---|---|---|---|
| OBS-01 | `GET /individuals` returns all persons as a JSON array | TC-API-001, TC-INT-002 | Not executed |
| OBS-02 | `GET /individuals/{id}` returns one person | TC-API-002, TC-INT-001 | Not executed |
| OBS-03 | `POST /individuals` creates a person and answers 201 | TC-API-003, TC-INT-001, TC-INT-003, TC-INT-004, TC-INT-005 | Not executed |
| OBS-04 | POST validation: `firstName`/`lastName` not blank; `birthDate` required and not in the future | TC-VAL-001, TC-VAL-002, TC-DB-005, TC-DB-006 | Not executed |
| OBS-05 | Malformed JSON and unsupported content types are rejected by Spring MVC | TC-VAL-003 | Not executed |
| OBS-06 | The `{id}` path variable is an `int`; other values are rejected | TC-VAL-004 | Not executed |
| OBS-07 | `DELETE /individuals/{id}` removes the person and answers 204 | TC-API-004, TC-INT-001, TC-INT-007 | Not executed |
| OBS-08 | There is no update endpoint | TC-VAL-006 | Not executed |
| OBS-09 | Persons are stored in `PERSON` with a database-generated id; stored dates are calendar dates | TC-INT-001, TC-INT-003, TC-INT-004, TC-INT-005, TC-VAL-005, TC-DB-007 | Not executed |
| OBS-10 | An unknown id makes the controller throw a bare `RuntimeException` (no handler) | TC-INT-006, TC-DEF-001, TC-DEF-002 | Not executed |

## C. Test assumptions (not requirements)

| ID | Assumption | Test cases | Execution result |
|---|---|---|---|
| TA-01 | An unknown id should produce 404 Not Found | TC-DEF-001, TC-DEF-002 | Not executed |
| TA-02 | Invalid client input (including over-long values) should produce 400, never 5xx | TC-DEF-005, TC-VAL-001, TC-VAL-002, TC-VAL-003, TC-VAL-004 | Not executed |
| TA-03 | A 201 response should identify the created resource (`Location` header or id in the body; RFC 9110) | TC-DEF-003 | Not executed |
| TA-04 | POST is create-only and must not modify an existing record | TC-DEF-004 | Not executed |
| TA-05 | Methods the application does not implement should answer 405 | TC-VAL-006 | Not executed |
| TA-06 | Persons identical in first name, last name and birth date are duplicates (data-quality defect) | TC-DB-009 | Not executed |
| TA-07 | No other writer touches the test schema during a run (needed for table-level count and list comparisons) | TC-VAL-003, TC-VAL-004, TC-INT-002, TC-INT-006 | Not executed |
| TA-08 | The database character set supports Unicode (AL32UTF8, the Oracle Free default) | TC-INT-004 | Not executed |
| TA-09 | Names up to 255 characters are valid (column width) | TC-VAL-005 | Not executed |

## D. Not applicable

| Topic | Reason |
|---|---|
| Referential integrity | The schema has a single table and no foreign keys (checked by `DQ-05` in TC-DB-002) |
| Create/modify/delete beyond POST and DELETE | The application has no update endpoint |
| Browser UI testing | The application has no UI |
| Swagger/OpenAPI | The application does not provide it (no springdoc dependency) |
