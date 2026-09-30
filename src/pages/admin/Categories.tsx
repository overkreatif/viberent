import { Tags } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function Categories() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Kategori</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelompokkan produk agar mudah ditemukan klien.
        </p>
      </div>
      <Placeholder
        icon={Tags}
        title="Belum ada kategori"
        description="Buat kategori seperti Gaun, Kebaya, Atasan, dan lainnya untuk mengelompokkan produk di katalog."
      />
    </div>
  );
}
