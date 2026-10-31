-- =============================================================================
-- Oracle SQL library for the springboot-oracle QA project
--
-- This file is the single source of truth for every statement the automated tests run.
-- The test code loads statements from here by id (src/db/sqlLibrary.ts) and
-- docs/sql-reference.md is generated from it (npm run docs:sql).
--
-- Entry format:  "-- @id:" starts an entry; the other "-- @key:" lines describe it;
-- the first non-comment line starts the statement, which ends at the next "-- @id:".
-- Bind variables use :name syntax. To run an entry by hand in SQL*Plus / SQLcl / SQL Developer,
-- declare the binds (VARIABLE / EXEC) or replace them with literals.
-- All names refer to the schema discovered in the repository: table PERSON in the app user's schema.
-- =============================================================================

-- @id: ENV-01
-- @title: Identify the database product and version
-- @kind: query
-- @purpose: Proves the test connection talks to an Oracle Database (not H2 or another engine) and records the version in the report.
-- @expect: At least one row; PRODUCT starts with "Oracle".
-- @objects: PRODUCT_COMPONENT_VERSION
-- @used-by: PF-01
SELECT product AS "product",
       version AS "version"
FROM   product_component_version
WHERE  product LIKE 'Oracle%'
FETCH FIRST 1 ROWS ONLY;

-- @id: ENV-02
-- @title: Identify the session (schema, pluggable database, service)
-- @kind: query
-- @purpose: Records which schema and PDB the tests are connected to, so a reviewer can see that it is the one the application uses.
-- @expect: 1 row; sessionUser equals the configured ORACLE_USER (upper case).
-- @objects: SYS_CONTEXT('USERENV', ...), DUAL
-- @used-by: PF-01
SELECT SYS_CONTEXT('USERENV', 'SESSION_USER') AS "sessionUser",
       SYS_CONTEXT('USERENV', 'CON_NAME')     AS "container",
       SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS "service"
FROM   dual;

-- @id: DQ-01
-- @title: PERSON table exists in the connected schema
-- @kind: query
-- @purpose: The application does not create its table; a missing table is a setup problem, not an application defect.
-- @expect: Exactly 1 row (PERSON).
-- @objects: USER_TABLES
-- @used-by: PF-02
SELECT table_name AS "tableName"
FROM   user_tables
WHERE  table_name = 'PERSON';

-- @id: DQ-02
-- @title: Column definitions of PERSON
-- @kind: query
-- @purpose: Confirms the physical schema matches the documented DDL: types, VARCHAR2(255) widths and NOT NULL on every column. Column width is the basis for the length-boundary tests.
-- @expect: 4 rows. ID NUMBER not null; FIRST_NAME and LAST_NAME VARCHAR2 width 255 not null; BIRTH_DATE DATE not null.
-- @objects: USER_TAB_COLUMNS
-- @used-by: TC-DB-001
SELECT column_name AS "columnName",
       data_type   AS "dataType",
       char_length AS "charLength",
       nullable    AS "nullable"
FROM   user_tab_columns
WHERE  table_name = 'PERSON'
ORDER  BY column_id;

-- @id: DQ-03
-- @title: Primary key of PERSON
-- @kind: query
-- @purpose: A primary key on ID is what guarantees record identity for GET/DELETE by id.
-- @expect: Exactly 1 row: a primary-key constraint on column ID (the documented name is PK_PERSON, but only the column is asserted).
-- @objects: USER_CONSTRAINTS, USER_CONS_COLUMNS
-- @used-by: TC-DB-002
SELECT c.constraint_name AS "constraintName",
       cc.column_name    AS "columnName"
FROM   user_constraints c
JOIN   user_cons_columns cc
       ON  cc.constraint_name = c.constraint_name
       AND cc.table_name      = c.table_name
WHERE  c.table_name      = 'PERSON'
AND    c.constraint_type = 'P'
ORDER  BY cc.position;

-- @id: DQ-04
-- @title: Identity column definition
-- @kind: query
-- @purpose: The application never supplies an id (GenerationType.IDENTITY); the database must generate it.
-- @expect: Exactly 1 row: ID with generation type BY DEFAULT (as in the documented DDL).
-- @objects: USER_TAB_IDENTITY_COLS
-- @used-by: TC-DB-002
SELECT column_name     AS "columnName",
       generation_type AS "generationType"
FROM   user_tab_identity_cols
WHERE  table_name = 'PERSON';

-- @id: DQ-05
-- @title: Foreign keys touching PERSON
-- @kind: query
-- @purpose: Shows there are no relationships, which is why referential-integrity tests are not applicable to this schema.
-- @expect: 0 rows.
-- @objects: USER_CONSTRAINTS
-- @used-by: TC-DB-002
SELECT c.constraint_name   AS "constraintName",
       c.table_name        AS "tableName",
       c.r_constraint_name AS "referencedConstraint"
FROM   user_constraints c
WHERE  c.constraint_type = 'R'
AND   (c.table_name = 'PERSON'
       OR c.r_constraint_name IN (SELECT constraint_name
                                  FROM   user_constraints
                                  WHERE  table_name = 'PERSON'));

-- @id: DQ-06
-- @title: Primary-key uniqueness
-- @kind: query
-- @purpose: Duplicate ids would make GET/DELETE by id ambiguous. The PK constraint should make this impossible; the query proves it on the actual data.
-- @expect: 0 rows.
-- @objects: PERSON.ID
-- @used-by: TC-DB-003
SELECT id       AS "id",
       COUNT(*) AS "occurrences"
FROM   person
GROUP  BY id
HAVING COUNT(*) > 1;

-- @id: DQ-07
-- @title: Unexpected NULL values
-- @kind: query
-- @purpose: Every column is mandatory in both the DDL and the entity; a NULL means data entered by a path that bypassed both.
-- @expect: rowsWithNulls = 0.
-- @objects: PERSON.ID, FIRST_NAME, LAST_NAME, BIRTH_DATE
-- @used-by: TC-DB-004
SELECT COUNT(*) AS "rowsWithNulls"
FROM   person
WHERE  id IS NULL
OR     first_name IS NULL
OR     last_name IS NULL
OR     birth_date IS NULL;

-- @id: DQ-08
-- @title: Blank (whitespace-only) names
-- @kind: query
-- @purpose: Oracle stores an empty string as NULL, but a string of spaces is a valid non-NULL value that NOT NULL does not catch. TRIM(...) IS NULL finds both. The API rejects blanks (@NotBlank), so none should exist.
-- @expect: 0 rows.
-- @objects: PERSON.FIRST_NAME, LAST_NAME
-- @used-by: TC-DB-005
SELECT id AS "id"
FROM   person
WHERE  TRIM(first_name) IS NULL
OR     TRIM(last_name) IS NULL
ORDER  BY id;

-- @id: DQ-09
-- @title: Birth dates in the future
-- @kind: query
-- @purpose: The API enforces @PastOrPresent on birthDate; no stored row should be later than today. One day of tolerance absorbs time-zone differences between the JVM and the database.
-- @expect: 0 rows.
-- @objects: PERSON.BIRTH_DATE
-- @used-by: TC-DB-006
SELECT id AS "id",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate"
FROM   person
WHERE  birth_date > TRUNC(SYSDATE) + 1
ORDER  BY id;

-- @id: DQ-10
-- @title: Birth dates carrying a time component
-- @kind: query
-- @purpose: birthDate is a calendar date (LocalDate). A non-midnight time part would indicate a time-zone or driver-mapping problem between the JVM and Oracle DATE.
-- @expect: 0 rows.
-- @objects: PERSON.BIRTH_DATE
-- @used-by: TC-DB-007
SELECT id AS "id",
       TO_CHAR(birth_date, 'YYYY-MM-DD HH24:MI:SS') AS "storedValue"
FROM   person
WHERE  birth_date <> TRUNC(birth_date)
ORDER  BY id;

-- @id: DQ-11
-- @title: Seed rows from data.sql are present
-- @kind: query
-- @purpose: data.sql runs at application start (spring.sql.init.mode=always). Presence of its rows in THIS schema also shows the application started against this database.
-- @expect: 2 rows (Ross Smith 1994-05-15, Martin Taylo 1974-08-22), each with occurrences >= 1.
-- @objects: PERSON
-- @used-by: TC-DB-008
SELECT first_name AS "firstName",
       last_name  AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate",
       COUNT(*)   AS "occurrences"
FROM   person
WHERE (first_name, last_name, birth_date) IN (('Ross',   'Smith', DATE '1994-05-15'),
                                              ('Martin', 'Taylo', DATE '1974-08-22'))
GROUP  BY first_name, last_name, birth_date
ORDER  BY last_name;

-- @id: DQ-12
-- @title: Duplicate person identities
-- @kind: query
-- @purpose: Finds rows identical in first name, last name and birth date. Assumption TA-06: such rows are data-quality problems. On this schema the typical cause is data.sql re-running at every application restart (candidate defect DEF-006).
-- @expect: 0 rows (holds only on a database where the application has been started once since the table was created).
-- @objects: PERSON
-- @used-by: TC-DB-009
SELECT first_name AS "firstName",
       last_name  AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate",
       COUNT(*)   AS "occurrences"
FROM   person
GROUP  BY first_name, last_name, birth_date
HAVING COUNT(*) > 1
ORDER  BY COUNT(*) DESC, last_name;

-- @id: DQ-13
-- @title: Look up one person by id
-- @kind: query
-- @purpose: Reads the persisted state of a single record in the same shape as the API response, so API and database can be compared field by field.
-- @expect: 0 or 1 row depending on whether the id exists.
-- @objects: PERSON
-- @used-by: TC-INT-006, TC-INT-007, TC-VAL-006, TC-DEF-004
SELECT id AS "id",
       first_name AS "firstName",
       last_name  AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate"
FROM   person
WHERE  id = :id;

-- @id: DQ-14
-- @title: Look up the rows created by one test (by marker)
-- @kind: query
-- @purpose: The POST response does not return the new id (candidate defect DEF-003), so records created through the API are located by the unique marker the test put into the names.
-- @expect: One row per record the test created.
-- @objects: PERSON
-- @used-by: PF-04, TC-VAL-005, TC-INT-001, TC-INT-003, TC-INT-004
SELECT id AS "id",
       first_name AS "firstName",
       last_name  AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate"
FROM   person
WHERE  INSTR(last_name, :marker) > 0
OR     INSTR(first_name, :marker) > 0
ORDER  BY id;

-- @id: DQ-15
-- @title: Count the rows created by one test (by marker)
-- @kind: query
-- @purpose: Proves that an invalid request created no row at all (nothing persisted, no partial insert).
-- @expect: 0 after an invalid request.
-- @objects: PERSON
-- @used-by: TC-VAL-001, TC-VAL-002, TC-DEF-005
SELECT COUNT(*) AS "count"
FROM   person
WHERE  INSTR(last_name, :marker) > 0
OR     INSTR(first_name, :marker) > 0;

-- @id: DQ-16
-- @title: Count all rows
-- @kind: query
-- @purpose: Before/after comparison to show a failed or rejected operation changed nothing. Assumption TA-07: no other writer is active during the run.
-- @expect: Same value before and after the operation under test.
-- @objects: PERSON
-- @used-by: TC-VAL-003, TC-VAL-004, TC-INT-006, TC-DEF-002
SELECT COUNT(*) AS "count"
FROM   person;

-- @id: DQ-17
-- @title: All rows in API shape
-- @kind: query
-- @purpose: Full-table snapshot used to compare the API list against the database record by record.
-- @expect: Same records as GET /data-app/individuals.
-- @objects: PERSON
-- @used-by: TC-INT-002
SELECT id AS "id",
       first_name AS "firstName",
       last_name  AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate"
FROM   person
ORDER  BY id;

-- @id: DQ-18
-- @title: Aggregates over one test's rows
-- @kind: query
-- @purpose: Verifies a batch of API-created records with COUNT, MIN and MAX instead of reading them one by one.
-- @expect: count = number created; oldest/youngest equal the extreme birth dates sent.
-- @objects: PERSON
-- @used-by: TC-INT-005
SELECT COUNT(*) AS "count",
       TO_CHAR(MIN(birth_date), 'YYYY-MM-DD') AS "oldest",
       TO_CHAR(MAX(birth_date), 'YYYY-MM-DD') AS "youngest"
FROM   person
WHERE  INSTR(last_name, :marker) > 0
OR     INSTR(first_name, :marker) > 0;

-- @id: DQ-19
-- @title: Filter one test's rows by birth-date range
-- @kind: query
-- @purpose: Date filtering with BETWEEN on an Oracle DATE column, applied to API-created data.
-- @expect: Only rows whose birth date lies inside the range, ordered oldest first.
-- @objects: PERSON
-- @used-by: TC-INT-005
SELECT id AS "id",
       last_name AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate"
FROM   person
WHERE (INSTR(last_name, :marker) > 0 OR INSTR(first_name, :marker) > 0)
AND    birth_date BETWEEN TO_DATE(:dateFrom, 'YYYY-MM-DD') AND TO_DATE(:dateTo, 'YYYY-MM-DD')
ORDER  BY birth_date;

-- @id: DQ-20
-- @title: Oldest person among one test's rows
-- @kind: query
-- @purpose: Top-1 query using Oracle row limiting (FETCH FIRST), applied to API-created data.
-- @expect: 1 row: the earliest birth date sent.
-- @objects: PERSON
-- @used-by: TC-INT-005
SELECT id AS "id",
       last_name AS "lastName",
       TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate"
FROM   person
WHERE  INSTR(last_name, :marker) > 0
OR     INSTR(first_name, :marker) > 0
ORDER  BY birth_date ASC, id ASC
FETCH FIRST 1 ROWS ONLY;

-- @id: DQ-21
-- @title: Stored text of a birth date, including time
-- @kind: query
-- @purpose: Shows exactly what Oracle stored for the date the API received, down to the time of day, to expose time-zone shifts.
-- @expect: The date sent followed by 00:00:00.
-- @objects: PERSON.BIRTH_DATE
-- @used-by: TC-INT-003
SELECT TO_CHAR(birth_date, 'YYYY-MM-DD HH24:MI:SS') AS "storedValue"
FROM   person
WHERE  id = :id;

-- @id: DQ-22
-- @title: An id that does not exist
-- @kind: query
-- @purpose: Gives tests a guaranteed-unused id (current maximum plus one million) for "record not found" scenarios.
-- @expect: 1 row with a number larger than every existing id.
-- @objects: PERSON.ID
-- @used-by: TC-DB-011, TC-INT-006, TC-DEF-001, TC-DEF-002
SELECT NVL(MAX(id), 0) + 1000000 AS "unusedId"
FROM   person;

-- @id: FX-01
-- @title: Fixture - insert a person and return its generated id
-- @kind: fixture
-- @purpose: Creates controlled test data directly in Oracle (bypassing the API) so API reads are tested against a known record.
-- @expect: 1 row inserted; the identity value is returned.
-- @objects: PERSON
-- @used-by: all tests that need pre-existing data
INSERT INTO person (first_name, last_name, birth_date)
VALUES (:firstName, :lastName, TO_DATE(:birthDate, 'YYYY-MM-DD'))
RETURNING id INTO :id;

-- @id: FX-02
-- @title: Fixture cleanup - delete the rows carrying one test's marker
-- @kind: fixture
-- @purpose: Safe teardown: removes only rows whose names contain the unique marker generated for the test, never unrelated records.
-- @expect: Removes exactly the rows the test created (directly or through the API).
-- @objects: PERSON
-- @used-by: every test using the data fixture
DELETE FROM person
WHERE  INSTR(last_name, :marker) > 0
OR     INSTR(first_name, :marker) > 0;

-- @id: FX-03
-- @title: Fixture cleanup - delete one row by id
-- @kind: fixture
-- @purpose: Removes a single row created by a test.
-- @expect: 0 or 1 row deleted.
-- @objects: PERSON
-- @used-by: fixture helper
DELETE FROM person
WHERE  id = :id;

-- @id: FX-04
-- @title: Preview leftover QA rows from earlier runs
-- @kind: fixture
-- @purpose: Lists rows whose names contain a QA marker (QA- plus 10 lowercase alphanumerics), e.g. after a run that was killed before cleanup. Used by "npm run db:cleanup" in dry-run mode.
-- @expect: Only rows created by this test suite.
-- @objects: PERSON
-- @used-by: db:cleanup script
SELECT id AS "id",
       first_name AS "firstName",
       last_name  AS "lastName"
FROM   person
WHERE  REGEXP_LIKE(first_name, 'QA-[0-9a-z]{10}')
OR     REGEXP_LIKE(last_name,  'QA-[0-9a-z]{10}')
ORDER  BY id;

-- @id: FX-05
-- @title: Delete leftover QA rows from earlier runs
-- @kind: fixture
-- @purpose: Same predicate as FX-04, applied as a DELETE. Runs only with "npm run db:cleanup -- --yes".
-- @expect: Removes only rows carrying a QA marker.
-- @objects: PERSON
-- @used-by: db:cleanup script
DELETE FROM person
WHERE  REGEXP_LIKE(first_name, 'QA-[0-9a-z]{10}')
OR     REGEXP_LIKE(last_name,  'QA-[0-9a-z]{10}');

-- @id: NEG-01
-- @title: Constraint check - NULL first_name is rejected
-- @kind: negative
-- @purpose: The database itself must refuse incomplete rows, independent of any application validation. Executed inside a transaction that is always rolled back.
-- @expect: ORA-01400 (cannot insert NULL).
-- @objects: PERSON.FIRST_NAME (NOT NULL)
-- @used-by: TC-DB-010
INSERT INTO person (first_name, last_name, birth_date)
VALUES (NULL, 'Negative', TO_DATE('1990-01-15', 'YYYY-MM-DD'));

-- @id: NEG-02
-- @title: Constraint check - NULL last_name is rejected
-- @kind: negative
-- @purpose: Same as NEG-01 for LAST_NAME.
-- @expect: ORA-01400.
-- @objects: PERSON.LAST_NAME (NOT NULL)
-- @used-by: TC-DB-010
INSERT INTO person (first_name, last_name, birth_date)
VALUES ('Negative', NULL, TO_DATE('1990-01-15', 'YYYY-MM-DD'));

-- @id: NEG-03
-- @title: Constraint check - NULL birth_date is rejected
-- @kind: negative
-- @purpose: Same as NEG-01 for BIRTH_DATE.
-- @expect: ORA-01400.
-- @objects: PERSON.BIRTH_DATE (NOT NULL)
-- @used-by: TC-DB-010
INSERT INTO person (first_name, last_name, birth_date)
VALUES ('Negative', 'Negative', NULL);

-- @id: NEG-04
-- @title: Constraint check - duplicate primary key is rejected
-- @kind: negative
-- @purpose: Executed twice with the same id inside one rolled-back transaction; the second execution must fail.
-- @expect: First insert succeeds, second fails with ORA-00001 (unique constraint violated).
-- @objects: PERSON.ID (primary key)
-- @used-by: TC-DB-011
INSERT INTO person (id, first_name, last_name, birth_date)
VALUES (:id, 'Negative', 'Negative', TO_DATE('1990-01-15', 'YYYY-MM-DD'));

-- @id: NEG-05
-- @title: Constraint check - value wider than the column is rejected
-- @kind: negative
-- @purpose: Executed with a 256-character first_name against a VARCHAR2(255) column. Documents the database-side limit that the application does not validate (candidate defect DEF-005).
-- @expect: ORA-12899 (value too large for column ... maximum: 255).
-- @objects: PERSON.FIRST_NAME (VARCHAR2(255))
-- @used-by: TC-DB-012
INSERT INTO person (first_name, last_name, birth_date)
VALUES (:firstName, 'Negative', TO_DATE('1990-01-15', 'YYYY-MM-DD'));
