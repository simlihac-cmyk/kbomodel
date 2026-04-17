import { FileKboManifestRepository } from "@/lib/repositories/kbo/manifest-repository";

export function getPublishStorageRepository() {
  return new FileKboManifestRepository({
    baseRoot: process.env.INGEST_PUBLISH_FILE_ROOT,
  });
}
