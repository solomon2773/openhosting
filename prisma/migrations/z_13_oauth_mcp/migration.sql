-- Authorization codes are short-lived and cannot be upgraded safely without
-- their original PKCE challenge, so invalidate any code issued before this
-- OAuth 2.1 migration.
DELETE FROM "OauthCode";

ALTER TABLE "OauthClient"
ALTER COLUMN "clientSecret" DROP NOT NULL,
ADD COLUMN "publicClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowedScopes" JSONB NOT NULL DEFAULT '["openid","profile","email"]';

ALTER TABLE "OauthCode"
ADD COLUMN "codeChallenge" TEXT NOT NULL,
ADD COLUMN "scopes" JSONB NOT NULL,
ADD COLUMN "resource" TEXT;

ALTER TABLE "OauthToken"
ADD COLUMN "scopes" JSONB NOT NULL DEFAULT '["openid","profile","email"]',
ADD COLUMN "resource" TEXT,
ADD COLUMN "refreshTokenHash" TEXT,
ADD COLUMN "refreshExpiresAt" TIMESTAMP(3),
ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "OauthToken_refreshTokenHash_key"
ON "OauthToken"("refreshTokenHash");
