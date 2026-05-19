import { BottomTabBar, Sidebar } from '@/components/admin/TabBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg dark">
      <Sidebar />
      {/* main content offset for sidebar on desktop, padded for bottom bar on mobile */}
      <main className="md:ml-56 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
