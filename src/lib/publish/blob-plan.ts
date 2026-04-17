import {
  blobUploadPlanResponseSchema,
  type BlobUploadPlanItem,
  type BlobUploadPlanRequestItem,
  type BlobUploadPlanResponse,
} from "@/lib/publish/contracts";
import { joinBlobPublishUrl } from "@/lib/publish/paths";

type BuildBlobUploadPlanArgs = {
  entries: BlobUploadPlanRequestItem[];
  baseUrl: string;
  pathPrefix?: string;
  publicBaseUrl?: string;
  authHeaderName?: string;
  authHeaderValue?: string;
};

export function buildBlobUploadPlan({
  entries,
  baseUrl,
  pathPrefix,
  publicBaseUrl,
  authHeaderName,
  authHeaderValue,
}: BuildBlobUploadPlanArgs): BlobUploadPlanResponse {
  const items: BlobUploadPlanItem[] = entries.map((entry) => ({
    path: entry.path,
    uploadUrl: joinBlobPublishUrl(baseUrl, entry.path, pathPrefix),
    publicUrl: publicBaseUrl ? joinBlobPublishUrl(publicBaseUrl, entry.path, pathPrefix) : null,
    method: "PUT",
    headers:
      authHeaderName && authHeaderValue
        ? {
            [authHeaderName]: authHeaderValue,
          }
        : {},
  }));

  return blobUploadPlanResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    items,
  });
}
