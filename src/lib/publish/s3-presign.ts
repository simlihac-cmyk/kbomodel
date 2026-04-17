import crypto from "node:crypto";

import type { BlobUploadPlanRequestItem, BlobUploadPlanResponse } from "@/lib/publish/contracts";
import { blobUploadPlanResponseSchema } from "@/lib/publish/contracts";

type S3PresignConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl?: string;
  expiresInSeconds: number;
  forcePathStyle: boolean;
};

type BuildS3PresignedUploadPlanArgs = {
  entries: BlobUploadPlanRequestItem[];
  config: S3PresignConfig;
  now?: Date;
};

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePathPreservingSlash(path: string) {
  return path
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(amzDate: string) {
  return amzDate.slice(0, 8);
}

function deriveSigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function normalizeEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  return {
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
  };
}

function buildObjectUrl(endpoint: string, bucket: string, objectPath: string, forcePathStyle: boolean) {
  const normalized = normalizeEndpoint(endpoint);
  const cleanPath = objectPath.replace(/^\/+/, "");

  if (forcePathStyle) {
    return {
      host: normalized.host,
      url: `${normalized.protocol}//${normalized.host}/${encodeRfc3986(bucket)}/${encodePathPreservingSlash(cleanPath)}`,
      canonicalUri: `/${encodeRfc3986(bucket)}/${encodePathPreservingSlash(cleanPath)}`,
    };
  }

  return {
    host: `${bucket}.${normalized.host}`,
    url: `${normalized.protocol}//${bucket}.${normalized.host}/${encodePathPreservingSlash(cleanPath)}`,
    canonicalUri: `/${encodePathPreservingSlash(cleanPath)}`,
  };
}

function buildCanonicalQueryString(entries: Array<[string, string]>) {
  return entries
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

function buildPublicUrl(publicBaseUrl: string | undefined, objectPath: string) {
  if (!publicBaseUrl) {
    return null;
  }
  return `${publicBaseUrl.replace(/\/+$/, "")}/${objectPath.replace(/^\/+/, "")}`;
}

function buildPresignedPutUrl(
  objectPath: string,
  contentType: string,
  config: S3PresignConfig,
  now: Date,
) {
  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const amzDate = formatAmzDate(now);
  const dateStamp = formatDateStamp(amzDate);
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const objectTarget = buildObjectUrl(config.endpoint, config.bucket, objectPath, config.forcePathStyle);
  const signedHeaders = "content-type;host";
  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", algorithm],
    ["X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(config.expiresInSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];

  if (config.sessionToken) {
    queryEntries.push(["X-Amz-Security-Token", config.sessionToken]);
  }

  const canonicalQueryString = buildCanonicalQueryString(queryEntries);
  const canonicalHeaders = `content-type:${contentType}\nhost:${objectTarget.host}\n`;
  const canonicalRequest = [
    "PUT",
    objectTarget.canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(config.secretAccessKey, dateStamp, config.region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const signedUrl = `${objectTarget.url}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return {
    signedUrl,
    publicUrl: buildPublicUrl(config.publicBaseUrl, objectPath),
  };
}

export function getS3PresignConfigFromEnv(): S3PresignConfig | null {
  const accessKeyId = process.env.INGEST_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.INGEST_S3_SECRET_ACCESS_KEY;
  const region = process.env.INGEST_S3_REGION;
  const bucket = process.env.INGEST_S3_BUCKET;
  const endpoint = process.env.INGEST_S3_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !region || !bucket || !endpoint) {
    return null;
  }

  const expiresInSeconds = Math.min(
    Math.max(Number.parseInt(process.env.INGEST_S3_PRESIGN_EXPIRES_IN ?? "900", 10), 1),
    604800,
  );

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.INGEST_S3_SESSION_TOKEN,
    region,
    bucket,
    endpoint,
    publicBaseUrl: process.env.INGEST_S3_PUBLIC_BASE_URL,
    expiresInSeconds,
    forcePathStyle: process.env.INGEST_S3_FORCE_PATH_STYLE !== "false",
  };
}

export function buildS3PresignedUploadPlan({
  entries,
  config,
  now = new Date(),
}: BuildS3PresignedUploadPlanArgs): BlobUploadPlanResponse {
  return blobUploadPlanResponseSchema.parse({
    generatedAt: now.toISOString(),
    items: entries.map((entry) => {
      const { signedUrl, publicUrl } = buildPresignedPutUrl(entry.path, entry.contentType, config, now);

      return {
        path: entry.path,
        uploadUrl: signedUrl,
        publicUrl,
        method: "PUT",
        headers: {
          "content-type": entry.contentType,
        },
      };
    }),
  });
}
