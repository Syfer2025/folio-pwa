# Folio

PWA de leitura de livros com a vitrine no estilo do app Apple TV: herói em tela cheia,
prateleiras horizontais, aba de marca própria. Sistema visual da Apple aplicado ao pé da
letra — System Colors, Text Styles do iOS com tracking oficial, materiais translúcidos,
Dynamic Type e alvos de toque de 44 pt.

A conformidade com as diretrizes da Apple está detalhada em **[DIRETRIZES.md](DIRETRIZES.md)**,
incluindo o que a plataforma web não alcança e o que falta para uma submissão real.

## Arquivos

```
index.html               app inteiro — CSS, markup e JS num arquivo só
manifest.webmanifest     nome, ícones, atalhos, standalone, portrait
sw.js                    service worker: shell em cache, offline, fontes em cache à parte
icons/                   180/192/512 + maskable + SVG (gerados por código)
DIRETRIZES.md            mapeamento HIG + App Store Review Guidelines
```

## Rodar

O service worker exige HTTP — abrir com `file://` funciona para ver a interface, mas não
instala como PWA.

```bash
npx serve .
```

Depois abra `http://localhost:3000` no Safari do iPhone e use **Compartilhar › Adicionar à
Tela de Início**. O app abre em tela cheia, sem barra do Safari, com a barra de status
transparente sobre o conteúdo.

## Telas

- **Folio** — carrossel de destaques com avanço automático (desligado se Reduzir Movimento
  estiver ativo) e prateleiras horizontais: Continuar lendo com barra de progresso no pôster,
  Leia de graça, Últimos lançamentos, Coleções, recomendações, Com narração.
- **Folio+** — a aba de marca da assinatura, com o texto legal de renovação exigido pela 3.1.2(c). Compra avulsa fica na ficha do livro.
- **Buscar** — campo alto com Cancelar e grade de 3 pôsteres, filtrada ao vivo por título,
  autor ou gênero.
- **Biblioteca** — controle segmentado Lendo / Quero ler / Concluídos / Baixados.
- **Ficha do livro** — capa, ações, sinopse expansível, avaliações, sumário, direitos.
- **Leitor** — paginação horizontal, 4 temas, 5 fontes, corpo de 14 a 30 pt, modo imersivo.

Teclado: `←` `→` paginam, `Esc` fecha. Toque: laterais paginam, centro esconde os controles.

## Acervo

Trinta obras em **domínio público no Brasil** (Lei 9.610/98, art. 41) — Machado de Assis,
Graciliano Ramos, Lima Barreto, Aluísio Azevedo, Mário de Andrade, Eça de Queirós, Austen,
Kafka, Dostoiévski. Os trechos no leitor são texto real das obras. As capas são **geradas
por código** a partir de doze paletas e cinco layouts: nenhuma imagem externa, nenhuma
reprodução de capa comercial.

## O que é simulado

Compra, assinatura, download, narração e sincronia mostram o estado correto da interface e
disparam um toast — não há back-end. Substituir por StoreKit 2 na versão nativa. O progresso
de leitura vem de `STATE_SEED` e não persiste entre recargas.

## Fontes

`SF Pro` via `-apple-system` em aparelhos Apple. Fora deles, **Inter** (a substituta métrica
mais próxima), **Literata** no leitor no lugar da New York da Apple, e **Bodoni Moda** na arte
das capas. SF Pro e New York não são redistribuíveis.
