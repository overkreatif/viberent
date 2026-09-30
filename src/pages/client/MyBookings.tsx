import { ReceiptText } from "lucide-react";
import { Placeholder } from "../../components/ui/Placeholder";

export default function MyBookings() {
  return (
    <Placeholder
      icon={ReceiptText}
      title="Belum ada pesanan"
      description="Setelah Anda mengirim permintaan booking, statusnya akan tampil di sini — Menunggu, Dikonfirmasi, atau Ditolak."
    />
  );
}
