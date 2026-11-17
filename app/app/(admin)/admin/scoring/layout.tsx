import { getCurrentUser } from "@/lib/auth";
import { SectionTabs } from "@/components/SectionTabs";
import { ROLE_PAGES, settingsTabs } from "@/lib/admin-sections";
import { getFeatures } from "@/lib/features";

// Satu menu Settings, tiga halaman sebagai tab (Sesi 5.1).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allow = user ? ROLE_PAGES[user.role] : undefined;
  return <><SectionTabs tabs={settingsTabs(allow, (await getFeatures()).itpPack)} />{children}</>;
}
