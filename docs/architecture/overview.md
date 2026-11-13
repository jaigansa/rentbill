# Technical Architecture Overview

- **Project:** rentbills
- **Client:** Internal / Engineering In-House
- **Author:** JAIGANESH

## System Boundaries
1. **Core Domain (`src/`):** Pure business logic, independent of external frameworks.
2. **Adapters & Interfaces:** CLI, API, or GUI driving the application.
3. **Storage & Infrastructure:** Configuration, database, or external network integrations.

## Quality Standards
- Code must pass all tests with zero errors: `./scripts/test.sh`
- Code must be formatted and linted cleanly.
