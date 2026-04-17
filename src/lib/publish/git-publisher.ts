import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { PublishArtifact, PublishManifest, PublishResult, Publisher } from "@/lib/publish/contracts";
import { FilePublisher } from "@/lib/publish/file-publisher";

const execFileAsync = promisify(execFile);

export class GitPublisher implements Publisher {
  readonly mode = "git" as const;

  constructor(
    private readonly filePublisher = new FilePublisher(),
    private readonly commitMessage = "chore: refresh KBO published data",
  ) {}

  async publishArtifacts(artifacts: PublishArtifact[], manifests: PublishManifest[]): Promise<PublishResult[]> {
    const fileResults = await this.filePublisher.publishArtifacts(artifacts, manifests);

    const status = await execFileAsync("git", ["status", "--porcelain"]).catch(() => ({ stdout: "" }));
    if (!status.stdout.trim()) {
      return [
        ...fileResults,
        {
          mode: this.mode,
          published: false,
          target: "git:no-op",
        },
      ];
    }

    await execFileAsync("git", ["add", "data/normalized/kbo/publish", "data/normalized/kbo/manifests"]);
    await execFileAsync("git", ["commit", "-m", this.commitMessage]).catch(() => undefined);

    return [
      ...fileResults,
      {
        mode: this.mode,
        published: true,
        target: "git:commit",
      },
    ];
  }
}
