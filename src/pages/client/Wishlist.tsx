import { Heart } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function Wishlist() {
  return (
    <Placeholder
      icon={Heart}
      title="Wishlist Anda masih kosong"
      description="Tekan ikon hati pada kartu di katalog untuk menyimpan pakaian favorit Anda di sini."
    />
  );
}
