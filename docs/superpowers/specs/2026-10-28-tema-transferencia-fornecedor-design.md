# Tema claro, transferência entre contas e fornecedor como conta

**Data:** 2026-10-28
**Status:** Aprovado para planejamento de implementação

## 1. Contexto

O dono trouxe cinco pedidos numa conversa só. Dois deles saíram do escopo
durante o levantamento, porque o sistema já os atende:

- **Permuta avulsa** ("dar entrada em produto que veio de troca direta, sem
  venda por trás") já existe desde a migração `0020_permuta_avulsa_e_desmembramento.sql`
  e o `app/permutas/NovaPermutaModal.tsx`. O dono conferiu na tela durante a
  conversa e confirmou: *"esta certo as permutas, olhei agora"*.
- **Pagamento parcial** já funciona: `pagamentos` aceita N baixas por
  lançamento, `saldo()` desconta o que já foi pago e a tela mostra "Falta".
  Foi apresentado ao dono como os ERPs brasileiros tratam o caso (baixa
  parcial mantendo o vencimento original, versus renegociação gerando título
  novo). Ele escolheu **manter como está**: uma linha por dívida, vencimento
  original preservado.

Sobram três construções e uma correção visual, especificadas aqui.

## 2. Escopo

**Dentro do escopo:**

- **A.** Tema claro/escuro com botão de alternância.
- **B.** Transferência entre contas financeiras.
- **C.** Tela de fornecedor funcionando como conta: quanto devo, há quantos
  dias, histórico, baixa, ajuste de dívida e cadastro de compra no próprio
  lugar.
- **D.** Cor da coluna "Falta" passando a significar alguma coisa.

**Fora do escopo:**

- **Taxa em transferência.** Nenhuma das contas da loja cobra tarifa hoje.
  Decisão do dono: *"não tem taxa hoje cobrando... Se caso tiver taxa, depois
  a gente pensa nisso."* O valor que sai é o valor que chega.
- **Renegociação do saldo restante** (gerar título novo com data nova quando
  sobra saldo). Avaliado e recusado em favor do padrão de baixa parcial.
- **Etiqueta "Parcial · atrasada".** O dono recusou: *"acho que vai ficar
  muito grande o status escrito"*. O item D cobre a necessidade com cor.
- **Tema seguindo o sistema operacional.** É botão manual, por escolha
  explícita do dono.
- **Permuta avulsa e pagamento parcial**, pelos motivos da seção 1.

**Anti-objetivos** — o que faz isso falhar mesmo funcionando:

1. **Transferência inflar o faturamento.** Depositar R$ 1.000 do caixa no
   banco não é venda. Se cada depósito aparecer como receita, o faturamento
   do mês vira ficção e as metas vão junto.
2. **Ajuste de dívida de fornecedor mexer em caixa ou DRE.** Reconhecer que
   se deve R$ 6.500 não é gastar R$ 6.500 — não houve entrada nem saída.
3. **O saldo do fornecedor virar um número paralelo.** Se a dívida do
   fornecedor for mantida à mão, separada dos lançamentos, ela vai divergir
   deles em algumas semanas e nenhum dos dois números será confiável. Tem que
   ser a mesma soma, vista de outro ângulo.
4. **Contar a mesma compra duas vezes**: uma como ajuste de dívida e outra
   como lançamento.
5. **Tema claro branco estourado.** Pedido do dono: *"não precisa ser um
   brancão, pode ser um tonzinho não tão claro"*.

## 3. Decisões tomadas com o dono

Cada uma foi decidida explicitamente na conversa de levantamento:

| Assunto | Decisão |
|---|---|
| Pagamento parcial | Mantém o padrão de baixa parcial: uma linha, vencimento original, situação "parcial". Sem data nova para o saldo. |
| Etiqueta de situação | Não muda. Dívida vencida com parte paga continua "Atrasada". |
| Coluna "Falta" | Passa a ser colorida por situação, em vez de vermelha sempre. |
| Transferência | Quatro campos: origem, destino, valor, data. Dinheiro em espécie é uma conta como outra qualquer. |
| Transferência nos relatórios | Fora de faturamento, metas, DRE e fluxo. Mexe só em saldo. |
| Taxa de transferência | Não existe hoje; fica para depois. |
| Ajuste de dívida do fornecedor | O dono informa **quanto deve de verdade** (ex.: 6.500) e o sistema grava a diferença, como a tela de Contas já faz com saldo. |
| Ajuste nos relatórios | Não aparece: não saiu dinheiro. |
| Pagamento de dívida antiga | **Conta como despesa do mês.** Decisão do dono: *"a questão dele sair o dinheiro, sim, na hora do pagamento tem que constar"*. |
| Saída vinculada a fornecedor | Abate o saldo devedor dele na hora. |
| Tema | Botão manual com ícone de sol/lua. Claro em tom suave, não branco. |
| Antiguidade ("há quantos dias") | Conta a partir do dia em que a transação foi **digitada** no sistema. O dono lança a compra no mesmo dia em que pega a mercadoria. |
| Verificação antes de aprovar | Só testes automatizados. Nenhum dado de teste no banco da loja; o dono valida as telas depois do Promote. |

## 4. Desenho

### A. Tema claro/escuro

Hoje `app/globals.css` define as cores em `:root` e o visual é escuro:
fundo `#05070A`, cards de vidro translúcido, dois degradês radiais no `body` e
o degradê da marca (ciano → magenta → laranja) amostrado da logo da GM Studio
Gamer.

**Mecanismo.** Atributo `data-theme` no `<html>`, com as mesmas variáveis
redefinidas para o tema claro. A escolha fica no `localStorage` do navegador e
é aplicada por um script inline no `<head>`, antes da primeira pintura — sem
isso a tela pisca escura em cada carregamento para quem escolheu claro.
Preferência é por navegador, não por usuário no banco: é escolha de conforto
visual, e gravar no banco exigiria uma coluna e uma ida ao servidor para algo
que tem que responder instantaneamente.

**Botão.** Ícone de sol/lua na `Sidebar`, alternando entre os dois temas.

**Paleta clara.** Fundo em tom suave (algo na faixa de `#F1F3F7`), não branco
puro; texto escuro de alto contraste; superfícies claras com a mesma ideia de
camada que o escuro tem. O degradê da marca é preservado — é a identidade da
loja. Os degradês radiais do `body` precisam de opacidade muito menor no
claro, senão viram manchas coloridas.

**Armadilha conhecida:** parte das cores está em classe Tailwind fixa, não em
variável — `StatusTag.tsx` usa `bg-red-950`, `bg-blue-950`, `bg-amber-950`,
`bg-emerald-950`, e há `text-[var(--bg)]` sobre fundo de botão. Essas
combinações são ilegíveis no claro. Quem construir precisa varrer as cores
fixas antes de declarar o tema pronto; só trocar `:root` não resolve.

### B. Transferência entre contas

**Modelo.** Uma transferência grava **duas pernas** numa transação única do
banco: uma despesa na conta de origem e uma receita na conta de destino, cada
uma com seu pagamento na conta respectiva. Transação única pelo mesmo motivo
que o ajuste de saldo já usa (`0013`): metade gravada sumiria com dinheiro do
saldo consolidado.

As duas pernas carregam uma marcação nova em `lancamentos` que diz "isto é
transferência", e um identificador comum que liga uma à outra — é ele que
permite estornar as duas juntas e impede que uma viva sem a outra.

**Exclusões.** Transferência fica fora de faturamento, metas, DRE e fluxo —
exatamente os mesmos pontos de onde `ajuste_saldo` já é excluído hoje:
`lib/relatorios-calc.ts` (as duas funções de agrupamento), `lib/metas-calc.ts`
e `lib/queries/dashboard.ts`. Quem construir deve tratar essa lista como um
conjunto: deixar um ponto de fora é o anti-objetivo 1 acontecendo em silêncio.

**Saldo.** `lib/saldos.ts` não muda. Ele já soma receita e subtrai despesa por
conta, a partir dos pagamentos — as duas pernas se encaixam sozinhas.

**Validações:** contas diferentes; valor maior que zero; as duas contas
existem e estão ativas.

**Tela.** Botão "Transferir" em `/contas`, ao lado de "Nova conta". Em
Lançamentos as duas pernas aparecem com uma etiqueta "Transferência", como já
existe etiqueta para ajuste de saldo (`LancamentosTable.tsx`). Elas **não são
editáveis** pelo formulário comum — editar uma perna quebraria o par. O que se
pode fazer é estornar a transferência inteira.

**A trava do par é no banco, não na tela.** Hoje existem três caminhos que
quebram o par e tiram dinheiro do saldo em silêncio: editar o lançamento,
excluí-lo (`excluirLancamentoAction`) e estornar um pagamento isolado
(`estornarPagamentoAction`). Esconder botões cobre a tela, não os caminhos —
e é exatamente o raciocínio que a `0021` já aplicou à duplicata: *"quem precisa
recusar é o banco, porque é o único ponto por onde todos os caminhos passam"*.
Então a `0022` traz trigger ou constraint impedindo que uma perna viva sem a
outra. Trigger comum, **sem** `security definer`, como manda a seção 5.

**Detalhe de implementação:** `idx_lancamentos_idempotency` é único por linha,
então as duas pernas **não podem** compartilhar a mesma `idempotency_key`. Ela
fica em uma perna só.

**Alternativa recusada:** reaproveitar a marcação `ajuste_saldo`. Seria menos
uma coluna, mas confundiria duas coisas diferentes num relatório ("por que
tenho R$ 40 mil de ajuste este mês?") e não daria como ligar as pernas.

### C. Fornecedor como conta

A tela `app/fornecedores/[id]/page.tsx` existe e hoje mostra só o próximo
vencimento e uma lista de descrições com valores. Não dá para dar baixa, nem
saber quanto se deve, nem há quanto tempo.

#### O que a tela passa a mostrar

**Topo:** quanto devo a ele hoje · há quantos dias está a compra mais antiga
ainda em aberto · data da última compra · próximo vencimento.

**Lista**, uma linha por movimento, com as colunas que o dono pediu: descrição
· data em que foi adicionada e **há quantos dias** · vencimento · valor ·
falta · situação.

A antiguidade e o filtro de período saem de `created_at` — o dia em que a
linha foi digitada —, e não do vencimento. Decisão do dono, que lança a compra
no mesmo dia em que pega a mercadoria; o vencimento de uma compra a prazo
contaria dias *até vencer*, que é o oposto do que ele quer olhar. Limitação
aceita: nas ~418 linhas importadas do sistema antigo, `created_at` é a data da
importação, então a antiguidade delas não vale nada. São linhas antigas, quase
todas quitadas, e nenhuma delas é o caso de uso ("qual compra eu pago
primeiro"). Ordem: **em aberto primeiro, mais antigo no topo**; quitados
depois. Essa ordem é funcional, não estética — é ela que sustenta o que o dono
descreveu: *"se eu for pagar ele, eu prefiro pagar essa de 30 dias atrás do
que pagar outra"*.

**Filtro de período**, porque o dono quer *"ver tudo que eu peguei naquele mês
ou naquele período ali com aquele fornecedor"*. O filtro afeta o histórico; o
"quanto devo" do topo é sempre o total atual, independente do filtro — saldo
devedor filtrado por mês seria um número sem significado.

**Três ações:** adicionar compra · registrar pagamento · ajustar dívida.

#### Os três tipos de movimento

O saldo devedor do fornecedor é uma conta só, feita de três parcelas. Todos os
três são `lancamentos` — nenhum deles mora numa tabela paralela, pelo
anti-objetivo 3.

1. **Compra** — despesa vinculada ao fornecedor, como já existe hoje. Soma na
   dívida pelo que falta pagar dela. Conta no DRE pelo valor, quitada ou não
   (é o comportamento atual de `agruparPorCategoria`). Pode nascer já paga
   (compra à vista) ou em aberto (compra a prazo).

2. **Ajuste de dívida** — o dono informa o total real (6.500) e o sistema
   grava a diferença entre o que achava e o que foi informado, com data,
   marcada como ajuste de dívida. Mesmo mecanismo do `AjusteSaldoModal` das
   contas: o número não pula sozinho, fica registrado quando e quanto mudou.
   Nunca tem pagamento vinculado, e fica fora de caixa, DRE, metas e fluxo.
   Quando o ajuste **diminui** a dívida, a diferença é gravada com o sinal
   oposto — mesma solução que `registrar_ajuste_saldo` usa.

   **Também fica fora de `/dividas` e dos cards "Atrasado" e "Vence em 7 dias"
   do dashboard** (`lib/queries/dashboard.ts:65`, que hoje filtra só
   `ajuste_saldo`). Um ajuste é despesa sem pagamento: por tudo que existe
   hoje ele nasceria "em aberto" e, com data passada, "atrasado" — o card de
   atraso do dono mudaria de valor no dia em que ele informasse "devo 6.500",
   sem nada ter vencido. Ajuste não tem vencimento, então "atrasado" não
   significa nada para ele. Ele aparece na tela do fornecedor e na coluna
   "Devo" da lista de fornecedores, e em mais lugar nenhum.

3. **Quitação de dívida informada** — "paguei R$ 2.000 pro Carlos" quando a
   dívida dele **não está lançada compra a compra**, só informada por ajuste.
   Sai dinheiro de uma conta, **conta como despesa do mês** (decisão do dono,
   com categoria escolhida no formulário como em qualquer despesa) e abate o
   saldo devedor **sem somar nele**.

**Saldo devedor = compras em aberto + ajustes − quitações.**

#### Onde o pagamento é aplicado — e por que isso não é detalhe

Este é o ponto em que a tela pode mentir, então a regra é dura: **o pagamento
sempre é aplicado contra alguma coisa da lista.**

Ao registrar pagamento na tela do fornecedor, o dono vê os itens em aberto —
compras e a dívida informada por ajuste — **do mais antigo para o mais novo**,
e escolhe o que está quitando (sugestão de preenchimento: o mais antigo
primeiro). O que acontece depois depende do que ele escolheu:

- **Escolheu compras** → é baixa comum, grava `pagamentos` naquelas compras.
  **Não gera despesa nova**: a compra já bateu no DRE no mês dela, pelo valor
  cheio, paga ou não (`agruparPorCategoria`, `lib/relatorios-calc.ts:63`).
  Gerar uma despesa aqui contaria a mesma compra duas vezes — anti-objetivo 4.
- **Escolheu a dívida informada** → gera a quitação do tipo 3, que conta como
  despesa do mês, porque essa compra nunca foi lançada e portanto nunca bateu
  no DRE.

**Pagamento solto é recusado.** Se o dono marcar "pagamento de dívida" em
Lançamentos enquanto existem compras em aberto daquele fornecedor, a tela
avisa e oferece quitá-las. Sem essa trava, as compras continuariam "em aberto"
na lista, envelhecendo e com "falta" cheia, enquanto o "quanto devo" do topo
já teria descido — a tela discordando dela mesma, justamente no cenário que o
dono descreveu ("prefiro pagar essa de 30 dias atrás").

#### Por que a marcação "compra ou pagamento" precisa existir

Uma saída de R$ 2.000 vinculada ao Carlos é ambígua: pode ser compra nova paga
na hora (não abate dívida nenhuma — soma 2.000 e paga 2.000) ou pagamento da
dívida velha (abate 2.000). Só o dono sabe qual é. Por isso o formulário de
lançamento, quando um fornecedor é escolhido, pergunta: **compra nova** ou
**pagamento de dívida**. Sem essa pergunta, o pedido do dono — *"paguei 2 mil,
para quem? Fornecedor tal. Eu já queria que abatesse no saldo dele"* — não tem
como ser atendido, porque o sistema trataria todo pagamento como compra nova e
o saldo nunca desceria.

A pergunta aparece **só na despesa avulsa** com fornecedor, criada ou editada.
Série (parcelada ou fixa) é sempre compra — ninguém parcela a quitação de uma
dívida que já existe. A coluna nasce `not null default false` ("é compra"), de
modo que **todos os lançamentos já existentes entram no saldo devedor como
compras**, que é o que eles são.

#### A armadilha da dupla contagem

O ajuste existe para dívida que **não está lançada item a item**. Se as compras
do Carlos já estão cadastradas uma a uma, elas já somam na dívida — ajustar
para 6.500 por cima contaria as duas coisas. O ajuste informa o total, então
na prática ele *substitui* o que o sistema calculava; mas se metade da dívida
está lançada e a outra metade não, o dono precisa entender o que está fazendo.
A tela de ajuste deve mostrar, lado a lado, o que o sistema calcula hoje e o
campo do valor real — como o ajuste de saldo das contas já faz.

#### Lista de fornecedores

`/fornecedores` ganha uma coluna **"Devo"** com o total de cada um, para bater
o olho sem abrir um por um.

### D. Cor da coluna "Falta"

Hoje `LancamentosTable.tsx` e `app/dividas/page.tsx` pintam a coluna "Falta"
de vermelho em **toda** linha — inclusive numa recém-lançada que não venceu, e
no "R$ 0,00" de uma quitada. Vermelho que aparece sempre não informa nada.

Passa a seguir a situação: vermelho quando atrasada, âmbar quando parcial,
discreto quando quitada, normal quando em aberto. Mesma regra nas duas telas.

## 5. Restrições do projeto

Valem para tudo acima:

- **Migrações.** Próximo número livre: `0022`. Nunca editar migração já
  aplicada, nem para corrigir comentário — o arquivo em git é o registro do
  que rodou no banco.
- **RLS.** Toda tabela e coluna nova segue o padrão da `0009`: policies
  separadas por comando, nunca `for all`; leitura para qualquer perfil,
  escrita só para `dono`/`gerente`. Conferência:
  `select tablename, count(*) filter (where cmd='ALL') from pg_policies where schemaname='public' group by tablename` tem que dar 0 em todas.
- **Funções novas.** `set search_path = public, pg_temp`, e **sem**
  `security definer` — assim as policies da `0009` continuam valendo e viewer
  não grava.
- **Privilégio de coluna em `profiles`** não pode ser afetado: `authenticated`
  tem UPDATE só em `nome` (ver README).
- **Idempotência.** Formulários novos que criam lançamentos carregam
  `idempotency_key` como os atuais (`0021`) — a trava que existe porque três
  pares de lançamentos duplicados nasceram com menos de 1 segundo de
  diferença.
- **Testes.** Funções puras de `lib/` têm teste em vitest. O cálculo do saldo
  devedor do fornecedor e as exclusões de transferência entram nessa regra:
  são justamente as contas que, erradas, mentem em silêncio.
- **Dinheiro e datas.** `numeric(12,2)` no banco, `round2` no JS; datas ISO
  comparadas como string, sem converter para `Date`.
- **Deploy.** Push na `main` constrói preview; produção exige **Promote to
  Production** manual no painel da Vercel. Preview aponta para o **banco de
  produção** — navegar é seguro, criar e apagar dado mexe na loja de verdade.
- **Verificação.** Por decisão do dono, **nenhum dado de teste é criado no
  banco da loja**, nem pelo preview. O que garante que as contas estão certas
  são os testes em vitest sobre as funções puras; o dono valida as telas
  depois do Promote. Consequência a não esquecer: a `0022` continua tendo que
  ser **aplicada ao banco antes do deploy do código que a usa** — é só adição,
  nenhum fluxo existente passa a depender dela, mesma ordem que a `0020`
  exigiu. Sem isso, preview e produção quebram juntos.

## 6. O que fica a cargo de quem construir

- Valores exatos da paleta clara e o ajuste de opacidade dos degradês.
- A varredura das cores fixas em Tailwind e como substituí-las.
- Nomes de colunas, funções e arquivos.
- Onde mora o cálculo do saldo devedor (sugestão: `lib/fornecedores.ts`,
  puro e testável, no espírito de `lib/saldos.ts`).
- Layout dos modais e a divisão em componentes.
- Se a transferência ganha RPC própria ou server action com transação.
