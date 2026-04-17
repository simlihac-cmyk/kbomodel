import type { PublishArtifact, PublishManifest, PublishResult, Publisher } from "@/lib/publish/contracts";

type SignedHttpPublisherOptions = {
  publishUrl: string;
  secret: string;
};

export class SignedHttpPublisher implements Publisher {
  readonly mode = "signed-http" as const;

  constructor(private readonly options: SignedHttpPublisherOptions) {}

  async publishArtifacts(artifacts: PublishArtifact[], manifests: PublishManifest[]): Promise<PublishResult[]> {
    const response = await fetch(this.options.publishUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.secret}`,
      },
      body: JSON.stringify({
        artifacts,
        manifests,
      }),
    });

    if (!response.ok) {
      throw new Error(`Signed HTTP publish failed with ${response.status}`);
    }

    return [
      {
        mode: this.mode,
        published: true,
        target: this.options.publishUrl,
      },
    ];
  }
}
