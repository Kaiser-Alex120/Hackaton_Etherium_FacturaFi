# 🧾 FacturaFi
### Factoring de facturas on-chain para PYMEs peruanas

**Documento de producto — versión extendida para equipo, mentores y desarrollo asistido por IA**

---

## 0. Resumen ejecutivo

FacturaFi es un protocolo que permite a PYMEs peruanas convertir sus facturas por cobrar en liquidez inmediata, sin pasar por bancos ni depender de colateral tradicional. La factura se tokeniza on-chain como un activo único, inmutable y trazable; un pool de prestamistas en stablecoins la financia con un descuento calculado según el riesgo; y cuando el deudor original paga, el smart contract reparte automáticamente el retorno. El sistema incorpora un score de reputación dinámico, un modelo de colateral en capas, y una arquitectura pensada para poder documentarse y construirse de forma ordenada dentro del tiempo de una hackathon.

Este documento consolida: el problema y su marco legal, la mecánica completa del producto, la arquitectura técnica, el modelo de negocio, el feedback recibido de mentoría, y una guía específica de qué debe construir (o no construir) cada asistente de IA que participe en el desarrollo.

---

## 1. El problema

En Perú, el **factoring de facturas** (adelantar el cobro de una factura pendiente a cambio de un descuento) es un mercado grande y regulado, pero está dominado por bancos y empresas de factoring que:

- Cobran tasas altas.
- Solo atienden empresas grandes con historial crediticio robusto.
- Dejan fuera a las **PYMEs**, que son la mayoría de la economía peruana y no tienen colateral bancario tradicional.

**Resultado:** negocios con flujo de caja sano en el papel (facturas por cobrar) se quedan sin liquidez para operar, mientras esperan 30, 60 o 90 días a que les paguen.

### Por qué el público objetivo (PYME, no startup) es la elección correcta

Una PYME ya está asentada — tiene clientes recurrentes, flujo de caja predecible y busca capital para seguir creciendo. Es un perfil de riesgo distinto y más bajo que un emprendimiento nuevo sin historial. Este enfoque también fue validado en la sesión de mentoría: tener un público muy definido (ni una startup en etapa temprana, ni una empresa grande) simplifica el diseño del riesgo y hace el pitch más creíble.

### Por qué el proyecto se queda enfocado en Perú (y no se generaliza a LatAm)

El argumento legal más fuerte del proyecto depende del marco normativo peruano específico (ver sección 2). Generalizar el pitch a "toda LatAm" sin haber verificado que cada país tiene una figura legal equivalente sería una afirmación débil frente a un jurado técnico — cada país regula el factoring de forma distinta. La expansión regional es una idea válida, pero se ubica como visión de roadmap, no como parte del producto ni del pitch actual.

---

## 2. Marco legal: la Ley N° 29623

Es la **Ley que promueve el financiamiento a través de la factura comercial**, creada en Perú en diciembre de 2010, pensada como medio de obtener financiamiento y liquidez para las MYPEs a través de la factura comercial y los recibos por honorarios.

### La pieza central: la "Factura Negociable"

No es la factura común. Es una tercera copia especial de la factura que se convierte en un **título valor**, que nace de la venta de bienes o prestación de servicios e incorpora el derecho de cobro del saldo pendiente. Es obligatorio que toda factura comercial y recibo por honorarios incluya esta tercera copia.

### Requisitos formales que debe tener

Además de lo que ya exige SUNAT: la denominación "Factura Negociable", firma y domicilio de quien la emite, domicilio de quien debe pagarla, la fecha de vencimiento, y el monto neto pendiente de pago.

### El mecanismo de aceptación (clave para el modelo de riesgo de FacturaFi)

Desde que el comprador (deudor) recibe la factura, tiene un máximo de **8 días hábiles** para aceptarla, rechazarla, o reclamar por los bienes o servicios recibidos. Si no dice nada en ese plazo, se presume aceptada de forma **irrevocable**. Esto le da a FacturaFi una ventana corta y clara para validar que una factura es legítima y fue aceptada antes de tokenizarla y financiarla — reduce el riesgo de financiar una factura que el deudor pueda desconocer después.

### Es transferible — la base legal del factoring mismo

La Factura Negociable es un título valor transferible por endoso, o un valor representado y transferible mediante anotación en cuenta en una Institución de Compensación y Liquidación de Valores. Esto es lo que permite que una PYME "ceda" su factura a un tercero (en este caso, al pool de FacturaFi) a cambio de liquidez inmediata. Además, cualquier acuerdo que intente restringir o prohibir esa transferencia es **nulo de pleno derecho** — ni el deudor puede bloquear que la PYME use su factura para financiarse.

### Protección legal si el deudor actúa de mala fe

Si el comprador impugna dolosamente o retiene indebidamente la Factura Negociable, debe pagar el saldo pendiente **más una indemnización** equivalente a ese saldo más el interés máximo convencional, calculado desde el vencimiento hasta que pague. Esto refuerza la Capa 1 del modelo de colateral (sección 7): hay una penalidad legal explícita contra el deudor que actúa de mala fe, no solo la obligación simple de pago.

### Vencimiento

Puede vencer a fecha fija, "a la vista" (el día que se presenta al comprador), o a cierto plazo desde su aceptación o emisión. Si no se especifica fecha de vencimiento, se asume automáticamente a los 30 días.

---

## 3. La solución, en una idea

Un protocolo donde:

1. Una PYME sube una factura por cobrar (monto, plazo, deudor).
2. La factura se **tokeniza** — se convierte en un activo on-chain único, inmutable y trazable, que representa el derecho de cobro.
3. Un **pool de prestamistas** en stablecoins la financia al instante.
4. El **precio del adelanto** se calcula con un modelo de riesgo (plazo, monto, historial del pagador, score de la PYME, utilización del pool).
5. Cuando el deudor paga, el smart contract **reparte automáticamente** capital + interés a los prestamistas.

Sin banco. Sin semanas de trámite. Sin excluir a la PYME chica por no tener historial bancario.

**El diferenciador central:** la tokenización de la factura como activo inmutable y trazable no es solo un detalle técnico — es lo que convierte una simple solicitud de préstamo en un activo respaldado por un derecho de cobro real y verificable on-chain. En la sesión de mentoría se señaló específicamente que este enfoque —poner la factura en el centro del diseño como token— es algo poco visto en proyectos similares de hackathon.

---

## 4. Los actores

| Actor | Rol en el sistema |
|---|---|
| **PYME** | Se registra, sube la factura, recibe el adelanto de liquidez |
| **Deudor / pagador** | La empresa que en la fecha pactada paga la factura original |
| **Prestamistas / pool** | Depositan stablecoins esperando un retorno |
| **Smart contract** | Automatiza pricing, custodia de fondos, score y reparto — reemplaza al banco/factoring company |

---

## 5. El flujo completo, en 4 etapas

### Etapa 1 — Registro del usuario

La PYME completa un formulario de registro. Se capturan sus datos básicos. Los datos personales no necesitan vivir en la blockchain; lo que sí debe ser on-chain es la referencia (por ejemplo, un hash o identificador) que conecta al usuario con sus operaciones futuras.

### Etapa 2 — Registro de factura y tokenización

El usuario registrado sube su factura al sistema. Aquí se genera el **token**: un activo único, inmutable y trazable que representa "el derecho a cobrar X monto en Y plazo". Este token no se puede modificar una vez emitido — es la garantía de integridad del sistema.

**Manejo de cambios en el tiempo (versionado de tokens):** si pasa mucho tiempo entre la emisión del token y el vencimiento (contextos con alta inflación o variación cambiaria), el token original no se edita — se emite un **token actualizado que reemplaza al anterior**, preservando trazabilidad de versiones (token v1 → v2, con referencia cruzada entre ambos).

### Etapa 3 — El Smart Contract (SC)

Tanto el formulario de registro como el token de la factura terminan en el smart contract, que trackea los parámetros clave de cada operación:

| Campo en el SC | Qué mide |
|---|---|
| `score` | Historial crediticio dinámico de la PYME dentro del protocolo |
| `cant_$` | Monto solicitado |
| `tiempo_devol` | Plazo de devolución pactado |
| `%_extra` | Interés/descuento aplicado sobre el monto |

Este es el núcleo del pricing: el smart contract no solo ejecuta transacciones, es una lista de condiciones que deben cumplirse para que el financiamiento se apruebe, se transfiera y se repague.

### Etapa 4 — Condiciones de devolución y capas de protección

Se definen las reglas de repago (sección 6) y qué pasa si algo falla (sección 7).

---

## 6. Condiciones de devolución

Parámetros base, ajustables por el equipo antes de programar el contrato:

- **Cuota**: aproximadamente 20% del monto cada mes.
- **Límite**: 6 meses para devolución completa.
- **Verificación de pago**: contra comprobantes o facturas adicionales que confirmen el ingreso real de fondos.

---

## 7. Sistema de score dinámico

Reemplaza (o complementa) el colateral tradicional con un historial de comportamiento verificable on-chain.

- **Todos los usuarios empiezan con score 10** (máximo).
- **Pago dentro de plazo** → mantiene o mejora el score.
- **Atraso de aproximadamente 1 mes** → el score baja (por ejemplo, de 10 a 8).
- **Atraso de hasta 1 año sin pago** → el score cae a 1-2, prácticamente inhabilitando a la PYME para nuevo crédito hasta que resuelva la deuda pendiente.

### Cómo se usa el score en el pricing

- A mayor score → menor prima de riesgo → mejor tasa → mayor % del adelanto liberado de entrada.
- A menor score (o sin historial) → mayor prima de riesgo → se libera un % menor del adelanto hasta que la PYME reconstruya confianza con operaciones pequeñas y bien pagadas.

Esto da flexibilidad frente al modelo binario de "te presto o no te presto": el protocolo puede liberar montos parciales según score, en vez de aprobar o rechazar en bloque.

---

## 8. El colateral — modelo en capas

No existe una única garantía que resuelva todo el riesgo. El modelo combina varias capas, cada una cubriendo lo que la anterior no cubre.

### Capa 1 — Respaldo legal

La factura negociable es un título valor bajo la Ley N° 29623 (sección 2). El deudor —no la PYME— tiene obligación legal de pago con o sin este protocolo. Si no paga, existe vía de cobranza legal, además de la penalidad explícita por mala fe que ya establece la ley.

### Capa 2 — Retención parcial

Un pequeño porcentaje del adelanto (por ejemplo, 5-9%) se retiene hasta confirmar que el deudor pagó. Si no paga, ese remanente amortigua parte de la pérdida antes de tocar capas superiores.

### Capa 3 — Score crediticio on-chain

El historial de comportamiento (sección 7) determina cuánto se libera y a qué tasa. Es colateral "blando" — no requiere activos físicos ni historial bancario tradicional, solo comportamiento verificable dentro del propio sistema.

### Capa 4 — Fondo de garantía (roadmap, no MVP)

Un fondo compartido, financiado con parte de la prima de riesgo de cada operación, que absorbe defaults residuales. Está inspirado en el mecanismo de garantías estatales **FAE-MYPE**, el fondo del Estado peruano administrado por COFIDE que cubre entre 90% y 98% de créditos MYPE otorgados por entidades financieras. En FacturaFi, este fondo se autofinancia con el propio protocolo, no con presupuesto público — lo que lo hace más escalable en el tiempo, ya que no depende de que un fondo estatal limitado se agote.

**Nota de alcance:** un modelo con garantes múltiples por wallet (varias personas respaldando a una PYME específica) es una extensión interesante que surgió en la sesión de mentoría, pero de mayor complejidad — se deja como funcionalidad futura, no como parte del MVP de hackathon.

### Por qué un modelo en capas y no una sola garantía

Un colateral físico o bancario tradicional resolvería el riesgo, pero eliminaría el argumento central del proyecto: inclusión financiera. Un modelo sin ningún tipo de respaldo (solo confiar en que el deudor pague) es débil frente a un jurado técnico. La combinación de las 4 capas reparte el riesgo sin excluir a nadie por falta de colateral bancario.

---

## 9. La lógica de pricing

### Fórmula base (riesgo por factura)

```
tasa_descuento = tasa_base + (factor_plazo × días/365) + prima_riesgo(pagador, score_PYME)
```

- **tasa_base**: piso de rentabilidad para atraer liquidez al pool.
- **factor_plazo**: a más días para el cobro, mayor descuento.
- **prima_riesgo**: ajustada por confiabilidad del deudor y el score dinámico de la PYME.

Referencia de mercado: las tasas de factoring en Perú hoy rondan **1.5%–4% mensual** — ancla creíble para no inventar números en el pitch.

### Ajuste por utilización del pool (inspirado en AAVE)

```
tasa_final = tasa_descuento + ajuste_por_utilización(pool)
```

Si el pool tiene poca liquidez libre, la tasa sube para atraer más prestamistas; si sobra liquidez, baja para atraer más PYMEs. Es el mismo mecanismo de tasa dinámica que usa AAVE, el protocolo de préstamos DeFi más grande y probado, aplicado aquí a un activo del mundo real en vez de a colateral cripto volátil.

### Ejemplo numérico

- Factura: S/10,000 a 60 días, pagador de riesgo medio, score alto → descuento total 6%
- PYME recibe: **S/9,400 hoy** (menos retención parcial si aplica)
- Inversionista recibe: retorno ~6.4% en 2 meses (~38% anualizado)

### Indicador de salud del pool

```
salud_del_pool = (fondo de garantía + liquidez disponible) / exposición total a facturas activas
```

Si este indicador cae demasiado, el protocolo puede pausar automáticamente nuevas financiaciones hasta recomponerse — una salvaguarda ante escenarios de estrés del sistema.

---

## 10. Ciclo de vida de la factura tras el financiamiento

Después de la Etapa 4, la factura entra en un ciclo con dos ramas posibles:

**Rama A — Pago a tiempo**
1. El deudor paga dentro del plazo pactado.
2. El smart contract ejecuta el reparto normal a los prestamistas del pool.
3. El score de la PYME sube o se mantiene alto, mejorando sus condiciones para la próxima operación.

**Rama B — Atraso o impago**
1. Se activa la retención parcial (colateral capa 2) como primer amortiguador.
2. El score de la PYME baja, afectando su acceso y condiciones futuras (colateral capa 3).
3. Si la pérdida no queda cubierta por las capas anteriores, se activa el fondo de garantía (colateral capa 4, roadmap).

Este ciclo es el que conecta directamente el diseño de pricing (sección 9) con el modelo de colateral (sección 8): cada rama del ciclo dispara una consecuencia económica específica y medible, no una decisión arbitraria.

---

## 11. Flujo del prestamista

Aunque el foco del pitch está en la PYME, el prestamista tiene su propio recorrido dentro del sistema, y conviene documentarlo porque es quien pone la liquidez que hace posible todo el protocolo:

1. **Descubrimiento**: el prestamista llega al dashboard del pool y ve la tasa actual, la liquidez disponible y el nivel de utilización.
2. **Depósito**: transfiere stablecoins al pool. A cambio, obtiene una posición proporcional a su aporte.
3. **Exposición diversificada**: su capital no financia una sola factura — está distribuido entre todas las facturas activas del pool, lo que reduce el impacto de un default individual.
4. **Acumulación de retorno**: a medida que las facturas se pagan, el contrato acredita capital + interés proporcional a su posición.
5. **Escenario de default**: si una factura entra en mora, el prestamista no pierde de inmediato — las capas de colateral (retención, luego fondo de garantía) absorben la pérdida antes de afectar su posición.
6. **Retiro**: el prestamista puede retirar su capital más los retornos acumulados, sujeto a la liquidez disponible del pool en ese momento.

Este flujo es importante para el pitch porque responde, del lado del inversionista, la misma pregunta que ya resolvimos del lado del riesgo: "¿por qué debería confiar mi dinero a este protocolo?" — la respuesta es diversificación + colateral en capas + transparencia on-chain de cada operación.

---

## 12. Árbol de decisión del pricing

Para explicar el pricing sin mostrar la fórmula completa (útil en la demo), se puede presentar como una secuencia de preguntas que el smart contract responde automáticamente:

1. **¿Cuál es el plazo de la factura?** → determina el componente de tiempo del descuento.
2. **¿Cuál es el score actual de la PYME?** → determina la prima de riesgo base.
3. **¿Cuánta liquidez tiene el pool en este momento?** → determina el ajuste por utilización (inspirado en AAVE).
4. **¿Cuál es el resultado?** → una tasa final, y con ella, el monto exacto que recibe la PYME hoy y el retorno que recibirá el prestamista al vencimiento.

Presentar el pricing como una cadena de decisiones (en vez de una fórmula matemática) suele ser más fácil de seguir para un jurado no técnico durante el pitch, y para un desarrollador es la base directa de cómo estructurar la función de pricing en el contrato.

---

## 13. Journey de la PYME en el tiempo

Este recorrido es útil tanto para el pitch (mostrar valor a largo plazo, no solo una transacción) como para diseñar el dashboard:

1. **Primera vez**: la PYME se registra, sube su primera factura. Como no tiene historial, su score es el inicial (10) pero el sistema puede aplicar cautela en el % liberado si se define así para nuevos usuarios.
2. **Primera operación pagada a tiempo**: el score se mantiene o mejora. La PYME experimenta el beneficio central: liquidez rápida sin colateral bancario.
3. **Uso recurrente**: cada factura bien pagada mejora su posición dentro del protocolo, permitiendo mejores tasas y mayor % liberado por adelantado.
4. **Fidelización**: con un score alto y varias operaciones, la PYME tiene un incentivo económico claro para seguir usando FacturaFi en vez de volver al factoring bancario tradicional, más caro y lento.

Este journey es también el argumento de por qué el sistema de score (sección 7) no es solo una medida de riesgo — es también el mecanismo de retención de usuarios del producto.

---

## 14. Arquitectura técnica — spec para desarrollo

### Separación on-chain / off-chain

Recomendación explícita de la sesión de mentoría: documentar con claridad qué vive en el smart contract y qué vive en la capa de aplicación, antes de empezar a programar.

**Vive on-chain (en el smart contract):**
- El token de la factura (inmutable, con soporte de versionado).
- Los campos de la operación: `score`, `cant_$`, `tiempo_devol`, `%_extra`.
- La lógica de pricing y su ejecución.
- Los depósitos, transferencias y reparto de fondos.
- La actualización del score según comportamiento de pago.
- El estado de cada factura (pendiente / financiada / pagada / en mora / default).

**Vive off-chain (en la aplicación):**
- El formulario de registro de usuario y sus datos personales.
- La validación inicial de que una factura es legítima (en el MVP, simulada; en producción, conectada a un proceso de verificación).
- El dashboard y toda la interfaz visual.
- Notificaciones y recordatorios de pago.

### Componentes a construir

**1. Contrato de Factura**
- Registra: monto, deudor, plazo, PYME emisora.
- Emite el token (inmutable) representando el derecho de cobro.
- Soporta versionado (token v2 reemplaza a v1 si cambian condiciones).
- Estados: `pendiente` / `financiada` / `pagada` / `en_mora` / `default`.

**2. Contrato de Pool / Smart Contract principal**
- Recibe depósitos de stablecoin de los prestamistas.
- Ejecuta el módulo de pricing al aprobar una factura.
- Transfiere el adelanto (menos retención parcial) a la wallet de la PYME.
- Trackea por cada operación: `score`, `cant_$`, `tiempo_devol`, `%_extra`.
- Al vencimiento (o al simularse el pago en el MVP), reparte capital + interés a prestamistas a prorrata.
- Gestiona la actualización del score según comportamiento de pago.
- Gestiona el fondo de garantía si se implementa (capa 4, roadmap).

**3. Módulo de pricing**
- Función que calcula `tasa_descuento` y `tasa_final` según las fórmulas de la sección 9.
- Puede calcularse on-chain o off-chain y pasarse como parámetro validado por el contrato.

**4. Módulo de condiciones de devolución**
- Cuotas periódicas (por ejemplo, 20% mensual), límite de 6 meses.
- Verificación de pago (simulada en el MVP con una función de "confirmar pago").
- Lógica de actualización de score según puntualidad.

**5. Frontend**
- Formulario de registro de usuario/PYME.
- Formulario de registro de factura (monto, deudor, plazo).
- Dashboard: facturas activas, score actual, retorno esperado, historial de operaciones.
- Vista del pool para prestamistas: liquidez disponible, tasa actual, facturas financiadas.

### Recomendaciones de desarrollo (de la sesión de mentoría)

- **Documentar todo el flujo antes de programar**: mapear las 4 etapas, todos los estados posibles del contrato, y cómo entra el usuario (wallet, correo, formulario) en un markdown de referencia compartido por el equipo — este mismo documento cumple esa función.
- **Separar claramente on-chain de off-chain**, como se detalla arriba.
- **Lenguaje recomendado para el contrato**: Solidity, por ser el más soportado y documentado para este tipo de asistencia de desarrollo.
- **Probar en testnet exhaustivamente** antes de la demo: cada función (depósito, financiamiento, reparto, actualización de score) debe probarse de punta a punta.
- **No asumir nada por obvio** al delegar tareas a un asistente de código: especificar límites exactos, casos borde (¿qué pasa si el pool no tiene liquidez suficiente? ¿qué pasa si dos facturas compiten por el mismo fondo?) y pedir que se hagan preguntas en vez de improvisar soluciones.
- Los smart contracts son la parte más propensa a errores del proyecto — conviene aislar ese trabajo (asistente de IA dedicado solo al contrato, con una base de contexto clara) del trabajo de frontend/UI, que puede resolverse por separado.

---

## 15. Guía de tareas por asistente de IA

Cuando distintos asistentes de IA (o distintas sesiones de Claude Code) trabajen en paralelo sobre el proyecto, conviene darles contexto separado y específico, no el documento completo sin filtrar. Sugerencia de división:

### IA dedicada al smart contract
Contexto a darle: secciones 5 a 10 y 14 de este documento (flujo de 4 etapas, score, colateral, pricing, ciclo de vida de la factura, arquitectura on-chain). Instrucción explícita: implementar en Solidity, probar en testnet, no asumir casos borde sin preguntar, seguir exactamente los estados y transiciones documentados.

### IA dedicada al frontend
Contexto a darle: secciones 5, 7, 11 y 13 (flujo de usuario, score, flujo del prestamista, journey de la PYME). Instrucción explícita: el dashboard debe reflejar visualmente los mismos estados que maneja el contrato, sin inventar estados adicionales.

### IA dedicada a testing
Contexto a darle: sección 10 (ciclo de vida de la factura) y sección 14. Instrucción explícita: generar casos de prueba para cada rama del ciclo (pago puntual, atraso de 1 mes, atraso de 1 año) y verificar que el score y los reparto de fondos se comporten según lo documentado.

### IA dedicada al pitch/negocio
Contexto a darle: secciones 0, 1, 2, 9 (ejemplo numérico) y 16 (modelo de negocio). Instrucción explícita: ayudar a sintetizar esto en un pitch de 3 minutos, priorizando el problema y el ejemplo numérico sobre el detalle técnico.

---

## 16. Capa de gasto: cómo la PYME usa el dinero

El pool entrega el adelanto en **stablecoin (USDC)**, no en dólares fiat directos — es lo que permite automatizar todo el ciclo sin bancos de por medio.

**Decisión de diseño: compatibilidad con wallets existentes, no alianza formal.** Lo importante no es que la PYME sepa que está usando blockchain — es que la transacción sea inmutable y llegue directo a su wallet. USDC es un token estándar (ERC-20) compatible con cualquier wallet, incluidas apps de tarjeta cripto ya operando en Perú (por ejemplo, Lemon Cash, con tarjeta virtual de activación inmediata, sin depender del tiempo de envío de una tarjeta física). FacturaFi no gestiona ni solicita nada en nombre de la PYME — ella abre su propia cuenta con su propio proceso de verificación de identidad, y el protocolo solo necesita una dirección de wallet válida para transferir el adelanto. Esta decisión evita también cualquier problema de cumplimiento normativo que surgiría si el protocolo intentara solicitar productos financieros de terceros en nombre de otra persona.

---

## 17. Modelo de negocio

### Fuente de ingreso

Fee de originación (~1%) cobrado por procesar y tokenizar cada factura, aparte del descuento que se lleva el pool.

### Unit economics (ejemplo)

| Concepto | Monto |
|---|---|
| Valor de la factura | S/10,000 |
| Descuento total (riesgo + plazo) | 6% = S/600 |
| Fee de originación | 1% = S/100 |
| Lo que recibe la PYME | S/9,300 (antes de retención parcial) |
| Ingreso de FacturaFi por esta operación | S/100 |

### Estructura de costos

Infraestructura, auditoría de smart contracts, validación de facturas (a futuro), operación del equipo.

### Business Model Canvas (resumen)

| Bloque | Contenido clave |
|---|---|
| Socios clave | Wallets-tarjeta cripto compatibles, cámaras de comercio (validación), auditores de contratos, emisores de stablecoin |
| Actividades clave | Tokenizar facturas, calcular pricing, gestionar pool y score |
| Recursos clave | Smart contracts, fondo de garantía, historial de reputación on-chain |
| Propuesta de valor | PYME: liquidez sin colateral bancario · Prestamista: retorno respaldado por activo real |
| Relación con clientes | Score dinámico, autoservicio, comunidad |
| Canales | App web, wallets cripto, gremios PYME |
| Segmentos | PYMEs peruanas con facturas por cobrar · prestamistas buscando yield en stablecoins |
| Costos | Infraestructura, auditoría, validación, equipo |
| Ingresos | Fee de originación, fee de gestión del fondo de garantía |

### Escalamiento

- **Fase 1 (hackathon/MVP)**: pool único, validación simulada.
- **Fase 2**: validación automática de facturas, fondo de garantía capitalizado con volumen real.
- **Fase 3**: expansión regional — el mismo problema de exclusión existe en Colombia, México y el resto de LatAm, condicionado a verificar el marco legal equivalente en cada país.

---

## 18. Alcance del MVP para la hackathon

**Se construye:**
- Registro de usuario y factura (Etapas 1-2).
- Tokenización de la factura (inmutable, trazable).
- Smart contract con score, monto, tiempo y % extra (Etapa 3).
- Pricing básico por riesgo (sin ajuste dinámico por utilización si el tiempo aprieta).
- Condiciones de devolución simples + actualización de score (Etapa 4).
- Función de "simular pago" para demostrar el reparto automático.
- Dashboard con facturas activas, score y retorno esperado.

**Se explica en el pitch, no se programa:**
- Fondo de garantía con múltiples garantes.
- Integración real con wallets-tarjeta externas (se menciona como compatibilidad, no se construye).
- Ajuste dinámico de tasa por utilización del pool (se puede simplificar a un valor fijo en el MVP).

---

## 19. Feedback recibido en mentoría (resumen)

- Se confirmó el enfoque en PYMEs (no startups) como una decisión correcta por el perfil de riesgo más predecible.
- Se validó la tokenización de la factura como el diferenciador más fuerte del proyecto frente a otros vistos en hackathons similares.
- Se sugirió el sistema de score dinámico (empezando en 10, ajustándose según comportamiento de pago) como mecanismo flexible de colateral.
- Se recomendó explícitamente no perseguir una alianza formal con wallets/tarjetas de terceros, y en su lugar apoyarse en la compatibilidad técnica estándar de las stablecoins.
- Se sugirió mantener el fondo de garantía con garantes múltiples como una extensión futura, priorizando en el MVP las primeras capas de colateral (legal, retención, score).
- Se recomendó documentar todo el flujo antes de programar, separar claramente el trabajo on-chain del off-chain, y usar Solidity como lenguaje del contrato.

---

## 20. Por qué esto encaja con la evaluación de la hackathon

- **Problema real y local**, con marco legal ya definido (Ley N° 29623, sección 2).
- **Diferenciador técnico claro**: la tokenización de la factura como activo inmutable y trazable, poco visto en proyectos similares.
- **Modelo económico defendible**: pricing por riesgo, colateral en capas, score dinámico, y referencias a mecanismos reales (FAE-MYPE, AAVE) en vez de supuestos inventados.
- **Demostrable de principio a fin** en el tiempo de una demo corta, sin depender de integraciones externas reales.
- **Track objetivo**: RWA (Real World Assets) / DeFi / Stablecoins.
- **Visión de escalamiento clara**, sin sobreprometer fuera del alcance del MVP.

---

## 21. Próximos pasos sugeridos

1. Validar los parámetros exactos de la fórmula de pricing (sección 9) con el equipo antes de programar el contrato.
2. Repartir el trabajo según la guía de tareas por IA (sección 15).
3. Documentar en testnet cada transición del ciclo de vida de la factura (sección 10) con pruebas específicas.
4. Preparar el pitch priorizando: problema (sección 1) → mecánica central de tokenización (sección 3) → ejemplo numérico (sección 9) → cómo se protege el retorno (sección 8) → visión de escalamiento (sección 17).
5. Ensayar la demo en vivo siguiendo el flujo de 4 etapas (sección 5) de principio a fin.
