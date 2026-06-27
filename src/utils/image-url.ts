/**
 * Retorna a URL da imagem sem transformação.
 * (Removido o resize via endpoint /render/image/ — estava degradando a qualidade
 * das miniaturas no marketplace, loja e dashboard.)
 */
export function thumb(url: string | null | undefined, _width = 400, _quality = 70): string {
  return url || '';
}
