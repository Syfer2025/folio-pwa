# Conformidade com as diretrizes da Apple

Mapeamento entre o que a Apple exige e onde isso está implementado em `index.html`.
Fontes: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) e
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines).

---

## 0. Escopo — leia antes

**As App Store Review Guidelines valem para apps distribuídos pela App Store.** Um PWA
instalado pelo Safari (Compartilhar › Adicionar à Tela de Início) não passa por App Review,
então não há como "ser aprovado" nesse formato. O que este projeto faz é cumprir as regras
como se fosse submetido, para que um empacotamento futuro (WKWebView/Capacitor) não precise
ser reescrito. As três regras que mudam de status nesse dia estão em § 3.

**Ponto de atenção — diretriz 5.2.5.** O pedido foi "estilo Apple TV+". A Apple *exige* que
se siga a HIG, mas *proíbe* apps "confusingly similar to an existing Apple product, interface
or advertising theme". A separação adotada aqui: foi copiado o **sistema** (cores, tipografia,
materiais, componentes, gestos), que é o comportamento esperado; **não** foi copiada a
**marca** — nome, logotipo, wordmark e arte do app Apple TV. `folio+` é um wordmark próprio.
Layout de vitrine com herói e prateleiras horizontais é padrão de categoria, não é da Apple.

---

## 1. Human Interface Guidelines

| Diretriz | Implementação | Onde |
|---|---|---|
| **Color** — usar as System Colors, não cores inventadas | Os 12 System Colors + 6 System Grays nos valores oficiais, em claro e escuro. `systemBlue` (`#0A84FF` escuro / `#007AFF` claro) como tint. | CSS § 1–2 |
| **Color** — hierarquia semântica | `label` / `secondaryLabel` / `tertiaryLabel` / `quaternaryLabel`, os 4 níveis de `fill`, `separator` e `opaqueSeparator`, todos nos alfas oficiais (ex.: `rgba(235,235,245,.60)`). | CSS § 1–2 |
| **Dark Mode** — suportar as duas aparências | Escuro é o padrão (como o app Apple TV). Claro é completo, não é uma inversão. Controle **Sistema / Claro / Escuro** em Conta. | CSS § 1–2, `applyAppearance()` |
| **Materials** — usar materiais translúcidos no chrome | Barras de navegação e de abas com `backdrop-filter: saturate(180%) blur(20px)` sobre tinta translúcida, equivalente ao `UIBlurEffect`. | CSS § 9–10, `--mat-*` |
| **Typography** — usar os Text Styles do iOS | Os 11 estilos com **tamanho, entrelinha e tracking oficiais**: Large Title 34/41 (+0,37), Body 17/22 (−0,43), Caption 2 11/13 (+0,06) etc. Tracking convertido para `em` para escalar junto. | CSS § 4 |
| **Typography** — San Francisco | `-apple-system` / `SF Pro` primeiro na pilha; em aparelhos não-Apple cai para Inter, que é a substituta métrica mais próxima. SF Pro não é redistribuível. | `--ui` |
| **Dynamic Type** | `html { font-size: calc(100% * var(--dt)) }` — respeita o tamanho de texto do navegador **e** o controle de 7 passos em Conta, com os mesmos degraus do iOS. Tudo em `rem`, nada em `px` fixo. | CSS § 4, `applyDT()` |
| **Layout** — alvo de toque de 44×44 pt | `--hit: 44px` em todo controle, incluindo os pontinhos do carrossel e o botão de limpar busca. | CSS `--hit` |
| **Layout** — safe areas | `viewport-fit=cover` + `env(safe-area-inset-*)` no topo, na barra de abas e no leitor. | CSS § 6 |
| **Tab Bars** — 3 a 5 abas, rótulo curto, ícone + texto | 4 abas: Folio · Folio+ · Biblioteca · Buscar. Item ativo recebe pílula de fundo atrás do ícone, como no app de referência. | § 10, `TAB_GLYPH` |
| **Navigation Bars** — título grande que colapsa | Título grande rola para fora e o título inline aparece junto com o material opaco. Botão Voltar com rótulo, não só o chevron. | § 9, listener de `.scroller` |
| **Modality** — sheets | Folhas com grabber, scrim tocável, `Esc`, foco movido para dentro e devolvido ao fechar. | `openSheet()` / `closeSheets()` |
| **Motion** — respeitar Reduzir Movimento | `prefers-reduced-motion` zera transições **e** desliga o avanço automático do carrossel. | CSS § 5, `bbAuto()` |
| **Accessibility** — Aumentar Contraste | `prefers-contrast: more` eleva os alfas de label e separador. | CSS § 3 |
| **Accessibility** — VoiceOver | `role="tablist/tab/tabpanel"`, `aria-selected`, `aria-current`, `aria-pressed`, `aria-modal`, `role="switch"`. Cada capa tem rótulo com título, autor e progresso lido em voz alta. Toasts em `role="status"`. | markup |
| **Accessibility** — teclado | `:focus-visible` com anel de 3 px no tint; setas ← → e Page Up/Down paginam o leitor; `Esc` fecha camadas. | CSS § 5, `keydown` |
| **Reading experience** (padrão Apple Books) | Quatro temas — Original, Suave, Papel, Noite. Cinco fontes com nomes reais. Corpo de 14 a 30 pt. Paginação horizontal por colunas, com toque nas laterais, swipe e modo imersivo no toque central. | § 18, `openReader()` |
| **Squircle** — cantos contínuos | `corner-shape: superellipse(4)` sob `@supports`, com raio comum como reserva. | `.sq` |

### Onde a plataforma web não alcança

Honestidade sobre os limites, para não parecer conformidade que não existe:

- **Haptics.** `UIFeedbackGenerator` não tem equivalente no Safari do iOS. A Vibration API não é suportada lá. Sem retorno tátil.
- **Voltar arrastando da borda.** O gesto interativo de `UINavigationController` não é reproduzível com fidelidade. Há botão Voltar e `Esc`.
- **Compartilhar.** Hoje é um toast. A Web Share API (`navigator.share`) resolve com poucas linhas e chama a folha nativa — está na lista de pendências.
- **Rotor do VoiceOver por capítulo.** Precisa de landmarks por capítulo no leitor paginado.

---

## 2. App Store Review Guidelines

| Nº | Regra | Como é atendida |
|---|---|---|
| **1.2** | Conteúdo gerado por usuários precisa de denúncia, bloqueio e contato publicado | "Denunciar um problema" na ficha do livro e em Conta; contato visível (`suporte@folio.app`). **Pendente:** filtro e bloqueio só passam a ser exigidos quando houver resenhas escritas por usuários — hoje as notas são agregadas. |
| **2.1** | Nada de placeholder | Todo texto é real: acervo, sinopses e trechos de obras existentes. Amostras terminam num estado explícito ("Fim da amostra"), não em texto cortado. |
| **2.3.2** | Deixar claro o que exige compra | Selo `folio+` impresso no pôster para o que está na assinatura; preço em reais na ficha do livro para compra avulsa. |
| **2.3.9** | Usar dados fictícios nas capturas de tela | O protótipo usa uma conta real para demonstração. **Antes de submeter, trocar por conta fictícia.** |
| **3.1.1** | Conteúdo digital exige In-App Purchase | Não existe mecanismo próprio de desbloqueio, chave de licença nem link externo de pagamento. Todo fluxo de compra aponta para o pagamento da App Store. |
| **3.1.2(a)** | Assinatura ≥ 7 dias, valor contínuo, em todos os aparelhos | R$ 19,90/mês; "acervo grande e continuamente atualizado" é exemplo citado pela própria diretriz; a aba Folio+ afirma a validade em todos os dispositivos. |
| **3.1.2(c)** | Descrever o que se compra antes de comprar | Bloco legal na aba Folio+: preço, renovação automática, prazo de cancelamento de 24 h, onde cancelar, perda do período gratuito restante e condições da compra avulsa. |
| **3.1.1** | Restauração de compras | "Restaurar compras" na aba Folio+ e em Conta. |
| **3.1.3(a)** | **Reader Apps** | É exatamente a categoria deste app ("magazines, newspapers, **books**, audio, music, video"). Permite acessar conteúdo já adquirido e gerenciar conta, sem link externo de compra — que exigiria o External Link Account Entitlement. |
| **4.2** | Precisa ser mais que um site empacotado | Leitura offline com download por título, tipografia com 4 temas e 5 fontes, sincronia de posição, atalhos no ícone, Dynamic Type. |
| **4.8** | Sign in with Apple | Não há login social, então a regra não se aplica hoje. **Se entrar login com Google/Facebook, Sign in with Apple passa a ser obrigatório.** |
| **5.1.1(i)** | Política de privacidade acessível dentro do app | Conta › Privacidade e dados › Política de privacidade. |
| **5.1.1(ii)** | Consentimento e revogação fáceis | "Compartilhar análises de leitura" vem **desligado**, com revogação no mesmo lugar. |
| **5.1.1(iii)** | Minimização de dados | Sem localização, contatos, fotos, câmera, microfone ou notificações. O `sw.js` não envia nada a terceiros. |
| **5.1.1(v)** | Uso sem login e **exclusão de conta no app** | O acervo em domínio público é navegável e legível sem conta. "Apagar conta" existe dentro do app, com prazo declarado de 30 dias. |
| **5.1.2** | Uso e compartilhamento de dados | Nenhum dado sai do dispositivo. Sem SDK de terceiros, sem rastreadores. As únicas requisições externas são as fontes do Google Fonts. |
| **5.2.1 / 5.2.2** | Direitos sobre o material | Acervo em domínio público no Brasil (Lei 9.610/98, art. 41). Cada ficha traz o campo "Direitos". As capas são geradas por código, não são reproduções de capas comerciais. |
| **5.2.5** | Não parecer um produto Apple | Ver § 0. Sistema sim, marca não. |

---

## 3. O que falta para uma submissão de verdade

Em ordem de esforço:

1. **Empacotar em nativo.** PWA não entra na App Store. Com WKWebView, a diretriz 4.2 passa a ser avaliada de verdade — as funções offline e de tipografia acima são o que sustenta o argumento.
2. **StoreKit 2.** Substituir os toasts de compra por produtos reais, com `Product.purchase()`, restauração e tratamento de estados de assinatura.
3. **Política de privacidade publicada** numa URL, mais o preenchimento dos Privacy Nutrition Labels no App Store Connect.
4. **Trocar a conta de demonstração** por dados fictícios nas capturas (2.3.9).
5. **Classificação etária** honesta no App Store Connect (2.3.6). O acervo inclui obras com violência e temas adultos — *Noite na Taverna* e *Crime e Castigo*, por exemplo.
6. **Auditoria com VoiceOver ligado** num aparelho real, não só pela árvore de acessibilidade.
7. **Licenciamento** de tudo que sair do domínio público, antes de entrar no acervo.
