-- Rename the identity check constraint to snake_case for naming consistency.
ALTER TABLE "auth_session" RENAME CONSTRAINT "AuthSession_valid_lifetime" TO "auth_session_valid_lifetime";
