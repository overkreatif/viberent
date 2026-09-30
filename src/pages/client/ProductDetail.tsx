import { Link } from "react-router-dom";
import { ArrowLeft, Shirt } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

/** Placeholder until the full product-detail task is built. */
export default function ProductDetail() {
  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke katalog
      </Link>
      <Placeholder
        icon={Shirt}
        title="Detail produk"
        description="Galeri, ketersediaan ukuran, dan pemesanan sedang disiapkan. Silakan kembali lagi sebentar."
      />
    </div>
  );
}
