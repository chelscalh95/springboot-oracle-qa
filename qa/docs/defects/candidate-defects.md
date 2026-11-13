# Candidate defects

**Status of everything below: suspected, not yet reproduced.** They were found by reading the application source, because the authoring environment could not run the application. No request has been sent and no result observed, so the "Actual result" lines are predictions from code, not evidence of behaviour. Run `npm run test:defects` against a real environment to confirm or reject each one, then update the status and attach the HTML report.

Common environment for all entries: application `iAMSagar44/springboot-oracle` (Spring Boot 3.2.0, Java 17), profile `dev`, Oracle Database 23c Free. Source references are to `src/main/java/com/demo/datasource/getIndividualData/`.
Expectations marked TA-## are test assumptions (see the [traceability matrix](../traceability-matrix.md)), not documented requirements.

---

## DEF-001: GET of an unknown id returns 500 instead of 404
| Field | Content |
|---|---|
| Summary | `GET /data-app/individuals/{id}` for a non-existent id is expected to fail with a server error |
| Preconditions | An id that is not in `PERSON` (for example 0, -1, or max id + 1,000,000) |
| Steps | 1) `GET /data-app/individuals/0` |
| Expected | 404 Not Found (TA-01) |
| Predicted actual | 500 Internal Server Error with Spring's default error body |
| Severity / Priority | Medium / Medium |
| Evidence (static) | `controller/PersonController.java:31` throws `new RuntimeException()` from `orElseThrow`; no `@ControllerAdvice`, `@ExceptionHandler` or `@ResponseStatus` exists anywhere in `src` |
| Reproducibility | Expected always (deterministic code path) |
| Related test case | TC-DEF-001 |
| Status | Suspected, not yet reproduced |

## DEF-002: DELETE of an unknown id returns 500 instead of 404
| Field | Content |
|---|---|
| Summary | `DELETE /data-app/individuals/{id}` for a non-existent id is expected to fail with a server error |
| Preconditions | An id that is not in `PERSON` |
| Steps | 1) Count rows. 2) `DELETE /data-app/individuals/{unused id}`. 3) Count rows. |
| Expected | 404 Not Found; row count unchanged (TA-01) |
| Predicted actual | 500; row count unchanged (the exception is thrown before the delete) |
| Severity / Priority | Medium / Medium |
| Evidence (static) | `controller/PersonController.java:42` (same `RuntimeException` pattern) |
| Reproducibility | Expected always |
| Related test case | TC-DEF-002 (status), TC-INT-006 (database unchanged) |
| Status | Suspected, not yet reproduced |

## DEF-003: POST answers 201 without identifying the created resource
| Field | Content |
|---|---|
| Summary | The client cannot learn the id of the record it just created |
| Preconditions | None |
| Steps | 1) `POST /data-app/individuals` with a valid body. 2) Inspect response headers and body. |
| Expected | 201 with a `Location` header or the created record in the body (TA-03, based on RFC 9110) |
| Predicted actual | 201 with an empty body and no `Location` header |
| Severity / Priority | Low / Medium (workaround: find the record via the list or SQL, as the suite does) |
| Evidence (static) | `controller/PersonController.java:35-37` returns `new ResponseEntity<>(HttpStatus.CREATED)` with no body or headers |
| Reproducibility | Expected always |
| Related test case | TC-DEF-003 |
| Status | Suspected, not yet reproduced |

## DEF-004: POST with an existing id may overwrite that record
| Field | Content |
|---|---|
| Summary | A create endpoint accepts a client-supplied `id`; Spring Data JPA `save()` merges entities that have an id, so an existing row may be updated |
| Preconditions | An existing record A |
| Steps | 1) `POST /data-app/individuals` with `{"id": <A's id>, "firstName": "Overwritten", ...}`. 2) Read A from Oracle. |
| Expected | A unchanged (request rejected, or a separate record created) (TA-04) |
| Predicted actual | A's columns replaced; response 201 |
| Severity / Priority | High (silent data modification) / Medium |
| Evidence (static) | `model/Person.java:60` public `setId`, so Jackson binds `id`; `service/PersonServiceImpl.java:33` calls `personRepository.save(person)`; Spring Data treats a non-null id as an existing entity |
| Reproducibility | Expected always |
| Related test case | TC-DEF-004 |
| Status | Suspected, not yet reproduced (least certain of the six: depends on Hibernate merge behaviour) |

## DEF-005: Over-long names cause a server error instead of a validation error
| Field | Content |
|---|---|
| Summary | `firstName`/`lastName` have no length validation, while the columns are `VARCHAR2(255)` |
| Preconditions | None |
| Steps | 1) `POST` a person whose `firstName` has 256 characters. 2) Count rows with that name. |
| Expected | 400 Bad Request; nothing persisted (TA-02) |
| Predicted actual | 500 after the database rejects the insert with ORA-12899 |
| Severity / Priority | Medium / Medium |
| Evidence (static) | `model/Person.java:18-27` has `@NotBlank`/`@NotEmpty`/`@NotNull` but no `@Size`; `@Column` (lines 21, 24) keeps the default length 255; database side proven by TC-DB-012 |
| Reproducibility | Expected always |
| Related test case | TC-DEF-005, TC-DB-012 |
| Status | Suspected, not yet reproduced |

## DEF-006: Seed rows are inserted again at every application start
| Field | Content |
|---|---|
| Summary | `data.sql` runs at every start and the table has no uniqueness rule beyond the id, so restarts create duplicate seed rows |
| Preconditions | Application started more than once against the same schema |
| Steps | 1) Start the application twice. 2) Run `DQ-12` (duplicate identities). |
| Expected | No duplicate persons (TA-06) |
| Predicted actual | `Ross Smith` and `Martin Taylo` each appear once per start |
| Severity / Priority | Low / Low (may be intentional for a demo) |
| Evidence (static) | `application-dev.properties:18` sets `spring.sql.init.mode=always`; `data.sql` holds plain INSERT statements |
| Reproducibility | Expected always after a restart |
| Related test case | TC-DB-009 |
| Status | Suspected, not yet reproduced |

---

## Observations (not defects)
- `application.properties` lines 1-2 configure Actuator endpoints, but `pom.xml` has no Actuator starter, so there is no `/actuator/health`. The suite therefore uses `GET /data-app/individuals` as its readiness check.
- No Swagger/OpenAPI is provided (no springdoc dependency).
- `application-dev.properties:4` commits a demo database password. The suite never uses it; supply credentials via environment variables.
- The only existing test, `contextLoads`, needs a live Oracle, so `mvn package` fails without one (use `-DskipTests` to build only).
- `.gitignore` line 1 is `README.md`, which hides every file with that name in any folder; the root `.gitignore` now has an exception for `qa/README.md`.
- `Person.java` stacks `@NotBlank`, `@NotEmpty` and `@NotNull`; `@NotBlank` alone covers all three.
