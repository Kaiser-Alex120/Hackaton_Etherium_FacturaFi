# 🧾 FacturaFi — Anexo teórico y de cálculo
### Fórmulas y modelos matemáticos complementarios

**Hoja de referencia para acompañar el documento principal de producto**

---

## 1. Liberación de efectivo por tramos

En vez de liberar el adelanto en un solo pago (100% menos retención fija), se puede diseñar como una **liberación fraccionada**, donde el monto se entrega en porciones sucesivas, cada una condicionada a un evento verificable.

### 1.1 Formulación general

```
Monto_liberado_total = Σ (i=1 hasta n) [ tramo_i × condición_i ]
```

Donde:
- `tramo_i` es el porcentaje del adelanto asignado a la etapa *i*.
- `condición_i` es una variable binaria (0 o 1) que indica si el evento que habilita ese tramo ya ocurrió.
- `Σ tramo_i = 100%` del monto total a liberar.

### 1.2 Ejemplo de esquema en 3 tramos iguales (33/33/33)

| Tramo | % liberado | Evento que lo habilita |
|---|---|---|
| 1 | 33% | Aceptación de la factura confirmada (dentro de la ventana de 8 días hábiles de la Ley N° 29623) |
| 2 | 33% | Verificación intermedia (ej. transcurre la mitad del plazo sin señales de disputa) |
| 3 | 34% | Confirmación final antes del vencimiento, o liberación total al momento del pago del deudor |

### 1.3 Ejemplo de esquema en 4 tramos iguales (25% cada uno)

Útil cuando se quiere una liberación más gradual, por ejemplo ligada a hitos mensuales de una factura con plazo largo (ej. 4 meses):

```
tramo_1 = 25%  → al aceptar la factura
tramo_2 = 25%  → al mes 1 sin incidentes
tramo_3 = 25%  → al mes 2 sin incidentes
tramo_4 = 25%  → al mes 3 / confirmación de pago cercano al vencimiento
```

### 1.4 Por qué conviene este esquema frente a la liberación única

- **Reduce la exposición máxima del pool en un momento dado**: si algo falla a mitad de camino, el protocolo no ha liberado el 100% del monto, sino solo lo correspondiente a los tramos ya cumplidos.
- **Da una palanca de control adicional**, más allá del score: el protocolo puede detener tramos futuros sin necesidad de ejecutar un default completo si aparecen señales de riesgo a mitad de la operación.
- **Es matemáticamente compatible con el score dinámico** (sección 2): el tamaño de cada tramo puede ajustarse según el score vigente en el momento de la liberación, no solo al inicio de la operación.

### 1.5 Variante ligada al score (tramos no fijos)

En vez de tramos fijos (33/33/33 o 25/25/25/25), el tamaño de cada tramo puede ser una función del score en el momento de evaluarlo:

```
tramo_i = tramo_base_i × f(score_actual)
```

Donde `f(score_actual)` es un multiplicador entre 0 y 1 que reduce el tramo si el score ha bajado desde el inicio de la operación (ver sección 2 para la escala completa de score).

---

## 2. Score crediticio on-chain de alta granularidad

El diseño inicial usaba una escala simple de 0 a 10. Para un sistema de pricing y liberación de efectivo más preciso, conviene ampliar la escala a un rango de mayor resolución.

### 2.1 Escala propuesta

```
score ∈ [0, 1 000 000]
```

Una escala amplia (en vez de 0-10) permite ajustes finos en el pricing y en la liberación de efectivo sin saltos bruscos entre niveles — el sistema puede mover el score en incrementos pequeños según el comportamiento exacto (por ejemplo, un atraso de 3 días no debería penalizar igual que un atraso de 25 días, algo que una escala de 0 a 10 no distingue bien).

### 2.2 Inicialización

```
score_inicial = 500 000   (punto medio de la escala, neutral)
```

Alternativa: iniciar en el máximo (1 000 000) para reflejar "confianza inicial total", tal como se planteó originalmente, y dejar que el score solo descienda con el uso — cualquiera de las dos convenciones es válida, lo importante es documentar cuál se usa.

### 2.3 Función de ajuste por comportamiento de pago

```
score_nuevo = score_actual + Δscore
```

Donde `Δscore` depende de la puntualidad:

| Comportamiento | Δscore (aproximado) |
|---|---|
| Pago puntual, dentro del plazo | + 5% del score actual |
| Atraso leve (hasta 30 días) | − 15% del score actual |
| Atraso moderado (31-90 días) | − 40% del score actual |
| Atraso severo (más de 90 días, hasta 1 año) | − 80% del score actual |
| Default total (más de 1 año sin pago) | score → mínimo de la escala (0 o valor residual bajo) |

Estos porcentajes son ajustables; lo importante es que la penalización crezca de forma no lineal con la gravedad del atraso, para que el sistema castigue con más fuerza los incumplimientos largos que los cortos.

### 2.4 Función que traduce score en % de efectivo liberado

```
%_liberado = %_min + (%_max − %_min) × (score_actual / score_máximo)
```

Ejemplo con `%_min = 50%`, `%_max = 95%`, `score_máximo = 1 000 000`:

- Score = 1 000 000 (máximo) → %_liberado = 95%
- Score = 500 000 (medio) → %_liberado = 72.5%
- Score = 100 000 (bajo) → %_liberado = 54.5%

Esta fórmula es la que permite "jugar con el score crediticio": un usuario nuevo o con score bajo no queda excluido del sistema, pero recibe una porción menor por adelantado hasta demostrar comportamiento confiable, y accede gradualmente a porcentajes más altos.

### 2.5 Función que traduce score en prima de riesgo (pricing)

```
prima_riesgo(score) = prima_base × (1 − score_actual / score_máximo) × factor_ajuste
```

A mayor score, la prima de riesgo tiende a 0 (se acerca solo a la tasa base); a menor score, la prima crece, encareciendo el financiamiento — coherente con la fórmula de pricing general ya definida en el documento principal.

---

## 3. Garantía distribuida — múltiples wallets / founders anónimos

Para PYMEs con más de un fundador, o en escenarios donde se prefiere mantener anonimato individual, el modelo de colateral puede extenderse a una **garantía repartida entre varias wallets**, en vez de depender de una sola identidad.

### 3.1 Formulación general

```
Garantía_total = Σ (i=1 hasta N) aporte_i
```

Donde:
- `N` es el número de wallets/founders que respaldan la operación.
- `aporte_i` es la porción de responsabilidad (en score, en retención, o en ambos) que asume cada wallet.

### 3.2 Reparto proporcional simple (caso base)

Si los N founders participan en partes iguales:

```
aporte_i = Garantía_total / N
```

Ejemplo con 3 founders y una operación de S/10,000: cada wallet queda asociada a S/3,333 de responsabilidad dentro del sistema de score y retención.

### 3.3 Reparto ponderado (caso más realista)

Si los founders no participan en partes iguales (por ejemplo, según su porcentaje de participación en la empresa):

```
aporte_i = Garantía_total × peso_i,      donde Σ peso_i = 1
```

### 3.4 Efecto sobre el score en caso de impago

Cuando la operación entra en atraso o default, la penalización de score (sección 2.3) puede aplicarse:

- **De forma solidaria**: todas las wallets asociadas reciben la misma penalización completa, incentivando que los founders se supervisen entre sí.
- **De forma proporcional**: cada wallet recibe la penalización multiplicada por su `peso_i`, distribuyendo el impacto según responsabilidad declarada.

### 3.5 Por qué esto es útil para el caso anónimo

En un esquema donde la PYME no revela identidad completa (solo wallets), este modelo permite construir confianza sin necesidad de KYC tradicional: la garantía no depende de "quién es" la persona, sino de cuántas wallets están dispuestas a comprometer su propio historial on-chain como respaldo de esa operación específica. Cuantas más wallets participan y más historial propio aportan, menor es la prima de riesgo de la operación conjunta.

---

## 4. Consolidación — fórmula integrada

Uniendo las tres piezas de este anexo con el pricing general del documento principal, la fórmula completa de una operación queda:

```
%_liberado_tramo_i = tramo_base_i × f(score_ponderado_del_grupo)

score_ponderado_del_grupo = Σ (score_i × peso_i),  i = 1 hasta N wallets garantes

tasa_final = tasa_base + (factor_plazo × días/365)
             + prima_riesgo(score_ponderado_del_grupo)
             + ajuste_por_utilización(pool)
```

Esta es la versión más completa del modelo: combina liberación fraccionada, score de alta granularidad, y garantía distribuida entre múltiples wallets, todo dentro de la misma lógica de pricing dinámico ya establecida (inspirada en AAVE) del documento principal.
