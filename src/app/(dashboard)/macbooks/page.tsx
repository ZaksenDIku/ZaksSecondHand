import { ProductView } from "@/components/domain/product-view";

export default function MacBooksPage() {
  return (
    <ProductView
      productType="macbook"
      title="MacBook M1 og nyere"
      subtitle="Apple Silicon MacBooks grupperet efter model og lagerplads. Inkluderer kun konfigurationer, der matcher appens scope."
      emptyTitle="Ingen MacBook M1+ endnu"
      emptyDescription="Importér en URL, alert-tekst eller CSV/JSON med MacBook M1+-data."
      sort="discount"
    />
  );
}
