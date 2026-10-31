# Decisões confirmadas e passagem para revisão — 31/10/2026

Este arquivo acompanha integralmente o pedido fornecido em pedido-completo-v1.2.txt. Não depende de abrir Drive para compreender as regras. As decisões posteriores abaixo prevalecem nos pontos em que alteram o pedido original. A revisão deve comparar o código recebido com os documentos, sem presumir que simulação comprova serviço real.

## Produto e carteira
- Aplicativo novo para Luís (com S), WhatsApp pessoal 63992731001 / 5563992731001. Não usar anúncios final 1560 nem a instância interna da Filó.
- Entrada comercial: campanha Sênior e contato direto/indicação; a Filó pode entregar trabalho interno já atribuído a Luís. Notificar Luís assim que houver interesse em plano, sem esperar idade ou cálculo.
- Aproveitar produto/cidade e idades já disponíveis. Perguntar somente o necessário. Nome pode ser obtido depois; não pedir novamente o telefone validado do webhook.
- Dados incompletos ficam em coleta, fora do pipeline comercial.
- Só integrar a carteira comercial depois de cotação válida, calculada, salva e vinculada, com estado confirmado pela DIANA.
- Cliente novo deste número deve ficar atribuído a Luís, sem distribuição genérica. Usar a fase oficial retornada pela DIANA; não criar uma fase nova só porque consta no protótipo.
- Cliente existente de Luís: reutilizar ficha e preservar fase mais avançada. Outro responsável ou identidade ambígua: conflito para conferência, sem transferência nem fusão automática.
- Atribuir não comprova envio. Registrar orçamento enviado somente pela aceitação da parte que efetivamente contém o orçamento ao cliente correto. Aceitar o texto de apresentação, ou mandar arquivo ao corretor, não basta. Aceitação, entrega e leitura são estados distintos.

## Dados, resposta e materiais
- Duas pessoas com a mesma idade são duas vidas. Bebê com menos de um ano corresponde a idade zero; não descartar zero nem transformar três meses em três anos.
- Não inventar idade, nome, vínculo, cidade, modalidade, campanha, preço ou condições. A DIANA e o seu Cotador continuam responsáveis pelo cálculo e pelas regras comerciais.
- Referência Meta só é comprovada quando houver dado confiável do provedor e mapeamento conferido. Texto editável indica interesse, sem provar atribuição publicitária.
- Resposta curta e natural como Luís. Orçamento em imagem; rede e coparticipação em PDF quando aplicáveis. Para Sênior: sem coparticipação, apenas rede de Palmas.
- Falha confirmada de anexo pode usar link de reserva válido e autorizado. Não repetir partes aceitas nem resultados incertos.

## Horários e continuidade
- Responder a quem iniciou/retomou conversa a qualquer hora. Abordagem proativa, lembrete ou retomada iniciada pelo agente somente 08:00–18:00, America/Araguaina.
- Silêncio durante a madrugada não autoriza lembrete noturno.
- Mensagem manual de Luís suspende a automação daquela conversa até retomada explícita.
- Pausa e autorização verificadas no servidor antes de cada parte. Assistente pessoal exige aprovação externa específica.
- Pergunta posterior ao orçamento deve voltar ao processamento e às pendências. Fechar painel ou desligar computador não pode interromper o serviço.

## Confiabilidade
- Entrada persistida e tarefa de processamento precisam ser atômicas ou recuperáveis. Replay não pode deixar mensagem sem trabalho.
- Serializar cada conversa e impedir que trabalhadores concorrentes enviem a mesma saída.
- Persistir reserva/tentativa antes de chamar transporte externo. Se houver interrupção após chamada cujo resultado seja desconhecido, registrar incerteza e conferir; não reenviar automaticamente.
- Preservar cadastro/cotação quando envio falhar. Limitar tentativas e chamadas pagas.

## Integração e limites da entrega
- Contratos presentes nos candidatos são propostas, não endpoints oficiais comprovadamente existentes. A integração oficial com DIANA é responsabilidade do Codex e deverá ser compatibilizada antes de conexão.
- Sem SQL direto no CRM e sem senha/cookie pessoal para gravar dados. Usar serviço autenticado e permissões restritas.
- Modelo pode ser escolhido por qualidade. Nome, disponibilidade, preço e contexto alegados pelos construtores precisam de confirmação independente antes de comprar/configurar. Teste simulado não comprova chamada real ao modelo.
- Nesta revisão manter APP_STAGE=BUILD_ONLY, ZAPI_SEND_ENABLED=0, DIANA_INTEGRATION_ENABLED=0, MODEL_STATUS=NOT_CONFIGURED, sem credenciais reais.
- Não ligar callback, WhatsApp, IA paga ou DIANA nesta etapa. No futuro, somente um candidato pode controlar o número.
- O assistente de vendas antigo continua aposentado. Não restaurá-lo.
- Não criar registros sintéticos na operação, enviar testes a clientes ou importar a carteira na revisão.
- Código A e B permanecem independentes. Nenhuma implementação deve ser copiada da outra.

## Entrega sem dependência de login do construtor
Os ZIPs A e B já foram recebidos e preservados pelo Codex. Não é necessário continuar tentativas de upload, login GitHub ou publicação pelo construtor. Este pedido e as decisões devem acompanhar qualquer pacote futuro. Segredos, cookies e dados pessoais não pertencem ao pacote público.
