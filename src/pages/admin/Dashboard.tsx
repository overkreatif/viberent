import { LayoutDashboard } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola permintaan booking dari klien.
        </p>
      </div>
      <Placeholder
        icon={LayoutDashboard}
        title="Belum ada permintaan booking"
        description="Permintaan booking dari klien akan muncul di sini untuk Anda konfirmasi atau tolak — dengan pembaruan real-time."
      />
    </div>
  );
}
