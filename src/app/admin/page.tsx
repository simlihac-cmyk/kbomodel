import { AdminHome } from "@/components/admin/admin-home";
import { kboRepository } from "@/lib/repositories/kbo";

export default async function AdminPage() {
  const bundle = await kboRepository.getBundle();
  return (
    <AdminHome
      seasons={bundle.seasons}
      teamBrands={bundle.teamBrands}
      venues={bundle.venues}
    />
  );
}
