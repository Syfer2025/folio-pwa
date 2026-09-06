# Conformidade com as diretrizes da Apple

Fontes: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) e
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines).

---

## 0. Leia antes

**As Review Guidelines valem para apps distribuídos pela App Store.** Um PWA
instalado pelo Safari não passa por App Review, então não existe "aprovação"
nesse formato. O projeto cumpre as regras como se fosse submetido, para que um
empacotamento futuro (WKWebView/Capacitor) não precise ser reescrito.

### ⚠️ O sistema visual da Apple foi abandonado na reescrita

O pedido original era seguir **estritamente** as cores e a tipografia da Apple,
no estilo do app Apple TV. A versão até o commit `68ca780` fazia isso: os 12
System Colors e 6 System Grays nos valores oficiais, os 11 Text Styles do iOS
com tamanho, entrelinha e *tracking* oficiais, materiais translúcidos.

A reescrita que trouxe importação de EPUB, IndexedDB e anotações **substituiu
tudo isso** por um sistema próprio:

| | Antes (`68ca780`) | Agora |
|---|---|---|
| Fundo | `#000000` (systemBackground) | `#111310` (verde-oliva escuro) |
| Destaque | `#0A84FF` (systemBlue) | `#d4e6a4` / `#345323` |
| Texto secundário | `rgba(235,235,245,.60)` | `#adb2a4` |
| Tipografia | Text Styles do iOS com tracking oficial | Inter + Iowan Old Style, escala própria |
| Vitrine | herói + prateleiras estilo Apple TV | barra lateral + grade editorial |

Isso é uma **decisão de produto, não um bug** — mas contraria o requisito
original. O CSS antigo está preservado em `work/styles-before.css` e no histórico
git (`git show 68ca780:styles.css`). Restaurar a paleta Apple sobre a estrutura
nova é trabalho de reaplicar tokens, não de reescrever o app.

**Diretriz 5.2.5** — como efeito colateral, o risco de "confusingly similar to
an existing Apple product" desapareceu por completo: o app não se parece mais
com nenhum produto da Apple.

---

## 1. Human Interface Guidelines

O que a reescrita **manteve**:

| Diretriz | Implementação | Onde |
|---|---|---|
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

O que **não** é mais atendido: System Colors, System Grays, os Text Styles do
iOS e os materiais translúcidos — ver § 0.

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

1. **Decidir o rumo visual.** Voltar à paleta Apple do § 0 ou assumir a identidade nova. Hoje o projeto está entre as duas coisas, e a documentação antiga prometia a primeira.
2. **Empacotar em nativo.** PWA não entra na App Store.
3. **Publicar a política de privacidade** e preencher os Privacy Nutrition Labels.
4. **Classificação etária** honesta no App Store Connect.
5. **Auditoria com VoiceOver ligado** num aparelho real.
