---
title: Mónadas
tags: [algebra, categorias, programacion]

---
Las [mónadas](https://ncatlab.org/nlab/show/monad) codifican representaciones sintácticas de estructura
algebraica. Además, han alcanzado un estatus casi de culto en parte de la
comunidad de teoría de lenguajes de programación por su capacidad de
codificar computación con estado en lenguajes puramente funcionales como
Haskell.

Notoriamente, una *mónada* sobre una categoría $C$ es un [monoide](/matematicas/categorias_monoidales.html) en la
categoría monoidal de endofuntores de $C$ — una buena forma de recordar
la definición, aunque suene circular al principio.

## Teoría general

Las mónadas aparecen en la mayoría de los libros de texto de teoría de
categorías:

- Borceux, 1994: *Handbook of Categorical Algebra*, Vol. 2, Cap. 4:
  Monads
- Awodey, 2010: *Category Theory*, 2ª ed., Cap. 10: Monads and algebras
- Riehl, 2016: *Category Theory in Context*, Cap. 5: Monads and their
  algebras
    * Lista particularmente útil de ejemplos de matemáticas y ciencias de
      la computación
- Jacobs, 2017: *Introduction to Coalgebra*, Cap. 5: Monads, comonads,
  and distributive laws ([doi](https://doi.org/10.1017/CBO9781316823187.006))

## Álgebra universal

Buena parte del interés matemático en las mónadas viene de su conexión con
el [álgebra universal](https://ncatlab.org/nlab/show/universal+algebra).

- Baez, 2006, notas de curso: *Universal algebra and diagrammatic
  reasoning* ([slides](https://math.ucr.edu/home/baez/universal/universal_hyper.pdf))
    * Enlaces a más material en el sitio complementario
- Voutas, 2012, notas expositivas: *The basic theory of monads and their
  connection to universal algebra* ([pdf](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.261.1433&rep=rep1&type=pdf))

En particular, las teorías de Lawvere y las mónadas finitarias son
equivalentes — un resultado que suele atribuirse a Linton.

- Hyland & Power, 2007: *The category theoretic understanding of
  universal algebra: Lawvere theories and monads* ([doi](https://doi.org/10.1016/j.entcs.2007.02.019))
    * Contrasta las dos formulaciones categóricas de álgebra universal:
      teorías de Lawvere versus mónadas
    * Behrisch, Kerkhoff, Power, 2012, ampliación con comonads y teorías
      duales ([doi](https://doi.org/10.1016/j.entcs.2012.08.002))
- Garner, 2014: *Lawvere theories, finitary monads and Cauchy-completion* ([doi](https://doi.org/10.1016/j.jpaa.2014.02.018), [arxiv](https://arxiv.org/abs/1307.2963))
    * Analiza la correspondencia mónada-teoría desde categorías enriquecidas
      en endofuntores finitarios
- Brandenburg, 2021: *Large limit sketches and topological space objects* ([arxiv](https://arxiv.org/abs/2106.11115))
    * El apéndice A trae una prueba autocontenida y accesible de la
      equivalencia entre teorías de Lawvere infinitarias y mónadas
    * También sirve como buen resumen de la literatura sobre el tema

## Mónadas especiales y aplicaciones

**Mónadas de probabilidad**: para la mónada de Giry y otras mónadas de
probabilidad, ver probabilidad categórica.

Página original, con bibliografía extendida, en el
[wiki de Evan Patterson](https://www.epatters.org/wiki/algebra/monads).
