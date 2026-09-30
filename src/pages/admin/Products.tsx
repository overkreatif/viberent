import { Shirt } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function Products() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Produk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola koleksi pakaian yang tersedia untuk disewa.
        </p>
      </div>
      <Placeholder
        icon={Shirt}
        title="Belum ada produk"
        description="Tambahkan produk pertama Anda — gaun, kebaya, atasan, dan lainnya — lengkap dengan ukuran, stok, kategori, dan foto."
      />
    </div>
  );
}
