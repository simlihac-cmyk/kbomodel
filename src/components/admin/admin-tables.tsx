import { SectionCard } from "@/components/shared/section-card";

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => string | number | null;
};

type AdminTableProps<T> = {
  title: string;
  subtitle: string;
  rows: T[];
  columns: Column<T>[];
};

export function AdminTable<T>({ title, subtitle, rows, columns }: AdminTableProps<T>) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3 text-left">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-line/60 last:border-0">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-muted">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
