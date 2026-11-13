# Defect report template

Copy this file to `docs/defects/DEF-<number>.md` (or paste into Jira). Fill every field; write "n/a" rather than deleting one.

| Field | Content |
|---|---|
| **Defect ID** | DEF-### |
| **Summary** | One sentence: what is wrong, where |
| **Environment** | Application version/commit, profile, Oracle version, JDK, OS, how the app was started |
| **Preconditions** | Data and configuration needed |
| **Reproduction steps** | Numbered, exact (request line, body, SQL) |
| **Expected result** | What should happen, and the source of that expectation (requirement, README, or assumption TA-##) |
| **Actual result** | What happened (status code, body, SQL output) |
| **Severity** | Critical / High / Medium / Low (impact on the system) |
| **Priority** | Urgent / High / Medium / Low (order of fixing) |
| **Evidence** | Report path, trace, log excerpt, SQL result, screenshot |
| **Reproducibility** | Always / Sometimes (x of y) / Once |
| **Related test case** | TC-... |
| **Status** | New / Suspected / Confirmed / In progress / Fixed / Verified / Rejected |

**Triage note.** Before logging, classify the failure: *environment/configuration* (preflight failed, wrong credentials, app on H2), *test defect* (the assertion or data is wrong), or *application defect* (the system violates the expectation). Only the last becomes a defect against the application.
