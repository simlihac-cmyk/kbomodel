import { FileKboManifestRepository } from "@/lib/repositories/kbo/manifest-repository";
import type { PublishArtifact, PublishManifest, PublishResult, Publisher } from "@/lib/publish/contracts";

export class FilePublisher implements Publisher {
  readonly mode = "file" as const;

  constructor(private readonly repository = new FileKboManifestRepository()) {}

  async publishArtifacts(artifacts: PublishArtifact[], manifests: PublishManifest[]): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const artifact of artifacts) {
      await this.repository.savePublishedDataset(artifact.dataset, artifact.payload);
      results.push({
        mode: this.mode,
        published: true,
        target: `data/normalized/kbo/publish/${artifact.dataset}.json`,
      });
    }

    for (const manifest of manifests) {
      await this.repository.saveManifest(manifest);
      results.push({
        mode: this.mode,
        published: true,
        target: `data/normalized/kbo/manifests/${manifest.manifestType}.json`,
      });
    }

    return results;
  }
}
