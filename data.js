/* ============================================================
   FOLIO — dados
   Acervo em domínio público (Lei 9.610/98, art. 41). Nenhum texto
   ou marca de terceiros protegido é usado. Ver DIRETRIZES.md § 5.2.
   ============================================================ */
"use strict";

/* Paletas das capas — arte editorial, independente da paleta de UI da Apple */
const PAL = [
  { g:["#1E2E4A","#080F1C"], ink:"#EFE7D5", acc:"#C9A227" },
  { g:["#7B2D26","#240808"], ink:"#F4E8D7", acc:"#E0A458" },
  { g:["#2C4034","#0C1712"], ink:"#EDE9DA", acc:"#B7C4A0" },
  { g:["#3A2A46","#120A1B"], ink:"#EDE4F2", acc:"#C9A6E0" },
  { g:["#8A6A2F","#2A1E0A"], ink:"#FBF3E0", acc:"#F0D08A" },
  { g:["#1A3B47","#06161C"], ink:"#E3EFF2", acc:"#6FB3C4" },
  { g:["#5B1F35","#1B0710"], ink:"#F6E3E9", acc:"#DE7C97" },
  { g:["#403A32","#141210"], ink:"#F0EBE1", acc:"#C4A484" },
  { g:["#0F2E28","#04120F"], ink:"#DFF0EA", acc:"#54B79A" },
  { g:["#4A2410","#170A04"], ink:"#F5E5D3", acc:"#D98E48" },
  { g:["#242A38","#0B0E14"], ink:"#E6E9F0", acc:"#8FA3C8" },
  { g:["#6B2E45","#200A14"], ink:"#F7E6EC", acc:"#E39CB4" }
];
const VARIANTS = ["rule","band","type","frame","arc"];

/* Aberturas autênticas (domínio público) usadas na amostra do leitor */
const OPEN = {
  casmurro: ["Uma noite destas, vindo da cidade para o Engenho Novo, encontrei num trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos."],
  brascubas: ["Algum tempo hesitei se devia abrir estas memórias pelo princípio ou pelo fim, isto é, se poria em primeiro lugar o meu nascimento ou a minha morte."],
  cortico: ["João Romão foi, dos treze aos vinte e cinco anos, empregado de um vendeiro que enriqueceu entre as quatro paredes de uma suja e obscura taverna nos refolhos do bairro do Botafogo."],
  vidassecas: ["Na planície avermelhada os juazeiros alargavam duas manchas verdes. Os infelizes tinham caminhado o dia inteiro, estavam cansados e famintos."],
  metamorfose: ["Certa manhã, ao despertar de sonhos intranquilos, Gregor Samsa encontrou-se em sua cama metamorfoseado num inseto monstruoso."],
  orgulho: ["É uma verdade universalmente reconhecida que um homem solteiro, em posse de boa fortuna, deve estar necessitado de uma esposa."],
  moby: ["Chamem-me Ishmael. Há alguns anos — não importa quantos ao certo — tendo pouco ou nenhum dinheiro na bolsa, e nada de particular que me interessasse em terra, pensei em navegar um pouco e ver a parte aquosa do mundo."],
  iracema: ["Verdes mares bravios de minha terra natal, onde canta a jandaia nas frondes da carnaúba."],
  macunaima: ["No fundo do mato-virgem nasceu Macunaíma, herói de nossa gente. Era preto retinto e filho do medo da noite."],
  alienista: ["As crônicas da vila de Itaguaí dizem que em tempos remotos vivera ali um certo médico, o Dr. Simão Bacamarte, filho da nobreza da terra e o maior dos médicos do Brasil, de Portugal e das Espanhas."],
  quaresma: ["O major Policarpo Quaresma, mais conhecido por Quaresma simplesmente, era funcionário público, subsecretário do Arsenal de Guerra."],
  sertoes: ["O planalto central do Brasil desce, nos litorais do sul, em escarpas inteiriças, altas e abruptas."],
  ateneu: ["Vais encontrar o mundo, disse-me meu pai, à porta do Ateneu. Coragem para a luta."],
  dorian: ["O ateliê estava impregnado do forte odor das rosas, e quando a leve brisa de verão agitava as árvores do jardim, entrava pela porta aberta o pesado perfume dos lilases."],
  frankenstein: ["Ficarás satisfeito ao saber que nenhum desastre acompanhou o início de um empreendimento que encaraste com tão maus presságios."],
  crime: ["No começo de julho, por um calor excessivo, ao cair da tarde, um jovem deixou o cubículo que sublocava na travessa S. e, lentamente, como indeciso, encaminhou-se para a ponte K."]
};

const BOOKS = [
  { id:"casmurro", t:"Dom Casmurro", a:"Machado de Assis", y:1899, pal:0, v:"rule", g:"Clássicos brasileiros", pages:208, mins:312, rate:4.8, plus:true, narr:true,
    d:"Bento Santiago decide reconstruir a casa da infância e, com ela, a memória de Capitu. O que sai é menos uma confissão do que um processo — em que o narrador acumula provas, escolhe testemunhas e nunca chama a defesa. A ambiguidade é o método, não o defeito.",
    open:OPEN.casmurro },
  { id:"brascubas", t:"Memórias Póstumas de Brás Cubas", a:"Machado de Assis", y:1881, pal:7, v:"type", g:"Clássicos brasileiros", pages:224, mins:334, rate:4.9, plus:true, narr:true,
    d:"Um defunto autor escreve da sepultura, sem pressa e sem obrigação de agradar. Cento e sessenta capítulos curtos, alguns de três linhas, para contar uma vida que não deu em nada — e para provar que isso é assunto suficiente.",
    open:OPEN.brascubas },
  { id:"quincas", t:"Quincas Borba", a:"Machado de Assis", y:1891, pal:2, v:"band", g:"Clássicos brasileiros", pages:200, mins:298, rate:4.6, plus:true,
    d:"Rubião herda uma fortuna, um cachorro e uma filosofia: o Humanitismo, que ensina que ao vencedor as batatas. A herança se gasta; a filosofia, não.",
    open:["Rubião fitava a enseada — eram oito horas da manhã. Quem o visse, com os polegares metidos no cordão do chambre, à janela de uma grande casa em Botafogo, cuidaria que ele admirava aquele pedaço de água quieta."] },
  { id:"alienista", t:"O Alienista", a:"Machado de Assis", y:1882, pal:6, v:"frame", g:"Clássicos brasileiros", pages:96, mins:142, rate:4.7, plus:true, narr:true,
    d:"Um médico funda a Casa Verde para estudar a loucura e acaba internando quase toda Itaguaí. Quando percebe que os sãos é que são exceção, inverte o critério — com a mesma serenidade científica.",
    open:OPEN.alienista },
  { id:"helena", t:"Helena", a:"Machado de Assis", y:1876, pal:11, v:"arc", g:"Romance", pages:176, mins:262, rate:4.2,
    d:"Um testamento apresenta à família Vale uma filha que ninguém conhecia. O romantismo ainda governa a superfície; por baixo já trabalha o ironista que Machado seria.",
    open:["O conselheiro Vale morreu às sete horas da noite de 25 de abril de 1859. Morreu de uma apoplexia fulminante, pouco depois de cochilar a sesta."] },
  { id:"cortico", t:"O Cortiço", a:"Aluísio Azevedo", y:1890, pal:9, v:"band", g:"Realismo", pages:256, mins:382, rate:4.5, plus:true, narr:true,
    d:"São Romão cresce como organismo: quartos que se multiplicam, gente que se aglomera, dinheiro que se acumula num só bolso. O protagonista não é João Romão — é o cortiço.",
    open:OPEN.cortico },
  { id:"pensao", t:"Casa de Pensão", a:"Aluísio Azevedo", y:1884, pal:8, v:"rule", g:"Realismo", pages:240, mins:358, rate:4.1,
    d:"Um estudante maranhense chega ao Rio e cai numa engrenagem de hospedagem, honra e chantagem. Inspirado num caso real que dividiu a imprensa da época.",
    open:["Amâncio de Vasconcelos era filho único de um pequeno negociante de São Luís do Maranhão."] },
  { id:"quaresma", t:"Triste Fim de Policarpo Quaresma", a:"Lima Barreto", y:1915, pal:4, v:"type", g:"Clássicos brasileiros", pages:192, mins:286, rate:4.6, plus:true,
    d:"Um patriota radical resolve levar o Brasil a sério: propõe o tupi como língua oficial, tenta a agricultura, adere à revolta. O país responde a cada gesto com o mesmo silêncio administrativo.",
    open:OPEN.quaresma },
  { id:"ateneu", t:"O Ateneu", a:"Raul Pompeia", y:1888, pal:3, v:"frame", g:"Clássicos brasileiros", pages:184, mins:274, rate:4.3, plus:true,
    d:"Crônica de saudades de um internato que funciona como miniatura do mundo adulto: hierarquia, espetáculo e crueldade, tudo com uniforme.",
    open:OPEN.ateneu },
  { id:"sargento", t:"Memórias de um Sargento de Milícias", a:"Manuel Antônio de Almeida", y:1854, pal:5, v:"arc", g:"Clássicos brasileiros", pages:168, mins:250, rate:4.2,
    d:"O Rio do tempo do rei visto de baixo, por um menino levado que atravessa a cidade sem nunca escolher um lado. Malandragem antes de existir a palavra.",
    open:["Era no tempo do rei. Uma das quatro esquinas que formam as ruas do Ouvidor e da Quitanda chamava-se nesse tempo o canto dos meirinhos."] },
  { id:"iracema", t:"Iracema", a:"José de Alencar", y:1865, pal:8, v:"arc", g:"Clássicos brasileiros", pages:128, mins:190, rate:4.1, narr:true,
    d:"Lenda do Ceará escrita como poema em prosa. Alencar inventa aqui um português de sintaxe indígena — o experimento formal é o coração do livro.",
    open:OPEN.iracema },
  { id:"guarani", t:"O Guarani", a:"José de Alencar", y:1857, pal:2, v:"band", g:"Romance", pages:320, mins:476, rate:4.0,
    d:"Fidalguia portuguesa, mata fechada e um herói indígena idealizado. O romance que fundou o imaginário nacional — e a ópera de Carlos Gomes.",
    open:["De um dos cabeços da serra dos Órgãos desliza um fio de água que se dirige para o norte, e engrossado com os mananciais que recebe no seu curso de dez léguas, torna-se rio caudal."] },
  { id:"senhora", t:"Senhora", a:"José de Alencar", y:1875, pal:11, v:"type", g:"Romance", pages:224, mins:334, rate:4.4,
    d:"Aurélia herda uma fortuna e compra o noivo que a rejeitou por dinheiro. Um romance sobre preço, contrato e a impossibilidade de quitar uma humilhação.",
    open:["Há anos raiou no céu fluminense uma nova estrela. Desde o momento de sua ascensão ninguém lhe disputou o cetro."] },
  { id:"vidassecas", t:"Vidas Secas", a:"Graciliano Ramos", y:1938, pal:10, v:"rule", g:"Modernismo", pages:176, mins:262, rate:4.9, plus:true, narr:true,
    d:"Treze capítulos que podem ser lidos em qualquer ordem, porque a seca também não tem começo. Fabiano mal encontra palavras; a cadela Baleia é quem pensa com mais clareza.",
    open:OPEN.vidassecas },
  { id:"saobernardo", t:"São Bernardo", a:"Graciliano Ramos", y:1934, pal:7, v:"type", g:"Modernismo", pages:192, mins:286, rate:4.7, plus:true,
    d:"Paulo Honório narra como tomou a fazenda, a mulher e a própria linguagem. A prosa é seca porque o narrador é seco — e descobre tarde demais o que isso custou.",
    open:["Antes de iniciar este livro, imaginei construí-lo pela divisão do trabalho."] },
  { id:"macunaima", t:"Macunaíma", a:"Mário de Andrade", y:1928, pal:9, v:"band", g:"Modernismo", pages:208, mins:310, rate:4.4, plus:true,
    d:"Rapsódia feita de lendas de todo o país costuradas sem hierarquia. O herói sem nenhum caráter atravessa o Brasil como quem troca de mito.",
    open:OPEN.macunaima },
  { id:"sertoes", t:"Os Sertões", a:"Euclides da Cunha", y:1902, pal:10, v:"frame", g:"História", pages:512, mins:764, rate:4.6, plus:true,
    d:"A terra, o homem, a luta. Reportagem, geologia e tragédia sobre Canudos, escrita por quem foi ver e voltou com a tese destruída.",
    open:OPEN.sertoes },
  { id:"espumas", t:"Espumas Flutuantes", a:"Castro Alves", y:1870, pal:5, v:"arc", g:"Poesia", pages:112, mins:96, rate:4.3, narr:true,
    d:"O único livro que Castro Alves publicou em vida. Amor, mar e liberdade em versos feitos para serem ditos em voz alta.",
    open:["Ela é o pássaro noturno / Que voa na escuridão."] },
  { id:"moreninha", t:"A Moreninha", a:"Joaquim Manuel de Macedo", y:1844, pal:6, v:"arc", g:"Romance", pages:144, mins:214, rate:3.9,
    d:"Uma aposta entre estudantes, uma ilha e um segredo de infância. O primeiro best-seller brasileiro, e ainda o mais leve deles.",
    open:["Era uma sexta-feira. Augusto, Fabrício, Leopoldo e Filipe achavam-se reunidos no gabinete de estudo do primeiro."] },
  { id:"taverna", t:"Noite na Taverna", a:"Álvares de Azevedo", y:1855, pal:3, v:"frame", g:"Terror gótico", pages:120, mins:178, rate:4.2, plus:true,
    d:"Cinco homens bebem e contam, cada um, a pior coisa que já fizeram. Byron traduzido para a boemia paulistana do século XIX.",
    open:["Silêncio, moços! Acabai com essa algazarra de embriaguez. Não vedes que também eu quero contar-vos uma história?"] },
  { id:"primobasilio", t:"O Primo Basílio", a:"Eça de Queirós", y:1878, pal:11, v:"band", g:"Realismo", pages:352, mins:524, rate:4.4,
    d:"Luísa lê romances demais e vive de menos. Quando o primo volta de longe, o adultério entra em casa com a naturalidade de uma visita marcada.",
    open:["Tinham dado onze horas no cuco da sala de jantar. Jorge fechou o livro de Luís de Camões e espreguiçou-se."] },
  { id:"maias", t:"Os Maias", a:"Eça de Queirós", y:1888, pal:0, v:"type", g:"Realismo", pages:704, mins:1048, rate:4.7, plus:true,
    d:"Três gerações de uma família e o retrato de uma Lisboa que conversa muito e decide pouco. O grande romance português do século XIX.",
    open:["A casa que os Maias vieram habitar em Lisboa, no outono de 1875, era conhecida na vizinhança da rua de São Francisco de Paula, pela casa do Ramalhete."] },
  { id:"metamorfose", t:"A Metamorfose", a:"Franz Kafka", y:1915, pal:8, v:"type", g:"Ficção", pages:96, mins:142, rate:4.6, plus:true, narr:true,
    d:"O caixeiro-viajante acorda inseto e a primeira preocupação da casa é o emprego dele. O absurdo não está na transformação, está na reação de todos a ela.",
    open:OPEN.metamorfose },
  { id:"crime", t:"Crime e Castigo", a:"Fiódor Dostoiévski", y:1866, pal:1, v:"rule", g:"Ficção", pages:576, mins:858, rate:4.8, plus:true, narr:true,
    d:"Raskólnikov testa uma teoria sobre homens extraordinários usando um machado. O romance policial em que o criminoso é conhecido na página trinta e o suspense é moral.",
    open:OPEN.crime },
  { id:"orgulho", t:"Orgulho e Preconceito", a:"Jane Austen", y:1813, pal:2, v:"frame", g:"Romance", pages:384, mins:572, rate:4.7, plus:true, narr:true,
    d:"Cinco irmãs, uma herança que só passa a homens e um vizinho novo com renda anual conhecida. Austen usa o casamento como sistema econômico e a ironia como bisturi.",
    open:OPEN.orgulho },
  { id:"moby", t:"Moby Dick", a:"Herman Melville", y:1851, pal:5, v:"band", g:"Ficção", pages:640, mins:952, rate:4.3,
    d:"Uma caçada, um capitão e uma enciclopédia de baleias no meio do caminho. As digressões não atrapalham o livro — elas são o livro.",
    open:OPEN.moby },
  { id:"dorian", t:"O Retrato de Dorian Gray", a:"Oscar Wilde", y:1890, pal:3, v:"arc", g:"Terror gótico", pages:272, mins:404, rate:4.5, plus:true,
    d:"Um retrato envelhece no sótão enquanto o modelo permanece intacto. Wilde escreveu um conto moral e passou o resto da vida negando que fosse um.",
    open:OPEN.dorian },
  { id:"frankenstein", t:"Frankenstein", a:"Mary Shelley", y:1818, pal:6, v:"frame", g:"Terror gótico", pages:280, mins:416, rate:4.4, plus:true, narr:true,
    d:"Escrito aos dezoito anos, num verão sem sol. A criatura aprende a ler, argumenta melhor que o criador e pede apenas uma coisa — que lhe é negada.",
    open:OPEN.frankenstein },
  { id:"dalloway", t:"Mrs. Dalloway", a:"Virginia Woolf", y:1925, pal:4, v:"type", g:"Modernismo", pages:208, mins:310, rate:4.3, plus:true,
    d:"Um dia em Londres, uma festa à noite e a consciência de várias pessoas atravessada pelo mesmo som de sino. O tempo do relógio contra o tempo da mente.",
    open:["A sra. Dalloway disse que ela mesma iria comprar as flores."] },
  { id:"comedia", t:"A Divina Comédia", a:"Dante Alighieri", y:1320, pal:1, v:"frame", g:"Poesia", pages:592, mins:880, rate:4.6,
    d:"Cem cantos em terça rima, do fundo do Inferno ao Empíreo. A arquitetura mais rigorosa já construída em verso.",
    open:["No meio do caminho desta vida / me vi perdido numa selva escura, / solitário, sem sol e sem saída."] }
];

/* Estado de leitura do usuário */
const STATE_SEED = {
  casmurro:   { prog:.34, ch:"Capítulo IX — A ópera", left:206, shelf:"lendo",  off:true  },
  vidassecas: { prog:.72, ch:"Cadeia",                left:73,  shelf:"lendo",  off:true  },
  brascubas:  { prog:.12, ch:"Capítulo VII — O delírio", left:294, shelf:"lendo", off:false },
  sertoes:    { prog:.05, ch:"A terra",               left:726, shelf:"lendo",  off:false },
  metamorfose:{ prog:1,   ch:"Concluído",             left:0,   shelf:"fim",    off:false },
  alienista:  { prog:1,   ch:"Concluído",             left:0,   shelf:"fim",    off:true  },
  orgulho:    { prog:1,   ch:"Concluído",             left:0,   shelf:"fim",    off:false },
  cortico:    { prog:0,   ch:"",                      left:382, shelf:"quero",  off:false },
  saobernardo:{ prog:0,   ch:"",                      left:286, shelf:"quero",  off:true  },
  maias:      { prog:0,   ch:"",                      left:1048,shelf:"quero",  off:false },
  dorian:     { prog:0,   ch:"",                      left:404, shelf:"quero",  off:false },
  crime:      { prog:0,   ch:"",                      left:858, shelf:"quero",  off:false },
  quaresma:   { prog:0,   ch:"",                      left:286, shelf:"quero",  off:true  }
};

/* Coleções curadas (arte 16:9) */
const COLLECTIONS = [
  { id:"machado", n:"Machado, do começo ao fim", c:"9 livros", pal:0, ids:["brascubas","casmurro","quincas","alienista","helena"] },
  { id:"seca",    n:"O Nordeste em prosa",       c:"7 livros", pal:10, ids:["vidassecas","sertoes","saobernardo","quaresma"] },
  { id:"gotico",  n:"Noites góticas",            c:"6 livros", pal:3, ids:["taverna","frankenstein","dorian","metamorfose"] },
  { id:"mod22",   n:"Semana de 22 e depois",     c:"8 livros", pal:9, ids:["macunaima","vidassecas","saobernardo","dalloway"] },
  { id:"romance", n:"Romance do século XIX",     c:"11 livros",c2:true, pal:11, ids:["senhora","orgulho","primobasilio","moreninha","maias"] },
  { id:"escola",  n:"Leituras do vestibular",    c:"12 livros", pal:6, ids:["casmurro","iracema","cortico","macunaima","quaresma","vidassecas"] }
];

const CATEGORIES = [
  { n:"Clássicos brasileiros", pal:0 }, { n:"Realismo", pal:9 },
  { n:"Modernismo", pal:10 },           { n:"Poesia", pal:5 },
  { n:"Terror gótico", pal:3 },         { n:"Romance", pal:11 },
  { n:"História", pal:1 },              { n:"Ficção", pal:6 }
];

/* Sumário e texto do título em destaque (Machado de Assis, 1899 — domínio público) */
const CHAPTERS = {
  casmurro: [
    { n:"I", t:"Do título", read:1, p:[
      "Uma noite destas, vindo da cidade para o Engenho Novo, encontrei num trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.",
      "— Continue, disse eu acordando.",
      "— Já acabei, murmurou ele.",
      "— São muito bonitos.",
      "Vi-lhe fazer um gesto para tirá-los outra vez do bolso, mas não passou do gesto; estava amuado. No dia seguinte entrou a dizer de mim nomes feios, e acabou alcunhando-me Dom Casmurro. Os vizinhos, que não gostam dos meus hábitos reclusos e calados, deram curso à alcunha, que afinal pegou. Nem por isso me zanguei. Contei a anedota aos amigos da cidade, e eles, por graça, chamam-me assim, alguns em bilhetes.",
      "Não consultes dicionários. Casmurro não está aqui no sentido que eles lhe dão, mas no que lhe pôs o vulgo de homem calado e metido consigo. Dom veio por ironia, para atribuir-me fumos de fidalgo. Tudo por estar cochilando! Também não achei melhor título para a minha narração; se não tiver outro daqui até ao fim do livro, vai este mesmo."
    ]},
    { n:"II", t:"Do livro", read:1, p:[
      "Agora que expliquei o título, passo a escrever o livro. Antes disso, porém, digamos os motivos que me põem a pena na mão.",
      "Vivo só, com um criado. A casa em que moro é própria; fi-la construir de propósito, levado de um desejo tão particular que me vexa imprimi-lo, mas vá lá. Um dia, há bastantes anos, lembrou-me reproduzir no Engenho Novo a casa em que me criei na antiga Rua de Matacavalos, tendo o mesmo aspecto e economia daquela outra, que desapareceu.",
      "Construtor e pintor entenderam bem as indicações que lhes fiz: é o mesmo prédio assobradado, três janelas de frente, varanda ao fundo, as mesmas alcovas e salas. Na principal destas, a pintura do teto e das paredes é mais ou menos igual, umas grinaldas de flores miúdas e grandes pássaros que as tomam nos bicos, de espaço a espaço.",
      "O meu fim evidente era atar as duas pontas da vida, e restaurar na velhice a adolescência. Pois, senhor, não consegui recompor o que foi nem o que fui. Em tudo, se o rosto é igual, a fisionomia é diferente."
    ]},
    { n:"III", t:"A denúncia", read:1, p:[
      "Ia a entrar na sala de visitas, quando ouvi proferir o meu nome e escondi-me atrás da porta. A casa era a da Rua de Matacavalos, o mês novembro, o ano é que é um pouco remoto, mas eu não hei de trocar as datas à minha vida só para agradar às pessoas que não amam histórias velhas.",
      "— Mas, senhor José Dias, insistia minha mãe.",
      "— Perdão, minha senhora; repito o que disse. As últimas palavras que Escobar me trouxe são graves. É preciso que o menino entre quanto antes para o seminário."
    ]},
    { n:"IV", t:"Um dever amaríssimo!", read:1 },
    { n:"V", t:"O agregado", read:0 },
    { n:"VI", t:"Tio Cosme", read:0 },
    { n:"VII", t:"Dona Glória", read:0 },
    { n:"VIII", t:"É tempo", read:0 },
    { n:"IX", t:"A ópera", read:0, cur:1 },
    { n:"X", t:"Aceito a teoria", read:0 },
    { n:"XI", t:"A promessa", read:0 },
    { n:"XII", t:"Na varanda", read:0 },
    { n:"XIII", t:"Capitu", read:0 },
    { n:"XIV", t:"A inscrição", read:0 },
    { n:"XV", t:"Outra voz repentina", read:0 }
  ]
};

