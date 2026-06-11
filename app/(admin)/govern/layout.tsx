import { TabStrip } from '@/components/admin/TabStrip'
import { categoryTabs } from '@/lib/admin/nav'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TabStrip tabs={categoryTabs.govern} />
      {children}
    </>
  )
}
