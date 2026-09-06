# Conformidade com as diretrizes da Apple

Fontes: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) e
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines).

---

## 0. Leia antes

**As Review Guidelines valem para apps distribuídos pela App Store.** Um PWA
instalado pelo Safari não passa por App Review, então não existe "aprovação"
nesse formato. O projeto cumpre as regras como se fosse submetido, para que um
empacotamento futuro (WKWebView/Capacitor) não precise ser reescrito.

### Histórico do sistema visual

A reescrita que trouxe importação de EPUB, IndexedDB e anotações havia
substituído a paleta da Apple por um sistema próprio verde-oliva. **Isso foi
revertido**: o sistema da Apple está de volta, agora sobre a estrutura nova.

| | Reescrita (verde-oliva) | Agora |
|---|---|---|
| Fundo | `#111310` | `#000000` / `#F2F2F7` (systemBackground) |
| Destaque | `#d4e6a4` | `#0A84FF` / `#007AFF` (systemBlue) |
| Texto secundário | `#adb2a4` | `rgba(235,235,245,.60)` (secondaryLabel) |
| Separador | `#30362c` | `rgba(84,84,88,.65)` (separator) |
| Erro | `#ffac9d` | `#FF453A` / `#FF3B30` (systemRed) |
| Tipografia da interface | Iowan Old Style em títulos | SF Pro com o *tracking* oficial dos Text Styles |
| Chrome | opaco | material translúcido, `saturate(180%) blur(20px)` |
| Ação primária | pílula verde | pílula branca sobre preto, como no app Apple TV |
| Aba ativa no celular | só cor | pílula de fundo atrás do ícone |

A troca foi feita **só em `styles.css` e `reader.css`**. Nenhuma linha de
`app.js`, `storage.js`, `import.js` ou `reader.js` foi tocada, e os 38 testes
continuam passando — a camada visual é independente da funcional.

**Diretriz 5.2.5** — seguir a HIG é exigido; copiar a identidade de um app da
Apple não é. O que voltou foi o **sistema** (cores, tipografia, materiais,
componentes). A marca continua própria: nome, logotipo e arte são do Folio.

---

## 1. Human Interface Guidelines

O que está implementado:

| Diretriz | Implementação | Onde |
|---|---|---|
| **Color** — System Colors oficiais | Fundos, labels, separadores, `systemBlue` e `systemRed` nos valores exatos, em claro e escuro. | `:root` em `styles.css` |
| **Typography** — Text Styles do iOS | Pilha com SF Pro primeiro (Inter como reserva fora da Apple) e o *tracking* oficial convertido para `em`: Large Title +0,37, Title 1 +0,36, Title 2 +0,35, Body −0,43. | `--tr-*` |
| **Materials** — chrome translúcido | `saturate(180%) blur(20px)` na barra superior, na barra inferior do celular, nos diálogos e no toast. | `--mat` |
| **Layout** — alvo de toque de 44×44 pt | 44 px de mínimo em botões, chips e campos; 48 px na navegação lateral; 56 px nos itens da barra inferior. | `styles.css`, `reader.css` |
| **Layout** — safe areas | `viewport-fit=cover` mais `env(safe-area-inset-*)` na barra superior, na barra inferior, no rodapé, no toast e em 10 pontos do leitor. | ambos os CSS |
| **Tab Bars** — 3 a 5 abas no iPhone | Abaixo de 700 px a barra lateral vira barra inferior fixa com 5 itens (Hoje, Explorar, Trilhas, Biblioteca, Caderno), ícone sobre rótulo. | `styles.css` `@media(max-width:700px)` |
| **Motion** — Reduzir Movimento | `prefers-reduced-motion` zera animações e transições nos dois CSS. | ambos |
| **Accessibility** — Aumentar Contraste | `prefers-contrast: more` promove `--muted` e `--dim` a `--text` e reforça as linhas. | ambos |
| **Accessibility** — teclado | `:focus-visible` com anel de 3 px; link "Pular para o conteúdo"; foco devolvido ao botão de origem ao fechar o leitor (coberto por teste). | ambos, `reader.js` |
| **Accessibility** — VoiceOver | `role`, `aria-current`, `aria-live`, `aria-busy`, `aria-label` na navegação, nos bancos e nos avisos. | `index.html`, `app.js` |
| **Dark Mode** | Escuro é o padrão; claro é um tema completo em `[data-theme=light]`, não uma inversão. | `styles.css` |
| **Reading experience** | Três temas de papel, quatro famílias tipográficas, corpo ajustável, modo foco — o leitor tem paleta independente do app, como no Apple Books. | `reader.css` |
| **Unidades relativas** | 47 usos de `rem` no CSS da biblioteca; o texto acompanha o tamanho de fonte do navegador. | `styles.css` |

### Onde a plataforma web não alcança

- **Haptics.** Sem equivalente a `UIFeedbackGenerator` no Safari do iOS.
- **Voltar arrastando da borda.** O gesto de `UINavigationController` não é reproduzível.
- **Rotor do VoiceOver por capítulo.** Falta marcar landmarks por capítulo no leitor.

---

## 2. App Store Review Guidelines

O app deixou de vender qualquer coisa. Não há assinatura, loja, preço nem conta —
é uma biblioteca local com importação. Isso muda o que se aplica:

| Nº | Regra | Situação |
|---|---|---|
| **2.1** | Nada de placeholder | Quatro obras **integrais** de Machado de Assis, não trechos. Estados vazios são estados reais, com ação de saída. |
| **2.5.2** | Dados dentro do container do app | IndexedDB e localStorage. Nada fora. O service worker não intercepta origem externa nem documento do usuário. |
| **3.1.1** | IAP obrigatório para conteúdo digital | **Não se aplica.** Não há desbloqueio, chave, preço ou link de pagamento em lugar nenhum. |
| **3.1.2** | Assinaturas | **Não se aplica.** Não existe assinatura. |
| **3.1.3(a)** | Reader Apps | Continua sendo a categoria correta: o app abre conteúdo que a pessoa já possui. |
| **4.2** | Precisa ser mais que um site empacotado | É o ponto mais forte agora: importação de EPUB/TXT/JSON, leitura offline completa, anotações, sessões cronometradas, leitura em voz alta, backup e restauração. |
| **4.8** | Sign in with Apple | **Não se aplica.** Não há login de espécie alguma. |
| **5.1.1(i)** | Política de privacidade | **Pendente.** Precisa ser escrita e publicada numa URL antes de qualquer submissão — ainda que o texto seja curto, já que não há coleta. |
| **5.1.1(ii–iii)** | Consentimento e minimização | Não há coleta, telemetria, analytics nem SDK de terceiros. Nenhuma requisição sai do dispositivo. |
| **5.1.1(v)** | Uso sem login e exclusão de dados | Não há conta. Preferências e dados permitem apagar tudo, e a exclusão de um livro remove junto o payload offline (coberto por teste). |
| **5.1.2** | Uso e compartilhamento | Nada é compartilhado. Não existe destino para onde enviar. |
| **5.2.1** | Direitos sobre o material | As quatro obras estão em domínio público no Brasil (Lei 9.610/98, art. 41), com edição-fonte e SHA-256 registrados em `books/SOURCES.md`. Livros importados são responsabilidade de quem importa. |
| **5.2.5** | Não parecer produto Apple | Ver § 0. |

### Segurança da importação

Não é diretriz da App Store, mas é o que mais poderia dar errado ao abrir
arquivo de terceiro. Coberto por teste:

- ZIP validado antes de extrair: travessia de caminho, entrada cifrada,
  diretório inconsistente e limite de expansão
- XHTML sem elemento executável nem referência externa
- TXT binário e arquivo acima do tamanho declarado são rejeitados
- Chaves de protótipo (`__proto__` e afins) rejeitadas no estado
- Restauração de backup com rollback: falha volta ao estado anterior

---

## 3. O que falta para uma submissão de verdade

1. **Empacotar em nativo.** PWA não entra na App Store.
2. **Publicar a política de privacidade** e preencher os Privacy Nutrition Labels.
3. **Classificação etária** honesta no App Store Connect.
4. **Auditoria com VoiceOver ligado** num aparelho real.
