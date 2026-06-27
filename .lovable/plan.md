
# Gestão de Estoque e Vendas (Admin)

Mini-sistema interno acessível apenas por admins autorizados, com cadastro de produtos próprios, vendas e um dashboard com indicadores.

## 1. Controle de acesso

- Nova flag `can_manage_stock` (boolean) na tabela `profiles`.
- Por padrão, apenas seu usuário recebe `true` (definido via migração).
- Você poderá habilitar/desabilitar outros admins futuramente em um painel próprio dentro da aba.
- Função SQL `can_manage_stock()` (SECURITY DEFINER) usada nas RLS.

## 2. Banco de dados (novas tabelas)

**`stock_products`** — produtos próprios do estoque
- `name`, `sku` (opcional), `photo_url`, `category`
- `cost_price` (custo), `sale_price` (preço sugerido)
- `stock_qty` (estoque atual), `min_stock` (alerta de baixo estoque)
- `ad_id` (FK opcional para `ads` — vincula a um anúncio existente)
- `active`

**`stock_sales`** — vendas registradas
- `product_id` (FK), `quantity`, `unit_price`, `unit_cost` (snapshot)
- `total` (gerado), `profit` (gerado), `sold_at`, `note`, `customer_name` (opcional)
- Trigger: ao inserir venda, decrementa `stock_qty` do produto; ao deletar, reembolsa.

**`stock_movements`** (simples) — entradas/ajustes manuais (apenas para histórico, sem tela complexa por enquanto):
- `product_id`, `type` ('in' | 'adjust'), `quantity`, `note`, `created_at`.

Todas as tabelas com RLS restrita a `can_manage_stock()` e GRANTs para `authenticated` + `service_role`.

## 3. UI — nova aba "Estoque & Vendas" no AdminPage

Visível somente se `currentUser.can_manage_stock === true`.

Sub-abas internas:

1. **Dashboard**
   - Cards: Vendas (hoje / 7 dias / mês), Lucro (mesmo período), Nº de itens vendidos, Produtos com estoque baixo (badge).
   - Gráfico de linha simples (Recharts) — faturamento últimos 30 dias.
   - Lista Top 5 produtos mais vendidos (mês).
   - Lista de produtos abaixo do `min_stock`.

2. **Produtos**
   - Tabela com busca: foto, nome, estoque, custo, preço, margem, status (ativo).
   - Modal de criar/editar produto — campos completos + seletor opcional "Vincular a anúncio existente" (busca nos `ads` do usuário).
   - Ao vincular, oferecemos botão "Importar dados do anúncio" (título, foto, preço).
   - Botões rápidos: +1 estoque, -1 estoque, ajustar quantidade.

3. **Vendas**
   - Botão "Registrar venda" → modal: escolher produto, quantidade, preço unitário (preenche com `sale_price`), cliente opcional, observação.
   - Validação: não permite vender mais que o estoque.
   - Tabela histórica com filtro por período + total exibido.
   - Ação excluir venda (devolve estoque).

4. **Permissões** (apenas para você)
   - Lista de admins; toggle "Pode gerenciar estoque".

## 4. Arquivos a criar/alterar

- Migração SQL (tabelas, RLS, GRANTs, função `can_manage_stock`, triggers de estoque, coluna `can_manage_stock` em `profiles`, seed `true` para seu user).
- `src/pages/AdminPage.tsx` — adicionar aba condicional.
- `src/components/admin/stock/StockDashboard.tsx`
- `src/components/admin/stock/StockProducts.tsx` (+ form modal)
- `src/components/admin/stock/StockSales.tsx` (+ form modal)
- `src/components/admin/stock/StockPermissions.tsx`
- `src/contexts/AppContext.tsx` — incluir `can_manage_stock` no tipo do usuário e no fetch do perfil.
- Pequena lib `src/lib/stock-queries.ts` com hooks TanStack Query para CRUD e KPIs.

## 5. Validações

- Zod em todos os formulários (preços ≥ 0, quantidade > 0, nome 1–120 chars).
- Server-side: triggers do banco impedem estoque negativo.
- Toda chamada à API verifica `can_manage_stock` via RLS.

## Detalhes técnicos

- KPIs calculados via views SQL (`stock_kpis_daily`) ou agregações no cliente — começarei com agregações via RPC para performance.
- Recharts já está no projeto (caso não esteja, será adicionado).
- Nenhum dado de estoque é exposto na loja pública.
