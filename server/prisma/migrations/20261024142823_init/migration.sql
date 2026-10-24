-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "LearnerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('DRAFT', 'GENERATED', 'CONFIRMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SceneSourceType" AS ENUM ('TEXT', 'IMAGE', 'SCRIPT');

-- CreateEnum
CREATE TYPE "SceneTaskStatus" AS ENUM ('DRAFT', 'PENDING', 'QUEUED', 'GENERATING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LEARNER', 'ASSESSMENT', 'PROFILE', 'GOAL', 'SCRIPT', 'TASK', 'ASSET');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learners" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "ageGroup" TEXT NOT NULL,
    "status" "LearnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "traits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "communicationStyle" TEXT NOT NULL DEFAULT '',
    "promptPreference" TEXT NOT NULL DEFAULT '',
    "environmentNotes" TEXT NOT NULL DEFAULT '',
    "currentGoalText" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "lastAssessmentAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ability_assessments" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "scores" JSONB NOT NULL,
    "generalNotes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ability_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ability_profiles" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "summary" TEXT NOT NULL DEFAULT '',
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "developmentAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimensionInsights" JSONB NOT NULL,
    "observationSnapshot" TEXT NOT NULL DEFAULT '',
    "generatedBy" TEXT NOT NULL DEFAULT 'mock',
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ability_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ability_profile_revisions" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ability_profile_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_goals" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "profileId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "successCriteria" TEXT NOT NULL DEFAULT '',
    "relatedDimensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" "GoalPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GoalStatus" NOT NULL DEFAULT 'PLANNING',
    "targetDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_scripts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "scenarioSummary" TEXT NOT NULL DEFAULT '',
    "status" "ScriptStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "preparation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environmentElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" JSONB NOT NULL,
    "sceneAdaptation" TEXT NOT NULL DEFAULT '',
    "cautions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sceneConfig" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'mock',
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_versions" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "scenarioSummary" TEXT NOT NULL DEFAULT '',
    "steps" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,

    CONSTRAINT "script_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_tasks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sourceType" "SceneSourceType" NOT NULL,
    "sceneName" TEXT NOT NULL,
    "scenePurpose" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "learnerId" TEXT,
    "trainingGoalId" TEXT,
    "scriptId" TEXT,
    "imageReferences" JSONB NOT NULL DEFAULT '[]',
    "sceneConfig" JSONB NOT NULL,
    "status" "SceneTaskStatus" NOT NULL DEFAULT 'DRAFT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "result" JSONB,
    "providerMode" TEXT NOT NULL DEFAULT 'mock',
    "providerJobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "scene_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_task_files" (
    "taskId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "scene_task_files_pkey" PRIMARY KEY ("taskId","fileId")
);

-- CreateTable
CREATE TABLE "scene_assets" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sceneType" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "learnerId" TEXT,
    "trainingGoalId" TEXT,
    "scriptId" TEXT,
    "sourceType" "SceneSourceType" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previewSeed" TEXT NOT NULL,
    "previewFileId" TEXT,
    "previewUrl" TEXT,
    "sceneFileUrl" TEXT,
    "sceneUrl" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_files" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "learners_code_key" ON "learners"("code");

-- CreateIndex
CREATE INDEX "learners_status_idx" ON "learners"("status");

-- CreateIndex
CREATE INDEX "learners_name_idx" ON "learners"("name");

-- CreateIndex
CREATE INDEX "learners_updatedAt_idx" ON "learners"("updatedAt");

-- CreateIndex
CREATE INDEX "ability_assessments_learnerId_createdAt_idx" ON "ability_assessments"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "ability_profiles_learnerId_createdAt_idx" ON "ability_profiles"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "ability_profiles_status_idx" ON "ability_profiles"("status");

-- CreateIndex
CREATE INDEX "ability_profile_revisions_profileId_createdAt_idx" ON "ability_profile_revisions"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ability_profile_revisions_profileId_revision_key" ON "ability_profile_revisions"("profileId", "revision");

-- CreateIndex
CREATE INDEX "training_goals_learnerId_status_idx" ON "training_goals"("learnerId", "status");

-- CreateIndex
CREATE INDEX "training_goals_profileId_idx" ON "training_goals"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "training_scripts_code_key" ON "training_scripts"("code");

-- CreateIndex
CREATE INDEX "training_scripts_learnerId_updatedAt_idx" ON "training_scripts"("learnerId", "updatedAt");

-- CreateIndex
CREATE INDEX "training_scripts_goalId_idx" ON "training_scripts"("goalId");

-- CreateIndex
CREATE INDEX "training_scripts_status_idx" ON "training_scripts"("status");

-- CreateIndex
CREATE INDEX "script_versions_scriptId_version_idx" ON "script_versions"("scriptId", "version");

-- CreateIndex
CREATE INDEX "script_versions_scriptId_savedAt_idx" ON "script_versions"("scriptId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "scene_tasks_code_key" ON "scene_tasks"("code");

-- CreateIndex
CREATE INDEX "scene_tasks_status_updatedAt_idx" ON "scene_tasks"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "scene_tasks_createdAt_idx" ON "scene_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "scene_tasks_learnerId_idx" ON "scene_tasks"("learnerId");

-- CreateIndex
CREATE INDEX "scene_tasks_scriptId_idx" ON "scene_tasks"("scriptId");

-- CreateIndex
CREATE INDEX "scene_task_files_fileId_idx" ON "scene_task_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_assets_taskId_key" ON "scene_assets"("taskId");

-- CreateIndex
CREATE INDEX "scene_assets_createdAt_idx" ON "scene_assets"("createdAt");

-- CreateIndex
CREATE INDEX "scene_assets_learnerId_idx" ON "scene_assets"("learnerId");

-- CreateIndex
CREATE INDEX "scene_assets_scriptId_idx" ON "scene_assets"("scriptId");

-- CreateIndex
CREATE INDEX "scene_assets_archivedAt_idx" ON "scene_assets"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "upload_files_storageKey_key" ON "upload_files"("storageKey");

-- CreateIndex
CREATE INDEX "upload_files_uploadedById_createdAt_idx" ON "upload_files"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "activities_at_idx" ON "activities"("at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learners" ADD CONSTRAINT "learners_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_assessments" ADD CONSTRAINT "ability_assessments_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_assessments" ADD CONSTRAINT "ability_assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_profiles" ADD CONSTRAINT "ability_profiles_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_profiles" ADD CONSTRAINT "ability_profiles_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ability_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_profiles" ADD CONSTRAINT "ability_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_profiles" ADD CONSTRAINT "ability_profiles_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_profile_revisions" ADD CONSTRAINT "ability_profile_revisions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ability_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ability_profile_revisions" ADD CONSTRAINT "ability_profile_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_goals" ADD CONSTRAINT "training_goals_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_goals" ADD CONSTRAINT "training_goals_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ability_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_goals" ADD CONSTRAINT "training_goals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_scripts" ADD CONSTRAINT "training_scripts_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_scripts" ADD CONSTRAINT "training_scripts_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "training_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_scripts" ADD CONSTRAINT "training_scripts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_scripts" ADD CONSTRAINT "training_scripts_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "training_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_tasks" ADD CONSTRAINT "scene_tasks_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_tasks" ADD CONSTRAINT "scene_tasks_trainingGoalId_fkey" FOREIGN KEY ("trainingGoalId") REFERENCES "training_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_tasks" ADD CONSTRAINT "scene_tasks_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "training_scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_tasks" ADD CONSTRAINT "scene_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_task_files" ADD CONSTRAINT "scene_task_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "scene_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_task_files" ADD CONSTRAINT "scene_task_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "upload_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "scene_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_trainingGoalId_fkey" FOREIGN KEY ("trainingGoalId") REFERENCES "training_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "training_scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_previewFileId_fkey" FOREIGN KEY ("previewFileId") REFERENCES "upload_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_files" ADD CONSTRAINT "upload_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
