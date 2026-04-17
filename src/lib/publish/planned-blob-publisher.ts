import {
  buildArtifactPublishPath,
  buildManifestPublishPath,
} from "@/lib/publish/paths";
import {
  blobUploadPlanResponseSchema,
  type PublishArtifact,
  type PublishManifest,
  type PublishResult,
  type Publisher,
} from "@/lib/publish/contracts";

type PlannedBlobPublisherOptions = {
  planUrl: string;
  secret: string;
};

export class PlannedBlobPublisher implements Publisher {
  readonly mode = "blob-plan" as const;

  constructor(private readonly options: PlannedBlobPublisherOptions) {}

  async publishArtifacts(artifacts: PublishArtifact[], manifests: PublishManifest[]): Promise<PublishResult[]> {
    const publishObjects = [
      ...artifacts.map((artifact) => ({
        path: buildArtifactPublishPath(artifact),
        payload: artifact.payload,
      })),
      ...manifests.map((manifest) => ({
        path: buildManifestPublishPath(manifest),
        payload: manifest,
      })),
    ];

    const planResponse = await fetch(this.options.planUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.secret}`,
      },
      body: JSON.stringify({
        entries: publishObjects.map((item) => ({
          path: item.path,
          contentType: "application/json",
        })),
      }),
    });

    if (!planResponse.ok) {
      throw new Error(`Blob plan request failed with ${planResponse.status}`);
    }

    const plan = blobUploadPlanResponseSchema.parse(await planResponse.json());
    const planByPath = new Map(plan.items.map((item) => [item.path, item] as const));
    const results: PublishResult[] = [];

    for (const object of publishObjects) {
      const planItem = planByPath.get(object.path);
      if (!planItem) {
        throw new Error(`Blob upload plan is missing path ${object.path}`);
      }

      const uploadResponse = await fetch(planItem.uploadUrl, {
        method: planItem.method,
        headers: {
          "content-type": "application/json",
          ...planItem.headers,
        },
        body: JSON.stringify(object.payload),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Blob upload failed for ${object.path} with ${uploadResponse.status}`);
      }

      results.push({
        mode: this.mode,
        published: true,
        target: planItem.publicUrl ?? planItem.uploadUrl,
      });
    }

    return results;
  }
}
