*Teste realizado por Eduardo Luiz Sebben para NexlyGroup*


## Rodando o projeto
- Na pasta do projeto basta rodar o comando: 
```bash
docker compose up -d
```

- Caso deseja ter mais instancias do worker basta rodar:
```bash
docker compose up -d --scale worker=5
```

---
## Banco de dados
Optei por adicionar algumas informações do evento a mais na tabela events, além de utilizar uma coluna retry_count para contar quantas vezes foi feita a tentativa de processamento, uma coluna max_retries para limitar a quantidade de vezes que um evento é processado, uma coluna next_retry_at para armazenar uma data em que o evento poderá ser reprocessado e uma coluna last_error para salvar qual foi o último erro que não deixou o evento ser processado.

Uma coluna dlq_events foi criada para armazenar os eventos que entraram em DQL após realizado o máximo de tentativas de processamento.

Um Index foi criado na tabela eventos para otimizar o tempo de resposta do banco de dados, as colunas status e next_retry_at foram utilizadas pois elas são as principais colunas utilizadas na busca dos eventos a serem processados.

---
## Estrutura do projeto
- Foi utilizado neste projeto uma estrutura de camadas simples, onde temos as **ROUTES, SERVICES e SCHEMA**.
- Toda a entrada de requisições são feitas através das **ROUTES**, toda a lógica de negócios fica nos **SERVICES** e toda requisição para o banco de dados fica nos **REPOSITORIES**

---
## Rotas 
- Foi criado uma rota para o recebimento dos eventos, esta rota post valida o body utilizando a biblioteca Typebox, esta recebe o evento e salva na tabela events, sempre retornando 200.
Para evitar eventos duplicados a query de inserção utiliza-se do **ON CONFLICT (event_id) DO NOTHING**, sendo assim não realizando qualquer inserção caso o event_id venha duplicado.
- As rotas de DQL e metrics são rotas simples retornando apenas as informações que estão no banco de dados.

---
## Worker
Worker é um serviço que roda em loop, o fluxo dele se dá por:

- A cada segundo ele executa uma query no banco de dados obtendo os 10 primeiros eventos onde o status seja _pending_ ou o status seja _failed_ e o tempo do proximo retry seja menor que o horario atual, juntamente com a query FOR UPDATE SKIP LOCKED, na qual permite a utilização de vários workers processarem registros concorrentes sem conflito. Para as linhas selecionadas, é alterado o status para _processing_, esta consulta e update é realizado dentro de uma **TRANSACTION** a qual garante atomicidade, garantindo que as mudanças sejam feitas.

- Para os eventos em processamento é enviado uma requisição post dependendo de seu _type_

- Caso o processamento ocorra sem problemas, o evento é atualizado com _status_ _processed_

- Para os eventos que tiverem erro em seu processamento o evento é marcado como _failed_, adicionado a mensagem do erro e marcado *next_retry_at* com um backoff exponencial **next_retry_at = NOW() + (INTERVAL '1 second' * POWER(2, retry_count))**
Caso o erro seja 429, é necessário setar a coluna *next_retry_at* com o rate_limit recebido da requisição.

- Caso o evento tenha seu *retry_count* maior ou igual à seu *max_retries* um registro é inserido na tabela *dlq_events* com as informações do evento e deletado da tabela de eventos, estas duas ações são englobadas por uma **TRANSACTION**.

---
## Logs
- Logs na API foram feitos diretamente com o Log padrão do Fastify, já os logs do WORKER foram realizados utilizando a biblioteca **PINO** e salvando em um arquivo app.log para melhor visualização.

---
## Melhorias
- Para um sistema maior, utilização de DTOs de validação de entrada e saida de requisição, além da utilização de enums nos status dos eventos.

