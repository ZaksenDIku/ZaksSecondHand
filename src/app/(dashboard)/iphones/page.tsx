import { ProductView } from "@/components/domain/product-view";

export default function IPhonesPage() {
  return (
    <ProductView
      productType="iphone"
      title="iPhone 15 og nyere"
      subtitle="Alle iPhone 15+-opsamlinger grupperet efter model. Markedsværdi er beregnet udelukkende fra prisobservationer i denne database."
      emptyTitle="Ingen iPhone 15+ endnu"
      emptyDescription="Importér en DBA-URL, søgnings-alert eller CSV/JSON for at komme i gang. Facebook Marketplace og Vinted kræver manuel import."
      sort="discount"
    />
  );
}
