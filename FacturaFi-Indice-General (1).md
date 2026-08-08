# 🧾 FacturaFi — Índice general de documentos

Guía rápida de qué documento abrir según lo que necesites en cada momento.

---

## Documentos disponibles

| Documento | Contenido | Úsalo para |
|---|---|---|
| **FacturaFi-Documento-Producto-Extenso.md** | Documento principal: problema, marco legal (Ley 29623), flujo en 4 etapas, score, colateral en capas, pricing, arquitectura, modelo de negocio, guía de tareas por IA, resumen de mentoría | Explicar el proyecto completo a alguien nuevo, o como contexto base para cualquier IA que empiece a trabajar en el proyecto |
| **FacturaFi-Anexo-Teorico-Matematico.md** | Fórmulas de liberación de efectivo por tramos, score de alta granularidad (0-1,000,000), garantía distribuida multi-wallet | Cuando se necesite el detalle matemático fino del pricing y del colateral, más allá de lo que cubre el documento principal |
| **FacturaFi-Anexo-Tecnico-Ethereum.md** | Estándares de token (ERC-721/3525), curva de tasa por utilización, oráculos, EIP-712, multisig, health factor, patrón de seguridad, indexado | Contexto específico para quien programe el smart contract en Solidity |
| **FacturaFi-Business-Model-Canvas.xlsx** | Los 9 bloques del canvas en tabla ordenable y filtrable | Compartir o revisar el modelo de negocio en formato spreadsheet |

---

## Qué documento darle a cada persona o IA según la tarea

**Si vas a explicarle el proyecto a un mentor o jurado:**
→ Documento principal, secciones 0, 1, 3 y 20 (resumen, problema, solución, por qué encaja con la hackathon).

**Si vas a programar el smart contract:**
→ Documento principal, secciones 5 a 10 y 14 (flujo, score, colateral, pricing, arquitectura) + Anexo Ethereum completo.

**Si vas a construir el frontend/dashboard:**
→ Documento principal, secciones 5, 7, 11 y 13 (flujo de usuario, score, flujo del prestamista, journey de la PYME).

**Si vas a ajustar los números exactos del pricing o el colateral:**
→ Anexo teórico-matemático completo.

**Si vas a preparar el pitch de 3 minutos:**
→ Documento principal, secciones 0, 1, 2, 9 (ejemplo numérico) y 17 (modelo de negocio) — evitar entrar en el detalle de los anexos durante el pitch, guardarlo para preguntas del jurado.

**Si un jurado pregunta algo muy técnico durante la demo:**
→ Tener el Anexo Ethereum a la mano como respaldo — ahí están las respuestas a "¿cómo evitan reentrancy?", "¿cómo manejan el tipo de cambio?", "¿qué pasa si el pool se queda sin liquidez?".

---

## Orden recomendado de lectura para alguien nuevo en el equipo

1. Documento principal — de principio a fin, una sola vez.
2. Anexo teórico-matemático — solo si va a tocar la lógica de pricing o colateral.
3. Anexo técnico Ethereum — solo si va a tocar el smart contract.
4. Business Model Canvas (Excel) — como referencia rápida, no requiere lectura secuencial.
