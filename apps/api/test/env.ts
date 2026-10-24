/** Shared test environment: integration tests run against a dedicated database
 * (never the dev database) so local data stays untouched. */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://stockspace:stockspace@localhost:5433/stockspace_test'
