# Flujo de mantenimiento de ProgramFiles

## Objetivo

Que cada cambio sea aislado, verificable y reversible. La persona administradora no debe tener que interpretar código ni adivinar qué archivos pegar.

## Ramas

- `main`: versión estable. No se edita directamente.
- `beta`: versión privada de prueba cuando exista un entorno de preview.
- `feature/<tema>`: un único cambio o mejora por rama.
- `backup/<fecha>-<motivo>`: punto de restauración antes de cambios importantes.

Toda modificación se crea primero en una rama `feature`, se prueba en privado y se revisa antes de pasar a `main`.

## Paquete de cambio para entregar

Cada mejora debe entregarse con un ZIP llamado:

`ProgramFiles-CAMBIO-<numero>-<nombre>.zip`

Estructura:

```
ProgramFiles-CAMBIO-001-nombre/
  LEEME-APLICAR.md
  CAMBIOS.md
  reemplazar/              # solo archivos completos que cambian
  revertir/                # copias de los archivos anteriores cuando aplique
  pruebas.md
```

`LEEME-APLICAR.md` debe indicar en lenguaje simple:
1. qué mejora contiene;
2. qué archivos reemplazar y dónde;
3. qué NO toca;
4. cómo verificar que funcionó;
5. cómo volver atrás.

Nunca se incluyen claves, archivos `.env`, tokens, bases de datos ni credenciales dentro del ZIP.

## Separación técnica

- `app/`: pantallas y rutas.
- `components/`: piezas reutilizables de interfaz.
- `lib/`: reglas compartidas, permisos y conexiones.
- `supabase/migrations/`: cambios de base de datos, uno por archivo y nunca editando una migración aplicada.
- `public/`: logo, imágenes y otros recursos públicos.
- `docs/`: arquitectura, cambios, instrucciones y decisiones.
- `tests/`: pruebas automáticas cuando se incorporen.

Los cambios visuales deben concentrarse en componentes, estilos y configuración de identidad; no deben modificar permisos, RLS, pagos ni migraciones salvo que la solicitud lo diga expresamente.

## Antes de cada cambio

1. Crear backup o tag de la versión estable.
2. Escribir una breve lista de alcance: qué se modifica y qué queda fuera.
3. Trabajar en una rama separada.
4. Probar el recorrido afectado.
5. Generar vista previa privada.
6. Entregar ZIP, resumen y modo de volver atrás.
7. Solo fusionar a `main` luego de la aprobación explícita de la persona administradora.

## Registro de versiones

Toda entrega debe sumar una entrada en `docs/CHANGELOG.md` con fecha, alcance, estado de pruebas y forma de reversión.
