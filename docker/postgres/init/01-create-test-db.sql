-- Runs once when the postgres container is first created.
-- Creates the database used by API integration tests, separate from dev data.
CREATE DATABASE stockspace_test;
GRANT ALL PRIVILEGES ON DATABASE stockspace_test TO stockspace;
