# Performance testing with Apache JMeter

**Status: authored, never executed.** No JMeter, application or Oracle database was available when these files were written. The plan's XML structure was checked programmatically, but JMeter has not loaded it and no request has been sent. Treat every number below as a starting point, not a result.

## Purpose and scope

The Playwright suite checks correctness. This JMeter plan answers a different question: how do the existing endpoints behave when several users use them at once? It adds a light load, mixed-workload and connection-pool-pressure check for the demo application. It is **not** a capacity test or a benchmark: JMeter, the application and Oracle will usually share one machine.

**In scope:** list, get by id, create, and invalid-input rejections under concurrency; error rate; response times; data integrity after a write load.
**Out of scope:** delete under load (see "Design limits"), security and soak testing, distributed load generation, any claim about production capacity.

## Files

| File | Purpose |
|---|---|
| `qa/performance/jmeter/springboot-oracle-load-test.jmx` | the test plan |
| `qa/performance/jmeter/profiles/smoke.properties` | 1 user per workload, 1 iteration |
| `qa/performance/jmeter/profiles/load.properties` | modest concurrent mix for 120 seconds |
| `qa/performance/jmeter/profiles/stress.properties` | concurrency above the pool's 10 connections |
| `qa/performance/run-jmeter.ps1` | runs the plan headless, prints a summary, exits non-zero on failed samples |
| `qa/performance/results/` | generated output (git-ignored) |

## What the plan does

Three thread groups run at the same time. Each group is a set of simulated users.

| Workload | Requests | Checks |
|---|---|---|
| Read | `GET /individuals (list)`, then `GET /individuals/{id}` using a random id taken from the list | 200, JSON body, id matches, response time |
| Write | `POST /individuals (valid)` with a unique name | 201, response time |
| Invalid input | `POST` without `firstName`; `GET /individuals/abc` | 400 (expected from the code; unconfirmed) |

Request labels are fixed, so results can be filtered by name. Every created record has a last name containing `Load-QA-` plus 10 random lowercase characters. That contains the `QA-<10 characters>` marker the suite's cleanup script looks for.

## Scenarios

| ID | Scenario | Profile | Question it answers |
|---|---|---|---|
| PERF-01 | Smoke | `smoke` | Does the plan run, and do all assertions pass with one user? |
| PERF-02 | Read load | `load` (read group) | How do list and get-by-id times and errors behave with 10 concurrent users? |
| PERF-03 | Write load and integrity | `load` (write group) | Does every 201 correspond to exactly one stored row? |
| PERF-04 | Mixed workload | `load` | Do reads, writes and rejections interfere with each other? |
| PERF-05 | Pool pressure | `stress` | What happens when concurrent database work exceeds the 10-connection pool? |

**Assumptions, not requirements.** No performance requirements exist. `maxResponseMs=2000` is a placeholder that turns slow responses into failed samples, so they are visible; replace it when someone agrees real targets. The thread counts and durations are illustrative. "Zero failed samples" is the pass rule the runner applies.

## Prerequisites

1. A running application connected to Oracle, as described in `qa/README.md`.
2. Apache JMeter (any recent 5.6.x) from jmeter.apache.org, unzipped anywhere, and a Java runtime (you already have Java 17 for the application).
3. `JMETER_HOME` set to the unzipped folder (it contains `bin\jmeter.bat`):

```powershell
$env:JMETER_HOME = 'C:\tools\apache-jmeter-5.6.3'
& "$env:JMETER_HOME\bin\jmeter.bat" --version
```

## Run

```powershell
cd qa\performance
.\run-jmeter.ps1 -Profile smoke      # always first
.\run-jmeter.ps1 -Profile load
.\run-jmeter.ps1 -Profile stress     # optional, only on a disposable database
```

Individual settings can be overridden with JMeter's `-J` option, for example a different target: `.\run-jmeter.ps1 -Profile load -ApiHost 192.168.1.20 -Port 8080`.

**GUI mode** is for building and debugging only: open the `.jmx` in JMeter, change a profile value, and run with one thread. Never run real load from the GUI; it consumes resources and distorts results.

## Make the measurement meaningful

- **Run the packaged jar, not `spring-boot:run`.** Development tooling adds overhead.
  ```powershell
  .\mvnw.cmd -DskipTests package
  java -jar target\getIndividualData-0.0.1-SNAPSHOT.jar
  ```
- **Reduce logging.** The application's configuration logs every SQL statement and the bound values. That adds disk and CPU work per request. Before a load run, lower it with environment variables (names inferred from Spring's standard mapping; verify in the startup log):
  ```powershell
  $env:SPRING_JPA_SHOW_SQL = 'false'
  $env:LOGGING_LEVEL_ORG_HIBERNATE_SQL = 'WARN'
  $env:LOGGING_LEVEL_ORG_HIBERNATE_TYPE_DESCRIPTOR_SQL_BASICBINDER = 'WARN'
  ```
- **Start from a known table size.** `GET /individuals` returns the whole table, so its response time and payload grow with every row. Clean up before each run and compare runs only under the same starting size.
- **Record the environment** with every run: CPU and RAM, whether Oracle is in Docker, jar versus IDE, the profile used, and the date.
- **Don't run against a shared or valuable database.**

## Reading the results

The runner prints a table per request label (samples, failed, average, 95th percentile) and the dashboard path. The dashboard (`index.html`) adds throughput, percentiles and response times over time. Look at:

1. **Error rate:** any failed sample means look at the cause before the speed. In `results.jtl`, the response code and message columns say what went wrong (assertion failures, 4xx or 5xx, timeouts).
2. **95th percentile** rather than the average: averages hide the slow tail.
3. **Trend over time:** response times that rise steadily while load is constant suggest saturation or growth in the data volume.
4. **Throughput** (requests per second) and where it stops growing as users are added.

**Likely explanation for pool pressure [inferred from configuration, not measured]:** the connection pool allows at most 10 connections. Above roughly 10 simultaneous database operations, requests wait for a free connection, so times should rise before errors appear.

## Verify data integrity after a write load (PERF-03)

Count the created records in Oracle and the successful POSTs in the results file. They should be equal.

```sql
SELECT COUNT(*) FROM person WHERE INSTR(last_name, 'Load-QA-') > 0;
```

```powershell
$jtl = '.\results\<run folder>\results.jtl'
@(Import-Csv $jtl | Where-Object { $_.label -eq 'POST /individuals (valid)' -and $_.responseCode -eq '201' }).Count
```

A mismatch (for example a 201 with no row, or two rows for one request) is a defect candidate; keep the results file as evidence. Other writers must be inactive during the check.

## Clean up

```powershell
cd ..                          # into qa
npm run db:cleanup             # dry run: lists the rows
npm run db:cleanup -- --yes    # deletes rows carrying a QA marker
```

## Design limits

- **No delete under load.** `POST` returns no id (a suspected defect in `qa/docs/defects/candidate-defects.md`), so a create-then-delete flow would have to find each record by scanning the whole list, which would dominate the measurements. Cleanup uses the markers instead.
- **Read and write interact.** Records created by the write group enlarge the list the read group fetches during the same run.
- **Seed data is needed.** The read workload expects at least one row; the application's `data.sql` provides two at startup. With an empty table the list assertion fails and the get-by-id step is skipped.
- **One load generator, one machine** unless you configure otherwise: results show relative behaviour, not absolute capacity.
- **Authored without execution.** First-run issues in the plan, such as a JSON assertion mismatch, are possible. Run `smoke` and read `jmeter.log` before trusting any load result.

## Results log (to be filled in after real runs)

| Date | Profile | Environment | Samples | Failed | Notes |
|---|---|---|---|---|---|
| _to be filled_ | | | | | |
