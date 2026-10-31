# Revisão independente da solução B — 31/10/2026 UTC

**Resultado: pacote recebido e compilável, ainda bloqueado para atendimento real.**

## Origem e escopo

- ZIP público fornecido por Luís: https://github.com/absluisabsluis1989-collab/ancora-whatsapp-b/releases/download/b-2026-10-30/ancora-whatsapp-b.zip
- Download anônimo HTTP 200; 467098 bytes; 130 entradas; integridade ZIP verificada.
- SHA256: 3d8e8d483b0f1c3aff15608566a9707eb3649ecb57c2dacd8ff5f5a3ca0315b4.
- Fonte importada sem executar o aplicativo durante a importação: commit eb493030de22ee3a711bc10fad0e37378e626f04, branch import/solution-b-20261031.
- A importação foi uma tarefa única do GitHub Actions. Não há agente de IA ou agenda recorrente nessa tarefa.
- Esta revisão não publicou o B, não carregou clientes, não conectou IA/Z-API/DIANA e não executou SQL na DIANA nem no Neon reservado. Ensaios em máquina temporária sem as credenciais desses serviços.

## Verificações executadas

1. npm ci --ignore-scripts falhou: package-lock.json inconsistente em ajv/json-schema-traverse e dependências relacionadas.
2. npm install --ignore-scripts, conforme o caminho npm install do README, concluiu. Atualizou o lockfile somente na cópia descartável para permitir os checks; o ZIP e o código importado não foram substituídos por essa atualização.
3. npm run test:ancora: 2 testes de topo passaram (cenários simulados e carteira local). São ensaios com MemoryRepo; não comprovam persistência/transação no Neon real nem a IA.
4. npm run typecheck: passou após instalar dependências.
5. npm run build: passou, sem DATABASE_URL ou tokens. Isso comprova compilação, não a renderização em navegador ou o atendimento real.
6. npm test: 197 testes de scripts; 188 passaram e 9 falharam. O comando interrompeu antes da etapa TypeScript seguinte. Falhas abaixo.
7. Seis regressões independentes em review/codex-regressions.test.ts: todas falharam contra o código recebido, antes de qualquer correção da aplicação. Nenhum envio real ocorreu.

## Bloqueios reproduzidos

### 1. Pessoas de mesma idade são fundidas

Arquivo src/lib/ancora/policy.ts, uniqueAges/extractAges, linhas 86–104, e junção no turno na linha 273.

- Entrada: 30 anos e 30 anos.
- Esperado: [30, 30].
- Recebido: [30].

O Set elimina uma pessoa. Também junta o histórico de idades em vez de distinguir declaração completa, complemento e correção. Não pode ser tratado como deduplicação de cliente.

### 2. Resposta simples de idade é ignorada

- Entrada: 68.
- Esperado: [68] quando a pessoa responde ao pedido de idade.
- Recebido: [].

### 3. Meses viram anos

- Entrada: filho de 3 meses.
- Esperado: [0] anos completos.
- Recebido: [3].

Esses campos serão usados no pedido de cotação. A interpretação precisa preservar o conteúdo literal e chegar ao agente/Cotador existente sem perda de pessoas ou alteração da idade.

### 4. O adaptador de envio é descartado

Arquivo src/lib/ancora/pipeline.ts, buildRuntime, linha 879.

O webhook passa deliverZapi ao chamar buildRuntime, mas a função monta outro objeto sem repassar deliver. Teste comprovou runtime.deliver !== deliver. Adicionar credenciais e ativar flag, sozinho, não instala o transporte nesse caminho.

### 5. Dois consumidores podem executar o mesmo trabalho

Arquivos src/lib/ancora/pipeline.ts, drain, linha 213; src/lib/ancora/repo.server.ts, listJobs/updateJob, linhas 234–255.

O consumo seleciona pending por leitura e depois atualiza sem reserva condicional/atômica. Reprodução controlada usando as funções reais e retornos independentes por valor do repositório:

- 1 trabalho pendente.
- 2 consumidores iniciados juntos.
- 2 execuções, 2 partes gravadas e 2 chamadas a um transporte estritamente local.

O teste não chama Neon ou Z-API; o repositório controlado reproduz a semântica de snapshots independentes das linhas retornadas pelo adaptador SQL. É necessário validar a reserva e o isolamento também no Postgres real antes da operação.

### 6. Falha entre a mensagem e o trabalho pode deixar entrada sem processamento

Arquivo src/lib/ancora/pipeline.ts, handleIngress.

A mensagem e o job são gravados separadamente. Falha controlada em insertJob deixou a mensagem persistida sem tarefa. A repetição do mesmo webhook retornou duplicata antes de reparar a tarefa faltante. O teste exige que toda entrada confirmada mantenha processamento concluído ou recuperável.

## Pendências de implantação e integração

- Restringir a reivindicação inicial do ambiente ao operador autorizado antes de expor o aplicativo: hoje claimWorkspace atribui o ambiente ao primeiro usuário autenticado que o abrir; o login oferece cadastro.
- Corrigir e validar o lockfile para uma instalação limpa reproduzível.
- Configurar execução durável da fila; o pacote oferece um processo externo e um endpoint, mas o agendador não está instalado.
- Contrato DIANA ainda é proposta. Precisa ser compatibilizado com o fluxo oficial, a carteira de Luís, idempotência, contexto integral e materiais da cotação.
- A rotina comercial atual produz frases de regra e pedidos locais. O chat interno também retorna textos fixos. Modelo escolhido em documentação não comprova implementação ou chamada real à Anthropic.
- Reexaminar a persistência anterior a saídas externas, IDs de mensagens do provedor, recuperação e resultados incertos antes de permitir envios.
- Validar interface em navegador, banco real, modelo, anexos e WhatsApp somente nas etapas autorizadas, sem usar a carteira de clientes como teste.

## Falhas do npm test do pacote recebido

- SKILL.md and AGENTS.md name the marker path and bound this script uses
- the sections that own the brand-task prohibition never affirm a wait
- SKILL.md tells the pass to self-check with the flag this CLI accepts
- the build side resolves the template's shipped app-env
- the auth schema ships outside the globbed directory
- the template ships auth off
- the wrapped command runs with the app env applied
- the CLI still runs when invoked through a symlinked path
- every hand-over the og skill prints is one this script accepts

Parte dessas verificações depende de arquivos do construtor que não vieram no ZIP. Elas foram registradas, sem apagar testes para obter resultado verde.

## Comando das regressões desta revisão

node --experimental-strip-types --test review/codex-regressions.test.ts

No pacote recebido: 6 testes, 0 passam, 6 falham. Esse arquivo é uma evidência de bloqueios, não uma declaração de correção. Nenhum código de atendimento foi alterado nesta revisão.
