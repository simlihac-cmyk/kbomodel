import type { PublishArtifact, PublishManifest } from "@/lib/publish/contracts";

export function buildArtifactPublishPath(artifact: PublishArtifact) {
  return `publish/${artifact.dataset}.json`;
}

export function buildManifestPublishPath(manifest: PublishManifest) {
  return `manifests/${manifest.manifestType}.json`;
}

export function joinBlobPublishUrl(baseUrl: string, relativePath: string, pathPrefix?: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPrefix = pathPrefix ? `/${pathPrefix.replace(/^\/+|\/+$/g, "")}` : "";
  const normalizedPath = relativePath.replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPrefix}/${normalizedPath}`;
}
