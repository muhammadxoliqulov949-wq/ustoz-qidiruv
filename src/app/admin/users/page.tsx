import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import { countAdminAccounts, listAdminAccounts } from "@/server/account-service";
import { AdminFilterLink, AdminPanel, formatAdminDateTime } from "@/components/admin/admin-ui";
import { Badge, ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { AccountRole, AccountStatus } from "@/server/account-service";

export const metadata: Metadata = { title: "Hisoblar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const statuses = ["all", "active", "deactivated"] as const;
const roles = ["all", "student", "teacher", "admin"] as const;
type StatusFilter = (typeof statuses)[number];
type RoleFilter = (typeof roles)[number];

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function status(value: string | string[] | undefined): StatusFilter {
  const raw = one(value);
  return (statuses as readonly string[]).includes(raw) ? raw as StatusFilter : "all";
}
function role(value: string | string[] | undefined): RoleFilter {
  const raw = one(value);
  return (roles as readonly string[]).includes(raw) ? raw as RoleFilter : "all";
}

const statusLabel: Record<StatusFilter, string> = { all: "Barchasi", active: "Faol", deactivated: "Deaktiv" };
const roleLabel: Record<RoleFilter, string> = { all: "Barcha rollar", student: "O‘quvchi", teacher: "Ustoz", admin: "Administrator" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage("/admin/users");
  if (!admin) return null;
  const params = await searchParams;
  const selectedStatus = status(params.status);
  const selectedRole = role(params.role);
  const rawPage = Number(one(params.page));
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 50;
  const options = { status: selectedStatus, role: selectedRole } as { status: AccountStatus | "all"; role: AccountRole | "all" };
  const total = await countAdminAccounts(options);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pageCount);
  const accounts = await listAdminAccounts({ ...options, limit, offset: (page - 1) * limit });
  const hasPrevious = page > 1;
  const hasNext = page * limit < total;
  const query = (nextPage: number) => `/admin/users?status=${selectedStatus}&role=${selectedRole}&page=${nextPage}`;

  return (
    <div className="flex flex-col gap-6">
      <header><h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">Hisoblar</h1><p className="mt-2 max-w-prose text-base leading-relaxed text-ink-700">Hisob holati va roli bo‘yicha xavfsiz operatsion ko‘rinish. Parol hash, sessiya va provayder ma’lumotlari bu yerga kiritilmaydi.</p></header>
      <div className="flex flex-col gap-3"><span className="text-sm font-medium text-ink-700">Holat</span><ul className="flex flex-wrap gap-2">{statuses.map((value) => <AdminFilterLink key={value} href={`/admin/users?status=${value}&role=${selectedRole}`} label={statusLabel[value]} count={value === "all" && selectedRole === "all" ? total : undefined} active={selectedStatus === value} />)}</ul><span className="text-sm font-medium text-ink-700">Rol</span><ul className="flex flex-wrap gap-2">{roles.map((value) => <AdminFilterLink key={value} href={`/admin/users?status=${selectedStatus}&role=${value}`} label={roleLabel[value]} active={selectedRole === value} />)}</ul></div>
      <AdminPanel title="Foydalanuvchi hisoblari" description={`${total} ta hisob · sahifa ${page}`}>
        {accounts.length === 0 ? <EmptyState title="Hisob topilmadi" as="h3">Tanlangan filtrlar bo‘yicha hisob yo‘q.</EmptyState> : <ul className="flex flex-col divide-y divide-line">{accounts.map((account) => <li key={account.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-ink-900">{account.name ?? "Profil nomi yo‘q"}</p><p className="text-sm text-ink-500">{account.phone ?? account.email ?? "Identifikator yo‘q"} · {roleLabel[account.role]}</p></div><Badge variant={account.accountStatus === "active" ? "success" : "danger"}>{account.accountStatus === "active" ? "Faol" : "Deaktiv"}</Badge></div><p className="text-xs text-ink-500">Yaratilgan: {formatAdminDateTime(account.createdAt)}{account.deactivatedAt ? ` · Deaktiv: ${formatAdminDateTime(account.deactivatedAt)}` : ""}</p><p className="font-mono text-xs text-ink-500">{account.id}</p></li>)}</ul>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><span className="text-sm text-ink-500">{accounts.length ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}` : "0 / 0"}</span><div className="flex gap-2">{hasPrevious ? <ButtonLink href={query(page - 1)} variant="outline" size="sm">Oldingi</ButtonLink> : null}{hasNext ? <ButtonLink href={query(page + 1)} variant="outline" size="sm">Keyingi</ButtonLink> : null}</div></div>
      </AdminPanel>
    </div>
  );
}
