-- Runs once when the postgres container is first created.
-- Creates the databases used by API integration tests and Playwright E2E,
-- separate from dev data.
CREATE DATABASE stockspace_test;
CREATE DATABASE stockspace_e2e;
GRANT ALL PRIVILEGES ON DATABASE stockspace_test TO stockspace;
GRANT ALL PRIVILEGES ON DATABASE stockspace_e2e TO stockspace;
