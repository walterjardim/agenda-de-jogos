# agenda-de-jogos

## Gerar um APK no GitHub Actions

Em **Settings → Secrets and variables → Actions → Variables**, configure
`EXPO_PUBLIC_API_URL` com a URL HTTPS da API incluindo `/api/v1` e
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` com o ID do cliente OAuth Web.

Com o workflow na branch padrão, abra **Actions → Gerar APK → Run workflow**
e selecione a branch que deseja compilar. Ao fim da execução, baixe
`Agenda-de-Jogos-YYYYMMDD-HHMMSS.apk` em **Artifacts**. A data e a hora
seguem o fuso de São Paulo.

O APK usa a assinatura de teste do projeto Android gerado pelo Expo. Para o
login Google, registre no cliente OAuth Android o pacote
`com.agendadejogos.app` e o SHA-1 exibido no resumo da execução.

## Gerar um APK atualizado

No PowerShell, execute na raiz deste repositório:

```powershell
.\gerar-apk.ps1
```

O script copia o frontend desta checkout para uma pasta nova, identificada pela
data e hora, em `C:\aj-apk` (caminho curto para o build nativo no Windows). Ele imprime a origem, o commit e o caminho
do APK gerado. Também grava um arquivo `.apk.json` com a origem e o hash do APK.
Para escolher a pasta, use `-Destino C:\aj-apk\novo`.
No Bash, use `bash gerar-apk.sh` (ou informe uma pasta nova como argumento).

Instale no celular o APK indicado ao término do comando. Recompilar uma cópia
antiga em `C:\Desenvolvimento\frontend` não incorpora as mudanças deste
repositório. Atualizar a API também não atualiza as telas de um APK instalado.

Após entrar na versão atual, abra **Meus times → Cadastrar time**. A tela
**Buscar** também oferece **Gerenciar minhas equipes**. Se aparecer a mensagem
“A busca e a escolha de time estarão disponíveis após a integração do serviço
de equipes”, o aplicativo está executando uma versão anterior à integração.
