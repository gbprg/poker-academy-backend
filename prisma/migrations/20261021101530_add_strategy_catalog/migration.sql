-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('MTT', 'SNG');

-- CreateEnum
CREATE TYPE "ValuationModel" AS ENUM ('CHIP_EV', 'ICM', 'PKO');

-- CreateEnum
CREATE TYPE "Street" AS ENUM ('PREFLOP', 'FLOP', 'TURN', 'RIVER');

-- CreateEnum
CREATE TYPE "SourceMethod" AS ENUM ('SOLVER_VERIFIED', 'LICENSED', 'EDITORIAL', 'DEMO_NOT_GTO');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'DEPRECATED', 'BLOCKED_RIGHTS', 'UNAVAILABLE', 'EXPERIMENTAL');

-- CreateTable
CREATE TABLE "StrategySource" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "author" VARCHAR(200) NOT NULL,
    "originUrl" VARCHAR(500),
    "method" "SourceMethod" NOT NULL,
    "rightsVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StrategySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceLicense" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "licenseName" VARCHAR(160) NOT NULL,
    "licenseUrl" VARCHAR(500),
    "terms" TEXT NOT NULL,
    "authorizationId" VARCHAR(200),
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotDefinition" (
    "id" UUID NOT NULL,
    "spotKey" VARCHAR(200) NOT NULL,
    "canonicalFingerprint" CHAR(64) NOT NULL,
    "format" "GameFormat" NOT NULL,
    "valuation" "ValuationModel" NOT NULL,
    "street" "Street" NOT NULL,
    "tableSize" INTEGER NOT NULL,
    "schemaVersion" VARCHAR(20) NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyVersion" (
    "id" UUID NOT NULL,
    "spotId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "versionTag" VARCHAR(80) NOT NULL,
    "status" "CoverageStatus" NOT NULL DEFAULT 'DRAFT',
    "model" "ValuationModel" NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "validationEvidence" JSONB,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyNode" (
    "id" UUID NOT NULL,
    "strategyVersionId" UUID NOT NULL,
    "nodeKey" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyAction" (
    "id" UUID NOT NULL,
    "strategyNodeId" UUID NOT NULL,
    "handClass" VARCHAR(5) NOT NULL,
    "actionType" VARCHAR(10) NOT NULL,
    "sizing" DECIMAL(12,4),
    "frequency" DECIMAL(6,5) NOT NULL,
    "evNullable" DECIMAL(14,6),
    "unitNullable" VARCHAR(12),

    CONSTRAINT "StrategyAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRecord" (
    "id" UUID NOT NULL,
    "spotId" UUID,
    "format" "GameFormat" NOT NULL,
    "valuation" "ValuationModel" NOT NULL,
    "street" "Street" NOT NULL,
    "tableSize" INTEGER NOT NULL,
    "status" "CoverageStatus" NOT NULL,
    "eligibleExerciseCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CoverageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StrategySource_slug_key" ON "StrategySource"("slug");

-- CreateIndex
CREATE INDEX "StrategySource_method_idx" ON "StrategySource"("method");

-- CreateIndex
CREATE INDEX "SourceLicense_sourceId_capturedAt_idx" ON "SourceLicense"("sourceId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceLicense_sourceId_checksum_key" ON "SourceLicense"("sourceId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "SpotDefinition_spotKey_key" ON "SpotDefinition"("spotKey");

-- CreateIndex
CREATE UNIQUE INDEX "SpotDefinition_canonicalFingerprint_key" ON "SpotDefinition"("canonicalFingerprint");

-- CreateIndex
CREATE INDEX "SpotDefinition_street_format_valuation_idx" ON "SpotDefinition"("street", "format", "valuation");

-- CreateIndex
CREATE INDEX "SpotDefinition_tableSize_valuation_idx" ON "SpotDefinition"("tableSize", "valuation");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyVersion_checksum_key" ON "StrategyVersion"("checksum");

-- CreateIndex
CREATE INDEX "StrategyVersion_status_model_idx" ON "StrategyVersion"("status", "model");

-- CreateIndex
CREATE INDEX "StrategyVersion_sourceId_createdAt_idx" ON "StrategyVersion"("sourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyVersion_spotId_versionTag_key" ON "StrategyVersion"("spotId", "versionTag");

-- CreateIndex
CREATE INDEX "StrategyNode_strategyVersionId_idx" ON "StrategyNode"("strategyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyNode_strategyVersionId_nodeKey_key" ON "StrategyNode"("strategyVersionId", "nodeKey");

-- CreateIndex
CREATE INDEX "StrategyAction_strategyNodeId_handClass_idx" ON "StrategyAction"("strategyNodeId", "handClass");

-- CreateIndex
CREATE INDEX "CoverageRecord_status_street_format_idx" ON "CoverageRecord"("status", "street", "format");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageRecord_format_valuation_street_tableSize_spotId_key" ON "CoverageRecord"("format", "valuation", "street", "tableSize", "spotId");

-- AddForeignKey
ALTER TABLE "SourceLicense" ADD CONSTRAINT "SourceLicense_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "StrategySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "SpotDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "StrategySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyNode" ADD CONSTRAINT "StrategyNode_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyAction" ADD CONSTRAINT "StrategyAction_strategyNodeId_fkey" FOREIGN KEY ("strategyNodeId") REFERENCES "StrategyNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRecord" ADD CONSTRAINT "CoverageRecord_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "SpotDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
