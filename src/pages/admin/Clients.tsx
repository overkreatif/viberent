import { Users } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function Clients() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Klien</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buat akun klien — kredensial diberikan secara offline.
        </p>
      </div>
      <Placeholder
        icon={Users}
        title="Belum ada akun klien"
        description="Buat akun klien dengan nama, email, dan kata sandi. Klien bisa langsung masuk dan mulai memesan."
      />
    </div>
  );
}
