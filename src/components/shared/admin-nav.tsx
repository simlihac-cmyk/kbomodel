import Link from "next/link";

const links = [
  { href: "/admin", label: "관리자 홈" },
  { href: "/admin/seasons", label: "시즌" },
  { href: "/admin/teams", label: "팀" },
  { href: "/admin/schedule", label: "일정" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/manual-adjustments", label: "수동 보정" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-line/80 bg-white px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
