## Objetivo
Permitir marcar um anúncio com preço "Consultar com vendedor" em vez de digitar um valor.

## Mudanças

### 1. Formulário de anúncio (`src/components/AdForm.tsx`)
- Adicionar checkbox/toggle acima (ou ao lado) do campo Valor: **"Consultar com vendedor"**.
- Quando ativado:
  - Esconde/desabilita o input de preço.
  - Salva o preço como `0` no banco (mantém compatibilidade com coluna `price numeric NOT NULL`).
  - Marca uma flag `price_on_request = true`.
- Quando desativado: comportamento atual (valor obrigatório > 0).
- No modo edição, se `price_on_request = true` ou `price = 0`, o toggle já vem ativo.

### 2. Banco de dados
- Adicionar coluna `price_on_request boolean NOT NULL DEFAULT false` na tabela `ads`.

### 3. Exibição do preço
Nos locais que mostram preço do anúncio, exibir **"Consultar com vendedor"** quando `price_on_request` for verdadeiro:
- `src/pages/AdDetailPage.tsx`
- `src/pages/MarketplacePage.tsx`
- `src/pages/MyAdsPage.tsx`
- `src/pages/StorePage.tsx`
- `src/components/Dashboard.tsx` (se listar preço)

### 4. Contexto/tipos
- Adicionar `price_on_request?: boolean` no tipo `Ad` em `src/contexts/AppContext.tsx`.
- Incluir campo em `createAd` / `updateAd`.

### 5. Publicação em grupos (WhatsApp)
- Nas edge functions que montam a mensagem do anúncio (`publicar-anuncio`, `processar-fila-publicacao`, `processar-agendamento-anuncios`), quando `price_on_request` for true, substituir o valor por "Consultar com vendedor" na mensagem enviada.

## Fora de escopo
- Filtros de preço no marketplace continuam ignorando anúncios "sob consulta" (aparecem normalmente na listagem, apenas sem valor numérico).
