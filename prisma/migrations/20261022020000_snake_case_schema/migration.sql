-- Rename tables, columns, constraints and indexes to lower snake_case (data preserved).

-- Tables
ALTER TABLE "User" RENAME TO "user";
ALTER TABLE "AuditLog" RENAME TO "audit_log";
ALTER TABLE "AccountActivation" RENAME TO "account_activation";
ALTER TABLE "AuthSession" RENAME TO "auth_session";
ALTER TABLE "StrategySource" RENAME TO "strategy_source";
ALTER TABLE "SourceLicense" RENAME TO "source_license";
ALTER TABLE "SpotDefinition" RENAME TO "spot_definition";
ALTER TABLE "StrategyVersion" RENAME TO "strategy_version";
ALTER TABLE "StrategyNode" RENAME TO "strategy_node";
ALTER TABLE "StrategyAction" RENAME TO "strategy_action";
ALTER TABLE "CoverageRecord" RENAME TO "coverage_record";

-- Columns: user
ALTER TABLE "user" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "user" RENAME COLUMN "passwordChangedAt" TO "password_changed_at";
ALTER TABLE "user" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "user" RENAME COLUMN "updatedAt" TO "updated_at";

-- Columns: audit_log
ALTER TABLE "audit_log" RENAME COLUMN "actorUserId" TO "actor_user_id";
ALTER TABLE "audit_log" RENAME COLUMN "targetUserId" TO "target_user_id";
ALTER TABLE "audit_log" RENAME COLUMN "createdAt" TO "created_at";

-- Columns: account_activation
ALTER TABLE "account_activation" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "account_activation" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "account_activation" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "account_activation" RENAME COLUMN "consumedAt" TO "consumed_at";
ALTER TABLE "account_activation" RENAME COLUMN "createdAt" TO "created_at";

-- Columns: auth_session
ALTER TABLE "auth_session" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "auth_session" RENAME COLUMN "issuedAt" TO "issued_at";
ALTER TABLE "auth_session" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "auth_session" RENAME COLUMN "revokedAt" TO "revoked_at";
ALTER TABLE "auth_session" RENAME COLUMN "userAgentHash" TO "user_agent_hash";

-- Columns: strategy_source
ALTER TABLE "strategy_source" RENAME COLUMN "originUrl" TO "origin_url";
ALTER TABLE "strategy_source" RENAME COLUMN "rightsVerified" TO "rights_verified";
ALTER TABLE "strategy_source" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "strategy_source" RENAME COLUMN "updatedAt" TO "updated_at";

-- Columns: source_license
ALTER TABLE "source_license" RENAME COLUMN "sourceId" TO "source_id";
ALTER TABLE "source_license" RENAME COLUMN "licenseName" TO "license_name";
ALTER TABLE "source_license" RENAME COLUMN "licenseUrl" TO "license_url";
ALTER TABLE "source_license" RENAME COLUMN "authorizationId" TO "authorization_id";
ALTER TABLE "source_license" RENAME COLUMN "capturedAt" TO "captured_at";
ALTER TABLE "source_license" RENAME COLUMN "createdAt" TO "created_at";

-- Columns: spot_definition
ALTER TABLE "spot_definition" RENAME COLUMN "spotKey" TO "spot_key";
ALTER TABLE "spot_definition" RENAME COLUMN "canonicalFingerprint" TO "canonical_fingerprint";
ALTER TABLE "spot_definition" RENAME COLUMN "tableSize" TO "table_size";
ALTER TABLE "spot_definition" RENAME COLUMN "schemaVersion" TO "schema_version";
ALTER TABLE "spot_definition" RENAME COLUMN "createdAt" TO "created_at";

-- Columns: strategy_version
ALTER TABLE "strategy_version" RENAME COLUMN "spotId" TO "spot_id";
ALTER TABLE "strategy_version" RENAME COLUMN "sourceId" TO "source_id";
ALTER TABLE "strategy_version" RENAME COLUMN "versionTag" TO "version_tag";
ALTER TABLE "strategy_version" RENAME COLUMN "validationEvidence" TO "validation_evidence";
ALTER TABLE "strategy_version" RENAME COLUMN "publishedAt" TO "published_at";
ALTER TABLE "strategy_version" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "strategy_version" RENAME COLUMN "updatedAt" TO "updated_at";

-- Columns: strategy_node
ALTER TABLE "strategy_node" RENAME COLUMN "strategyVersionId" TO "strategy_version_id";
ALTER TABLE "strategy_node" RENAME COLUMN "nodeKey" TO "node_key";
ALTER TABLE "strategy_node" RENAME COLUMN "createdAt" TO "created_at";

-- Columns: strategy_action
ALTER TABLE "strategy_action" RENAME COLUMN "strategyNodeId" TO "strategy_node_id";
ALTER TABLE "strategy_action" RENAME COLUMN "handClass" TO "hand_class";
ALTER TABLE "strategy_action" RENAME COLUMN "actionType" TO "action_type";
ALTER TABLE "strategy_action" RENAME COLUMN "evNullable" TO "ev_nullable";
ALTER TABLE "strategy_action" RENAME COLUMN "unitNullable" TO "unit_nullable";

-- Columns: coverage_record
ALTER TABLE "coverage_record" RENAME COLUMN "spotId" TO "spot_id";
ALTER TABLE "coverage_record" RENAME COLUMN "tableSize" TO "table_size";
ALTER TABLE "coverage_record" RENAME COLUMN "eligibleExerciseCount" TO "eligible_exercise_count";
ALTER TABLE "coverage_record" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "coverage_record" RENAME COLUMN "updatedAt" TO "updated_at";

-- Primary keys
ALTER INDEX "User_pkey" RENAME TO "user_pkey";
ALTER INDEX "AuditLog_pkey" RENAME TO "audit_log_pkey";
ALTER INDEX "AccountActivation_pkey" RENAME TO "account_activation_pkey";
ALTER INDEX "AuthSession_pkey" RENAME TO "auth_session_pkey";
ALTER INDEX "StrategySource_pkey" RENAME TO "strategy_source_pkey";
ALTER INDEX "SourceLicense_pkey" RENAME TO "source_license_pkey";
ALTER INDEX "SpotDefinition_pkey" RENAME TO "spot_definition_pkey";
ALTER INDEX "StrategyVersion_pkey" RENAME TO "strategy_version_pkey";
ALTER INDEX "StrategyNode_pkey" RENAME TO "strategy_node_pkey";
ALTER INDEX "StrategyAction_pkey" RENAME TO "strategy_action_pkey";
ALTER INDEX "CoverageRecord_pkey" RENAME TO "coverage_record_pkey";

-- Unique indexes
ALTER INDEX "User_email_key" RENAME TO "user_email_key";
ALTER INDEX "AccountActivation_tokenHash_key" RENAME TO "account_activation_token_hash_key";
ALTER INDEX "AuthSession_jti_key" RENAME TO "auth_session_jti_key";
ALTER INDEX "StrategySource_slug_key" RENAME TO "strategy_source_slug_key";
ALTER INDEX "SourceLicense_sourceId_checksum_key" RENAME TO "source_license_source_id_checksum_key";
ALTER INDEX "SpotDefinition_spotKey_key" RENAME TO "spot_definition_spot_key_key";
ALTER INDEX "SpotDefinition_canonicalFingerprint_key" RENAME TO "spot_definition_canonical_fingerprint_key";
ALTER INDEX "StrategyVersion_checksum_key" RENAME TO "strategy_version_checksum_key";
ALTER INDEX "StrategyVersion_spotId_versionTag_key" RENAME TO "strategy_version_spot_id_version_tag_key";
ALTER INDEX "StrategyNode_strategyVersionId_nodeKey_key" RENAME TO "strategy_node_strategy_version_id_node_key_key";
ALTER INDEX "CoverageRecord_format_valuation_street_tableSize_spotId_key" RENAME TO "coverage_record_exact_key";

-- Secondary indexes
ALTER INDEX "User_status_role_idx" RENAME TO "user_status_role_idx";
ALTER INDEX "AuditLog_actorUserId_createdAt_idx" RENAME TO "audit_log_actor_user_id_created_at_idx";
ALTER INDEX "AuditLog_targetUserId_createdAt_idx" RENAME TO "audit_log_target_user_id_created_at_idx";
ALTER INDEX "AuditLog_action_createdAt_idx" RENAME TO "audit_log_action_created_at_idx";
ALTER INDEX "AccountActivation_userId_expiresAt_idx" RENAME TO "account_activation_user_id_expires_at_idx";
ALTER INDEX "AuthSession_userId_issuedAt_idx" RENAME TO "auth_session_user_id_issued_at_idx";
ALTER INDEX "AuthSession_expiresAt_revokedAt_idx" RENAME TO "auth_session_expires_at_revoked_at_idx";
ALTER INDEX "StrategySource_method_idx" RENAME TO "strategy_source_method_idx";
ALTER INDEX "SourceLicense_sourceId_capturedAt_idx" RENAME TO "source_license_source_id_captured_at_idx";
ALTER INDEX "SpotDefinition_street_format_valuation_idx" RENAME TO "spot_definition_street_format_valuation_idx";
ALTER INDEX "SpotDefinition_tableSize_valuation_idx" RENAME TO "spot_definition_table_size_valuation_idx";
ALTER INDEX "StrategyVersion_status_model_idx" RENAME TO "strategy_version_status_model_idx";
ALTER INDEX "StrategyVersion_sourceId_createdAt_idx" RENAME TO "strategy_version_source_id_created_at_idx";
ALTER INDEX "StrategyNode_strategyVersionId_idx" RENAME TO "strategy_node_strategy_version_id_idx";
ALTER INDEX "StrategyAction_strategyNodeId_handClass_idx" RENAME TO "strategy_action_strategy_node_id_hand_class_idx";
ALTER INDEX "CoverageRecord_status_street_format_idx" RENAME TO "coverage_record_status_street_format_idx";
ALTER INDEX "CoverageRecord_format_valuation_street_tableSize_status_idx" RENAME TO "coverage_record_format_valuation_street_table_size_status_idx";

-- Foreign keys
ALTER TABLE "account_activation" RENAME CONSTRAINT "AccountActivation_userId_fkey" TO "account_activation_user_id_fkey";
ALTER TABLE "auth_session" RENAME CONSTRAINT "AuthSession_userId_fkey" TO "auth_session_user_id_fkey";
ALTER TABLE "audit_log" RENAME CONSTRAINT "AuditLog_actorUserId_fkey" TO "audit_log_actor_user_id_fkey";
ALTER TABLE "audit_log" RENAME CONSTRAINT "AuditLog_targetUserId_fkey" TO "audit_log_target_user_id_fkey";
ALTER TABLE "source_license" RENAME CONSTRAINT "SourceLicense_sourceId_fkey" TO "source_license_source_id_fkey";
ALTER TABLE "strategy_version" RENAME CONSTRAINT "StrategyVersion_sourceId_fkey" TO "strategy_version_source_id_fkey";
ALTER TABLE "strategy_version" RENAME CONSTRAINT "StrategyVersion_spotId_fkey" TO "strategy_version_spot_id_fkey";
ALTER TABLE "strategy_node" RENAME CONSTRAINT "StrategyNode_strategyVersionId_fkey" TO "strategy_node_strategy_version_id_fkey";
ALTER TABLE "strategy_action" RENAME CONSTRAINT "StrategyAction_strategyNodeId_fkey" TO "strategy_action_strategy_node_id_fkey";
ALTER TABLE "coverage_record" RENAME CONSTRAINT "CoverageRecord_spotId_fkey" TO "coverage_record_spot_id_fkey";
