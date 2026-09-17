# Integração oficial com LinkedIn

A página da empresa configurada para o aplicativo é:

`https://www.linkedin.com/company/rafaella-guimar%C3%A3es-data-technology`

## 1. Configurar o aplicativo

No LinkedIn Developer Portal:

1. Associe a Company Page acima ao aplicativo.
2. Adicione o produto **Sign In with LinkedIn using OpenID Connect**.
3. Em **Auth > Authorized redirect URLs**, adicione:

```text
http://localhost:3000/auth/linkedin/callback
```

4. Copie o Client ID e o Client Secret.

Para o aplicativo mostrado no portal, o Client ID é `77d1w62r9e77fx`. Ele pode
ficar no `.env`, mas o Client Secret deve ser copiado diretamente no arquivo
`.env` local e nunca enviado por chat ou commit.

## 2. Executar localmente

Copie `.env.example` para `.env` e preencha os valores:

```powershell
Copy-Item .env.example .env
npm start
```

Abra `http://localhost:3000/auth/linkedin` e autorize o aplicativo.

Depois do callback, o perfil básico será salvo em `data/linkedin-profile.json`.

O fluxo inicial usa:

```text
openid profile email
```

Esses escopos retornam nome, foto e e-mail. Para tentar importar experiências,
artigos e outros dados do membro, solicite no portal o produto **Member Data
Portability API (3rd Party)**. Se aprovado, altere localmente:

```text
LINKEDIN_SCOPES=openid profile email r_dma_portability_3rd_party
```

O LinkedIn informa que esse produto exige revisão da aplicação, verificação
empresarial e consentimento de membro elegível na EEA. A Company Page associada
precisa ser verificada por um super admin.

## Limitações da API

Com o produto OpenID Connect, o LinkedIn fornece os dados básicos autorizados do membro, como nome, foto e e-mail. Experiências, projetos e todo o conteúdo do perfil não ficam disponíveis automaticamente para um aplicativo comum. Esses dados continuam precisando ser mantidos no conteúdo editorial do portfolio ou em uma fonte própria.

Nunca publique `.env`, Client Secret ou tokens no GitHub. O servidor não grava o
access token; ele usa o token apenas durante o callback para buscar o snapshot.
