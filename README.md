# Âncora WhatsApp B

Aplicativo comercial do WhatsApp de Luís (`+55 63 99273-1001`), independente da DIANA, da Filó e de outros candidatos. Este pacote roda com Node 22, TanStack Start, Better Auth e Postgres. Não inclui segredo.

WhatsApp, Z-API, modelo pago e DIANA permanecem desligados. O laboratório simula a política. Simulação não valida esses serviços e não entra na carteira operacional.

## 1. Banco e onde ficam os dados

O aplicativo usa o Postgres indicado por `DATABASE_URL`.

- Banco previsto: Neon, projeto `noisy-salad-17508580`, branch `br-morning-thunder-b69zf7en`, database `neondb`. A URL fica só no ambiente do servidor. Não está neste pacote.
- Sem `DATABASE_URL`, o processo sobe um Postgres embutido (PGLite) na memória daquele processo. Serve para ensaio. Os dados somem quando o processo para. Não use isso em operação.
- As tabelas estão em `migrations/`. Cada linha operacional pertence a `owner_user_id`. O primeiro usuário que entra reivindica o ambiente `b`.
- Conversas, mensagens, fila (`jobs`), cotações, arquivos locais e a carteira (`wallet_clients`) ficam nesse banco. Nada é gravado por SQL na DIANA. O navegador não é o arquivo dos dados.

## 2. Fila com o painel fechado

A fila é a tabela `jobs`. Não há Redis.

- Uma mensagem recebida grava a mensagem e o trabalho antes de processar. A própria requisição do webhook drena o que já está vencido, dentro de um limite.
- Com o painel fechado, o processo que continua a fila é `npm run fila`. Ele chama `POST /api/queue/tick` no servidor que já está no ar. Sem `QUEUE_TICK_SECRET` ou `CRON_SECRET` ele sai e não finge que drenou.
- Trabalho com horário futuro, como a revisão diurna, espera esse processo. Abrir o painel também drena, mas não é o mecanismo de fundo.
- Na publicação, um agendador pode chamar `GET /api/queue/tick` com `Authorization: Bearer` igual a `CRON_SECRET`. Exemplo de cron na Vercel, para o Codex acrescentar se quiser, a cada cinco minutos: path `/api/queue/tick`. Este repositório não liga esse cron sozinho.
- O tick não liga envio. `ZAPI_SEND_ENABLED` continua `0`.

## 3. Executar, testar e publicar

```bash
npm install
npm run test:ancora
npm run dev
```

O desenvolvimento escuta em `http://127.0.0.1:8080`. Crie a conta em Entrar. A sessão fica no banco deste aplicativo, não no corretor da plataforma. Os botões Google e X só funcionam quando esse corretor existe.

Para ensaiar a fila em outro terminal, defina `QUEUE_TICK_SECRET` no mesmo ambiente do servidor e do processo `npm run fila`. Não commite o valor.

Testes:

- `npm run test:ancora` cobre a política simulada e a carteira.
- `npm run typecheck` confere os tipos.

Publicação, feita pelo Codex nas conexões dele:

1. Não copiar outro repositório por cima. Não apontar o webhook ainda.
2. Definir `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` no projeto `ancora-whatsapp-b` (`prj_2tTukdaJu4MnQJ6AKqp8zdsXz2k3`).
3. Manter `ZAPI_SEND_ENABLED=0`, `DIANA_INTEGRATION_ENABLED=0` e `MODEL_STATUS=NOT_CONFIGURED`. Não colocar chave de modelo, token da Z-API nem token da DIANA.
4. `npm run build` aplica as migrações quando `DATABASE_URL` existe.
5. A conta criada no primeiro acesso é a dona do ambiente. Não importe a carteira antiga.

## Carteira

Cliente novo deste WhatsApp entra em `wallet_clients`, atribuído a Luís, somente quando a cotação fica válida, salva e vinculada: status `completed`, `saved` verdadeiro e `quoteId` preenchido, em conversa comercial. O mesmo telefone atualiza o vínculo e não cria segunda ficha. Conversa pessoal não entra. Linha de laboratório fica marcada como simulada, não aparece na operação e some ao limpar o laboratório. Isso não grava cliente na DIANA.

## O que continua pendente

Modelo recomendado e ainda não chamado: Claude Sonnet 4.6 (`claude-sonnet-4-6`), Anthropic. Janela de 1.000.000 tokens. Preço de tabela conferido em 30/10/2026: US$ 3 / US$ 15 por 1 milhão de tokens de entrada e saída. Latência não medida. Sem chave, o laboratório não prova inteligência artificial.

Contrato preparado para a DIANA: `ancora.whatsapp.diana.v1`. O endpoint responde desligado até `DIANA_INTEGRATION_ENABLED=1`.
