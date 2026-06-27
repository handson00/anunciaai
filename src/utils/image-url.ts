/**
 * Converte uma URL pública do Storage do Supabase em URL de imagem
 * otimizada (resize + qualidade) usando o endpoint `/render/image/public/`.
 *
 * Reduz drasticamente o peso de miniaturas no marketplace e em listagens.
 * Para URLs que não são do Supabase (ex.: já externas), retorna inalterada.
 */
export function thumb(url: string | null | undefined, width = 400, quality = 70): string {
  if (!url) return '';
  // Já é uma render URL ou não é do Supabase Storage
  if (url.includes('/storage/v1/render/image/')) return url;
  if (!url.includes('/storage/v1/object/public/')) return url;

  const rendered = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = rendered.includes('?') ? '&' : '?';
  return `${rendered}${sep}width=${width}&quality=${quality}&resize=cover`;
}
