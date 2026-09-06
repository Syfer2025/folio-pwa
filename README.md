# Folio

PWA de leitura: biblioteca pessoal, importação dos seus próprios livros, leitor
com anotações e funcionamento offline. Tudo fica **no dispositivo** — não há
servidor, conta, telemetria ou requisição a terceiros.

## Rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:4173`. Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | gera `dist/` com a versão carimbada por hash do conteúdo |
| `npm run preview` | serve o `dist/` já construído |
| `npm test` | 38 testes (Node test runner + Playwright) |

Para instalar no celular é preciso HTTPS: publique o `dist/` e abra no Safari em
Compartilhar › Adicionar à Tela de Início.

## Arquivos

```
index.html      markup e ordem de carga
styles.css      biblioteca, navegação, telas
reader.css      leitor (paleta própria, independente do app)
catalog.js      catálogo e trilhas
storage.js      IndexedDB + jornal de estado em localStorage
import.js       EPUB, TXT e JSON
reader.js       leitor, anotações, sessões, voz
sw.js           service worker do shell
scripts/        build, servidor e lista de arquivos públicos
books/          quatro obras integrais + SOURCES.md
tests/          38 testes
```

## O que o app faz

**Navegação** — Hoje, Explorar, Trilhas, Biblioteca e Caderno.

**Importar** — arquivos `.epub`, `.txt` e `.json`. A leitura do EPUB valida o ZIP
antes de extrair: rejeita travessia de caminho, entradas cifradas, diretório
inconsistente e expansão além do limite, e descarta elemento executável ou
externo do XHTML. TXT detecta capítulos e preserva acentuação. Duplicatas são
identificadas por conteúdo, não por nome de arquivo.

**Leitor** — três temas (branco, sépia, noite), quatro famílias tipográficas
(serifada, sem serifa, para dislexia, monoespaçada), corpo ajustável, modo foco,
marcadores, seleção com notas em vários parágrafos, busca que ignora acentuação
composta ou decomposta, sessões cronometradas e leitura em voz alta no idioma
do livro.

**Dados** — IndexedDB para os livros, jornal em localStorage para o estado.
Limite de 500 livros. Backup e restauração em JSON, com rollback: uma restauração
interrompida volta ao estado anterior em vez de deixar dados pela metade. Falha
de cota preserva o que já estava salvo e o rascunho de nota que estava aberto.

**Offline** — o service worker pré-cacheia o shell inteiro de forma atômica: se
faltar um arquivo, a versão que funciona continua no ar. Uma atualização fica
aguardando aceitação em vez de recarregar uma sessão de leitura em andamento.

## Acervo incluído

Quatro obras **integrais** de Machado de Assis, em domínio público no Brasil
(Lei 9.610/98, art. 41):

| Obra | Estrutura | Palavras |
|---|---|---:|
| Dom Casmurro (Garnier, 1899) | 148 capítulos | 64.628 |
| Memórias Póstumas de Brás Cubas (Typographia Nacional, 1881) | 160 capítulos | 60.246 |
| O Alienista (Papéis Avulsos, 1882) | 13 capítulos | 16.534 |
| A Cartomante (Várias Histórias, 1896) | conto | 3.079 |

Cada JSON guarda o SHA-256 do HTML de origem. Não houve revisão editorial
integral nem confronto página a página com os fac-símiles — ver
[books/SOURCES.md](books/SOURCES.md). São textos para validar o app; o acervo
definitivo é decisão do responsável pelo projeto.

## Conformidade

[DIRETRIZES.md](DIRETRIZES.md) mapeia a aderência à Human Interface Guidelines e
às App Store Review Guidelines — incluindo, explicitamente, onde o app **deixou**
de seguir a paleta da Apple e por quê.
