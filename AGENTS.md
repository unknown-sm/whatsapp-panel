# 🤖 AI Collaboration Board

Reglas de convivencia para IAs que trabajan en este repo.

## 👥 AIs Activas

| AI | Prefijo de branch | Identidad git | Owner humano |
|---|---|---|---|
| **Mavis** (minimax.io) | `mavis/*` | Mavis <mavis@minimax.local> | @unknown-sm |
| **[Otra IA]** | `otro/*` | — | @unknown-sm |

> Si sumás otra IA, agregala acá y elegí un prefijo único.

## 📋 Reglas de oro

1. **Nunca pushear a `master` directo.** Siempre via PR o branch.
2. **Pull master antes de arrancar** cada tarea (`git pull origin master`).
3. **Branches con prefijo de la IA** (`mavis/parser-pedidos`, `claude/fix-docker`).
4. **Commits chicos y con mensajes claros** — un commit = un cambio lógico.
5. **Avisar al otro AI** antes de tocar archivos críticos (ver lista abajo).
6. **Una IA revisa el PR de la otra** antes del merge (cross-review).
7. **Solo el humano mergea a master** — las IAs sugieren, no mergean.

## 🚦 Archivos críticos (coordinar antes de tocar)

Estos se pisan fácil, **avisá en el board** antes de modificarlos:

- `package.json` y `package-lock.json`
- `backend/prisma/schema.prisma`
- `backend/src/index.ts` (registro de rutas)
- `docker-compose.yml` y `Dockerfile`
- `backend/src/lib/prisma.ts` (singleton)
- `.env.example` (variables compartidas)

## 🗂️ Áreas de trabajo sugeridas

| AI | Áreas típicas |
|---|---|
| **Mavis** | Features de producto (parsers, dashboards, integraciones), services nuevos, frontend pages nuevas, refactors no-infra |
| **Otra IA** | Docker, build, openwa, infra, fix de dependencias, migraciones de DB |

> Si hay solapamiento, se coordina en este board antes de arrancar.

## 📊 Estado actual de tareas

| AI | Branch | Status | Descripción |
|---|---|---|---|
| Mavis | `mavis/chore/error-handler` | 🚧 en curso | AGENTS.md + error handler global |

## 🔄 Workflow estándar

```
1. Pull master
   git checkout master && git pull origin master

2. Crear rama con tu prefijo
   git checkout -b mavis/feature-x

3. Trabajo + commits chicos

4. Push a la rama
   git push origin mavis/feature-x

5. Avisar al otro AI (en este board o por chat con el humano)

6. La otra IA revisa el PR

7. El humano mergea a master

8. EasyPanel auto-deploya
```

## 🧹 Cleanup

- Después de mergear, borrar la rama: `git branch -d mavis/feature-x`
- Si algo quedó colgado, `git worktree prune`

---

Última actualización: 2026-06-08 — Mavis
