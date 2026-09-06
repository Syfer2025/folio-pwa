# Conteúdo inicial para testar o Folio

Estes quatro textos integrais servem para validar leitor, capítulos, progresso,
busca, sessões e funcionamento offline. O acervo comercial será definido pelo
responsável pelo projeto. Importação realizada em 6 de setembro de 2026.

Todos são obras originais em português de Machado de Assis (1839–1908), em
domínio público no Brasil conforme o art. 41 da Lei 9.610/98. Não há traduções.
A fonte é identificada por edição; os arquivos JSON também guardam o SHA-256 do
HTML consultado. A transcrição foi convertida para texto simples, com espaços
normalizados, sem modernização da grafia. Não houve revisão editorial integral
do Folio nem confronto página a página com os fac-símiles.

| Arquivo | Obra / edição da fonte | Estrutura | Palavras | Estimativa |
|---|---|---|---:|---:|
| `casmurro.json` | Dom Casmurro, B. L. Garnier, 1899 | 148 capítulos | 64.628 | 324 min |
| `alienista.json` | O Alienista, em Papéis Avulsos, Lombaerts & C., 1882 | 13 capítulos | 16.534 | 83 min |
| `cartomante.json` | A Cartomante, em Várias Histórias, Laemmert & C., 1896, pp. 9–29 | 1 conto | 3.079 | 16 min |
| `brascubas.json` | Memórias Póstumas de Brás Cubas, Typographia Nacional, 1881 | Ao leitor / dedicatória + 160 capítulos | 60.246 | 302 min |

As estimativas usam 200 palavras por minuto, arredondadas para cima. São
estimativas de leitura, não duração de audiolivros. As sessões do catálogo
informam o índice real do capítulo, palavras e estimativa. O conto A Cartomante
tem 16 minutos nessa base; não deve ser anunciado como leitura de 15 minutos.

## Conversão e verificação

- Preservados os parágrafos narrativos, dedicatória e trechos pontilhados de
  Brás Cubas. Parágrafos com apenas pontuação não são conteúdo vazio.
- Removida a apresentação do repositório, imagens, catálogos publicitários e
  índices duplicados. O Alienista é a narrativa completa, extraída da coletânea.
- Títulos e limites dos capítulos foram verificados; a grafia inconsistente
  `CAPIULO CXXIV` da fonte foi reconhecida como capítulo 124 durante a conversão.
- Validados primeiro e último parágrafo, contagem de capítulos, JSON válido,
  parágrafos não vazios e ausência do caractere de erro de codificação U+FFFD.
- Preservar quebras de linha na apresentação (`white-space: pre-line`) ajuda a
  manter dedicatórias e passagens de composição tipográfica.

O texto de A Cartomante usa a revisão 518402 da Wikisource. Atribuição:
Machado de Assis e colaboradores da Wikisource; conversão de formato, remoção
de hifens condicionais e normalização de espaços pelo Folio. A transcrição é
disponibilizada sob [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Essa condição se refere à transcrição distribuída; não muda a condição de domínio
público do texto original nem determina a licença do código do aplicativo.

## Referências e agradecimentos

- [Dom Casmurro — Project Gutenberg, nº 55752](https://www.gutenberg.org/ebooks/55752)
- [Papéis Avulsos — Project Gutenberg, nº 57001](https://www.gutenberg.org/ebooks/57001)
- [Memórias Póstumas de Brás Cubas — Project Gutenberg, nº 54829](https://www.gutenberg.org/ebooks/54829)
- [A Cartomante — Wikisource, revisão 518402](https://pt.wikisource.org/w/index.php?title=A_Cartomante&oldid=518402)
- [Lei 9.610/98, arts. 14 e 41](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)
- [Política de uso e referências do Project Gutenberg](https://www.gutenberg.org/policy/license.html)

Créditos de transcrição de Papéis Avulsos: Laura Natal Rodrigues e Marc
D'Hooghe; imagens de referência cedidas ao repositório pela Biblioteca Brasiliana
Guita e José Mindlin. Créditos de Brás Cubas: Laura Natal Rodriguez e Marc
D'Hooghe. Os nomes dos repositórios aparecem aqui como referências de
proveniência; não são marca, selo de qualidade, parceria ou patrocínio do Folio.
