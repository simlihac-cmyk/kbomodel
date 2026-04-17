import {
  buildArtifactPublishPath,
  buildManifestPublishPath,
  joinBlobPublishUrl,
} from "@/lib/publish/paths";
import type { PublishArtifact, PublishManifest, PublishResult, Publisher } from "@/lib/publish/contracts";

type BlobPutPublisherOptions = {
  baseUrl: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  pathPrefix?: string;
};

export class BlobPutPublisher implements Publisher {
  readonly mode = "blob-put" as const;

  constructor(private readonly options: BlobPutPublisherOptions) {}

  private async putJson(relativePath: string, payload: unknown) {
    const url = joinBlobPublishUrl(this.options.baseUrl, relativePath, this.options.pathPrefix);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.options.authHeaderName && this.options.authHeaderValue) {
      headers[this.options.authHeaderName] = this.options.authHeaderValue;
    }

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Blob PUT publish failed for ${url} with ${response.status}`);
    }

    return url;
  }

  async publishArtifacts(artifacts: PublishArtifact[], manifests: PublishManifest[]): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const artifact of artifacts) {
      const target = await this.putJson(buildArtifactPublishPath(artifact), artifact.payload);
      results.push({
        mode: this.mode,
        published: true,
        target,
      });
    }

    for (const manifest of manifests) {
      const target = await this.putJson(buildManifestPublishPath(manifest), manifest);
      results.push({
        mode: this.mode,
        published: true,
        target,
      });
    }

    return results;
  }
}
