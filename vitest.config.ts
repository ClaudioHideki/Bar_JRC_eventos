import { defineConfig } from 'vitest/config';
import path from 'path';

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://jrc_test_user:jrc_test_password@localhost:5433/jrc_passaporte_test?schema=public";
process.env.INVITATION_TOKEN_SECRET = process.env.INVITATION_TOKEN_SECRET || "test_invitation_secret_32_chars_minimum";
process.env.QR_TOKEN_SECRET = process.env.QR_TOKEN_SECRET || "test_qr_secret_32_chars_minimum_length";
process.env.RATE_LIMIT_SECRET = process.env.RATE_LIMIT_SECRET || "test_rate_limit_secret_32_chars_minimum";
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "test_better_auth_secret_32_chars_minimum";

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
