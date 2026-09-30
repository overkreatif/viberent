import { CalendarX2 } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function Blocking() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Atur Jadwal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Blokir tanggal untuk laundry, perawatan, atau pemakaian di luar aplikasi.
        </p>
      </div>
      <Placeholder
        icon={CalendarX2}
        title="Blokir rentang tanggal"
        description="Pilih produk, ukuran, dan rentang tanggal untuk memblokirnya dari katalog. Blokir ini mengurangi ketersediaan seperti booking yang dikonfirmasi."
      />
    </div>
  );
}
