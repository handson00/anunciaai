export function formatAdPrice(ad: { price: number | string; price_on_request?: boolean | null }): string {
  if (ad.price_on_request) return 'Consultar com vendedor';
  return `R$ ${Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
