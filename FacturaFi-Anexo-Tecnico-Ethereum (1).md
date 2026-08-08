# 🧾 FacturaFi — Anexo técnico Ethereum
### Estándares, patrones y fórmulas específicas del ecosistema

**Hoja de referencia técnica para el equipo de smart contracts**

---

## 1. Estándar de token para la factura: ERC-721 vs ERC-3525

### El problema a resolver
Hasta el documento principal, "tokenizar la factura" se dejó en genérico. En Ethereum hay que elegir un estándar concreto, y la elección cambia lo que el protocolo puede hacer.

### Opción A — ERC-721 (NFT estándar)
Cada factura es un token único e indivisible. Es el estándar más simple y más documentado, ideal si el MVP solo necesita "un prestamista (o el pool como bloque único) financia una factura completa".

### Opción B — ERC-3525 (token semi-fungible)
Permite que un mismo token represente un valor divisible en unidades. Un solo token de factura puede fraccionarse entre varios prestamistas, cada uno dueño de una porción proporcional.

### Fórmula de fraccionamiento (si se usa ERC-3525)
```
unidades_totales_del_token = valor_factura
participación_i = unidades_compradas_i / unidades_totales
retorno_i = participación_i × retorno_total
```

### Recomendación de alcance
Para el MVP de hackathon, **ERC-721 es más rápido de implementar y de demostrar**. ERC-3525 es la evolución natural para el roadmap, cuando el pool necesite ofrecer exposición fraccionada factura por factura en vez de un pool genérico mezclado. Vale la pena mencionar ambos en el pitch: "usamos ERC-721 para el MVP, con ERC-3525 como evolución natural para fraccionamiento fino."

---

## 2. Curva de tasa por utilización (modelo "kinked rate")

### Por qué no basta con "sube o baja"
El documento principal ya menciona un ajuste por utilización inspirado en AAVE. La versión rigurosa de ese mecanismo usa una curva con un punto de quiebre (kink), no un ajuste lineal simple.

### Fórmula completa
```
Si U ≤ U_óptimo:
    tasa = tasa_base + (U / U_óptimo) × pendiente_1

Si U > U_óptimo:
    tasa = tasa_base + pendiente_1 + ((U − U_óptimo) / (1 − U_óptimo)) × pendiente_2
```

Donde:
- `U` = utilización del pool = fondos prestados / fondos totales depositados.
- `U_óptimo` = punto de quiebre, típicamente ~80%.
- `pendiente_1` = incremento suave de tasa antes del punto óptimo.
- `pendiente_2` = incremento agresivo de tasa después del punto óptimo (mucho mayor que `pendiente_1`).

### Por qué el quiebre importa
Antes del punto óptimo, subir la tasa un poco basta para equilibrar oferta y demanda. Después del punto óptimo, el pool está en riesgo real de quedarse sin liquidez para nuevos retiros — ahí la tasa debe subir mucho más rápido para atraer capital de forma urgente. Es la diferencia entre un incentivo suave y una señal de alarma.

---

## 3. Oráculos de precio (Chainlink)

### Cuándo se necesitan
Cualquier momento en que el contrato necesite un dato del mundo real que no puede calcular por sí mismo — por ejemplo, convertir soles a USDC, o verificar que el monto de una factura es razonable frente a un tipo de cambio de referencia.

### Por qué no se puede confiar en un solo número fijo
Un contrato no "sabe" el tipo de cambio actual — necesita que un oráculo se lo reporte. Chainlink es el estándar más usado en Ethereum para esto, con múltiples fuentes de datos agregadas para evitar manipulación.

### Verificación obligatoria de "staleness" (dato desactualizado)
```
si (timestamp_actual − timestamp_del_oráculo) > umbral_máximo:
    rechazar_operación()
```

Nunca se debe operar con un precio de oráculo desactualizado — es una de las causas más comunes de exploits en protocolos DeFi reales. Mencionar esta verificación explícitamente en el pitch es una señal fuerte de rigor técnico.

---

## 4. Firmas EIP-712 para la aceptación de la factura

### El contexto legal que lo motiva
La Ley N° 29623 da al deudor 8 días hábiles para aceptar o rechazar la factura. Pedirle al deudor que pague gas por una transacción on-chain solo para "aceptar" una factura que no es su iniciativa genera fricción innecesaria.

### La solución: firma estructurada off-chain
**EIP-712** es un estándar que permite firmar mensajes estructurados y legibles con la wallet del usuario, sin necesidad de enviar una transacción (sin gas). El contrato solo verifica esa firma cuando de verdad la necesita — por ejemplo, al momento de tokenizar la factura.

### Flujo simplificado
```
1. El deudor recibe la solicitud de aceptación (fuera de la cadena)
2. Firma con su wallet (gratis, sin transacción)
3. La firma se guarda junto a la factura
4. El contrato verifica la firma solo cuando ejecuta la tokenización o el pago
```

Esto hace que la experiencia del deudor —que no es un usuario activo del protocolo, solo alguien que debe confirmar algo— sea mucho más fluida.

---

## 5. Multisig para la garantía distribuida (founders múltiples)

### Conexión con el anexo matemático
El anexo teórico-matemático ya formaliza el reparto de responsabilidad entre N wallets con pesos. La forma estándar de implementar esto en Ethereum es un esquema de firma múltiple.

### El modelo M-de-N
Se requieren M firmas válidas de un total de N wallets garantes para autorizar ciertas acciones — por ejemplo, liberar el último tramo del adelanto, o aprobar una operación de monto alto.

```
autorizado = (firmas_válidas_recibidas ≥ M),   con M ≤ N
```

### Por qué es mejor que solo "trackear responsabilidad"
Un multisig da control real y verificable on-chain: la acción literalmente no ocurre sin el número mínimo de firmas, en vez de depender de una regla de penalización aplicada después del hecho. Es el mismo patrón que usan wallets institucionales tipo Gnosis Safe.

---

## 6. Health Factor del pool

### Formalización de la "salud del pool" ya mencionada
El documento principal define un indicador simple de salud del pool. Esta es su versión formalizada, en la misma línea que el "health factor" que usa AAVE para posiciones individuales, aplicado aquí al pool completo.

```
health_factor = (fondo_garantía + liquidez_disponible × factor_liquidación) / exposición_total_activa
```

### Regla de pausa automática
```
si health_factor < 1:
    pausar_nuevas_financiaciones()
```

Es la misma lógica de umbral de liquidación que usan los protocolos de préstamos DeFi más establecidos, adaptada de posiciones individuales a la salud agregada de todo el pool.

---

## 7. Patrón de seguridad: Checks-Effects-Interactions

### Por qué es necesario
Cualquier función que mueva fondos (financiar una factura, repartir un retorno) es un punto de riesgo frente a ataques de reentrancy — uno de los vectores de exploit más comunes en contratos Solidity.

### El patrón, en tres pasos obligatorios y en este orden

```
1. Checks — validar condiciones antes de hacer nada:
   ¿hay liquidez suficiente? ¿el estado de la factura es el correcto?

2. Effects — actualizar el estado interno del contrato:
   marcar la factura como pagada, actualizar el score, actualizar balances internos

3. Interactions — solo al final, ejecutar transferencias externas de fondos
```

### Por qué el orden importa
Si las transferencias de fondos ocurren antes de actualizar el estado interno, un contrato malicioso que reciba esos fondos puede "reentrar" a la función antes de que el estado se haya actualizado, y repetir la operación indebidamente. Seguir este orden estrictamente elimina esa clase de vulnerabilidad. Mencionarlo explícitamente en la documentación del contrato es una señal de madurez técnica frente a un jurado que revise el código.

---

## 8. Indexado de eventos con The Graph

### El problema que resuelve
El dashboard necesita mostrar facturas activas, historial de operaciones y score de cada PYME. Consultar esta información escaneando toda la blockchain en cada carga de página es lento y costoso.

### La solución estándar
**The Graph** indexa los eventos que el contrato emite (factura creada, financiada, pagada, score actualizado) y permite consultarlos con queries rápidas tipo GraphQL, sin tener que volver a escanear la cadena completa cada vez.

### Alcance recomendado
No es indispensable para el MVP de 48 horas — el frontend puede leer directamente del contrato para un volumen pequeño de datos de demo. Vale la pena mencionarlo como parte del roadmap técnico si el jurado pregunta cómo escalaría el producto a miles de facturas activas.

---

## 9. Resumen de alcance para el MVP vs. roadmap

| Concepto | MVP de hackathon | Roadmap post-hackathon |
|---|---|---|
| Estándar de token | ERC-721 | Migrar a ERC-3525 para fraccionamiento |
| Tasa por utilización | Fórmula simple o fija | Curva kinked completa |
| Oráculos | Simulado o valor fijo | Chainlink con verificación de staleness |
| Aceptación del deudor | Simulada con función directa | Firma EIP-712 off-chain |
| Garantía multi-founder | Reparto documentado, no ejecutado on-chain | Multisig M-de-N real |
| Salud del pool | Cálculo simple, sin pausa automática | Health factor con pausa automática |
| Seguridad del contrato | Patrón Checks-Effects-Interactions aplicado desde el inicio (no negociable, cuesta lo mismo hacerlo bien) | Auditoría externa formal |
| Consulta de datos | Lectura directa del contrato | Indexado con The Graph |

**Nota importante:** el patrón de seguridad (punto 7) es la única fila de esta tabla que no debería quedar como "roadmap" — aplicarlo bien desde el MVP no cuesta tiempo adicional significativo y evita el error más común y más penalizado en contratos de hackathon.
