import { ArchiveHub } from "@/components/archive/archive-hub";
import { getArchiveHubData } from "@/lib/repositories/kbo/view-models";

export default async function ArchivePage() {
  const items = await getArchiveHubData();
  return <ArchiveHub items={items} />;
}
