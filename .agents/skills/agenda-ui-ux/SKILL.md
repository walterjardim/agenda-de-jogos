---
name: agenda-ui-ux
description: Projete ou revise telas e fluxos do Agenda de Jogos em Expo e React Native. Use para agenda, cadastro de jogos, convocação, troca de time, formulários, acessibilidade e consistência visual em celular e web.
---

# UI/UX do Agenda de Jogos

Leia `frontend/AGENTS.md` e a tela atual. As rotas ficam em `frontend/src/app` e as telas por domínio em `frontend/src/features`. Consulte os componentes de `frontend/src/shared/components` e o tema em `frontend/src/shared/theme` antes de definir novos padrões.

- Na agenda e nos detalhes do jogo, facilite identificar time, adversário, data, horário e local de acordo com a tarefa da tela. Preserve as regras existentes de fuso horário e confira o comportamento perto da meia-noite se a mudança afetar datas.
- Nos fluxos de criação, edição e convocação, deixe visíveis o time ativo e a ação principal. Preserve os dados preenchidos após erros recuperáveis e reutilize a confirmação de descarte existente quando o fluxo já a adotar.
- Use os rótulos em português do produto. Em controles com ícones, forneça nome acessível. Comunique seleção, erro e indisponibilidade com texto ou outro sinal além da cor.
- Verifique os estados aplicáveis à mudança, incluindo carregamento, lista vazia e erro. Confira largura de celular, texto ampliado e interação com teclado quando o fluxo usar formulários. Para a versão web, use `npm run web` em `frontend` e valide foco e navegação por teclado quando relevantes. Para comportamento nativo, valide no dispositivo ou emulador quando disponível.
- Ao revisar uma tela, descreva o problema observado, o fluxo afetado e a menor alteração que o resolve. Ao implementar, siga as verificações de lint e TypeScript de `frontend/AGENTS.md`.
