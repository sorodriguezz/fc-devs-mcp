# fc-devs-mcp

MCP Server para integración con **InterSystems IRIS**, **Microsoft SQL Server** y **Azure DevOps**, compatible con cualquier cliente MCP (Claude Desktop, Cowork, etc.).

Cada integración es completamente opcional y se activa mediante un flag de entorno. Puedes tener las tres activas al mismo tiempo, solo una, o combinarlas según tu infraestructura.

---

## Variables de entorno

### Servidor

| Variable             | Requerida | Default         | Descripción              |
| -------------------- | --------- | --------------- | ------------------------ |
| `MCP_SERVER_NAME`    | ❌        | `FC-MCP-Server` | Nombre del servidor MCP  |
| `MCP_SERVER_VERSION` | ❌        | `1.0.0`         | Versión del servidor MCP |

### InterSystems IRIS

| Variable         | Requerida si enabled | Default | Descripción                              |
| ---------------- | -------------------- | ------- | ---------------------------------------- |
| `IRIS_ENABLED`   | —                    | `true`  | Habilitar integración IRIS               |
| `IRIS_HOSTNAME`  | ✅                   | —       | Host del servidor IRIS                   |
| `IRIS_PORT`      | ✅                   | `1972`  | Puerto IRIS                              |
| `IRIS_NAMESPACE` | ✅                   | —       | Namespace IRIS (ej. `USER`, `APP`)       |
| `IRIS_USERNAME`  | ✅                   | —       | Usuario IRIS                             |
| `IRIS_PASSWORD`  | ✅                   | —       | Contraseña IRIS                          |
| `IRIS_TOOLSETS`  | ❌                   | `sql,production,globals` | Grupos de tools a exponer. Quitar los que no uses ahorra contexto |

### Microsoft SQL Server

| Variable                  | Requerida si enabled | Default | Descripción                                                          |
| ------------------------- | -------------------- | ------- | -------------------------------------------------------------------- |
| `MSSQL_ENABLED`           | —                    | `false` | Habilitar integración SQL Server                                     |
| `MSSQL_AUTH`              | ❌                   | `sql`   | Modo de autenticación: `sql` (usuario/contraseña SQL) o `azure-ad-password` (Microsoft Entra ID) |
| `MSSQL_HOSTNAME`          | ✅                   | —       | Host del servidor (local, Azure SQL, K8s service DNS, etc.)          |
| `MSSQL_PORT`              | ❌                   | `1433`  | Puerto SQL Server                                                    |
| `MSSQL_DATABASE`          | ✅                   | —       | Base de datos destino                                                |
| `MSSQL_USERNAME`          | ✅                   | —       | Usuario SQL, o correo Entra ID (ej. `usuario@empresa.cl`) si `MSSQL_AUTH=azure-ad-password` |
| `MSSQL_PASSWORD`          | ✅                   | —       | Contraseña del usuario                                               |
| `MSSQL_AZURE_CLIENT_ID`   | ❌                   | client público de Azure SQL | Solo si quieres usar tu propia App registrada en Entra ID. Por defecto usa el mismo client público que DBeaver |
| `MSSQL_AZURE_TENANT_ID`   | ❌                   | dominio del correo | Solo para forzar un tenant. Por defecto se deriva del dominio de `MSSQL_USERNAME` (o `organizations`) |
| `MSSQL_ENCRYPT`           | ❌                   | `true`  | TLS habilitado. Requerido en Azure SQL; `false` en instancias locales |
| `MSSQL_TRUST_SERVER_CERT` | ❌                   | `false` | Aceptar certificados autofirmados. Solo `true` en entornos dev       |

### Azure DevOps

| Variable               | Requerida si enabled | Default | Descripción                                               |
| ---------------------- | -------------------- | ------- | --------------------------------------------------------- |
| `ADO_ENABLED`          | —                    | `false` | Habilitar integración Azure DevOps                        |
| `AZURE_DEVOPS_ORG_URL` | ✅                   | —       | URL de la organización (ej. `https://dev.azure.com/mi-org`) |
| `AZURE_DEVOPS_PAT`     | ✅                   | —       | Personal Access Token de Azure DevOps                     |
| `ADO_DOMAINS`          | ❌                   | todos   | Dominios del MCP oficial a cargar: `core`, `work`, `work-items`, `repositories`, `pipelines`, `wiki`, `test-plans`, `search`, `advanced-security` (separados por coma o espacio) |
| `ADO_TOOLS`            | ❌                   | todas   | Allowlist de tools por nombre; admite comodín final (ej. `wit_*,repo_pull_request`) |
| `ADO_PARAM_DESC_MAX_CHARS` | ❌               | `0`     | Largo máximo de las descripciones de parámetros (`0` = omitir, `-1` = completas). Las de parámetros enum (`action`) se conservan siempre |
| `ADO_COMPACT_RESPONSES` | ❌                  | `true`  | Quita `_links`, URLs de API REST, avatares, descriptores y `null` de las respuestas |

### Rendimiento y consumo de tokens

Todo lo que devuelve una tool entra completo en el contexto del modelo, y las definiciones de las tools se envían en **cada** turno. Estas variables controlan ambos costos:

| Variable                 | Default | Descripción |
| ------------------------ | ------- | ----------- |
| `SQL_MAX_ROWS`           | `100`   | Filas devueltas por un SELECT cuando no se pasa `maxRows` (aplica a `iris_query`, `mssql_query` y logs). Si hay más, la respuesta incluye `"truncated": true` |
| `MCP_MAX_CELL_CHARS`     | `500`   | Largo máximo de cada valor string (campos de texto, mensajes HL7, JSON…). `0` = sin límite |
| `MCP_MAX_RESPONSE_CHARS` | `40000` | Tope de caracteres de cualquier respuesta (≈ 11k tokens). `0` = sin límite |

Recomendaciones:

- **Azure DevOps es lo más caro en contexto**: con todos los dominios son 40 tools (~10k tokens por turno). Limitar con `ADO_DOMAINS` a lo que realmente usas (ej. `core work-items repositories`) lo reduce a la mitad o menos.
- Los SELECT se devuelven en formato columnar (`{"columns":[…],"rows":[[…],[…]]}`), que no repite los nombres de columna en cada fila.
- Para arrancar más rápido, evita `--prefer-online` en `npx` (consulta el registry en cada arranque) o instala el paquete globalmente. `@azure-devops/mcp` se instala como dependencia opcional y se ejecuta directo con `node`, sin un segundo `npx`.

---

## Modo 1 — Via npx (publicado en npm)

No requiere clonar el repositorio. El cliente MCP ejecuta el paquete directamente con `npx`.

### Solo IRIS

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx.cmd",
      "args": ["--yes", "--prefer-online", "fc-devs-mcp"],
      "env": {
        "IRIS_ENABLED": "true",
        "IRIS_HOSTNAME": "10.0.0.42",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "APPNS",
        "IRIS_USERNAME": "admin",
        "IRIS_PASSWORD": "s3cr3tIris!"
      }
    }
  }
}
```

### Solo SQL Server (instancia local o en red)

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx.cmd",
      "args": ["--yes", "--prefer-online", "fc-devs-mcp"],
      "env": {
        "IRIS_ENABLED": "false",
        "MSSQL_ENABLED": "true",
        "MSSQL_HOSTNAME": "10.0.1.55",
        "MSSQL_PORT": "1433",
        "MSSQL_DATABASE": "inventory_db",
        "MSSQL_USERNAME": "app_user",
        "MSSQL_PASSWORD": "Sup3rS3cur3!",
        "MSSQL_ENCRYPT": "false",
        "MSSQL_TRUST_SERVER_CERT": "true"
      }
    }
  }
}
```

### Solo SQL Server (Azure SQL Database)

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx.cmd",
      "args": ["--yes", "--prefer-online", "fc-devs-mcp"],
      "env": {
        "IRIS_ENABLED": "false",
        "MSSQL_ENABLED": "true",
        "MSSQL_HOSTNAME": "contoso-sql.database.windows.net",
        "MSSQL_PORT": "1433",
        "MSSQL_DATABASE": "sales_prod",
        "MSSQL_USERNAME": "sqladmin",
        "MSSQL_PASSWORD": "Az@SQL2024!",
        "MSSQL_ENCRYPT": "true",
        "MSSQL_TRUST_SERVER_CERT": "false"
      }
    }
  }
}
```

### Solo SQL Server (Azure SQL con Entra ID — Active Directory - Password)

Igual que el modo **"Active Directory - Password"** de DBeaver: solo necesitas **usuario (correo Entra ID) + contraseña**. No hace falta registrar una App ni indicar tenant/client — se usa el client público de Azure SQL por defecto y el tenant se deriva del dominio del correo.

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx.cmd",
      "args": ["--yes", "--prefer-online", "fc-devs-mcp"],
      "env": {
        "IRIS_ENABLED": "false",
        "ADO_ENABLED": "false",
        "MSSQL_ENABLED": "true",
        "MSSQL_AUTH": "azure-ad-password",
        "MSSQL_HOSTNAME": "mi-servidor.database.windows.net",
        "MSSQL_PORT": "1433",
        "MSSQL_DATABASE": "mi_base_datos",
        "MSSQL_USERNAME": "usuario@empresa.cl",
        "MSSQL_PASSWORD": "tu-contraseña-entra-id",
        "MSSQL_ENCRYPT": "true"
      }
    }
  }
}
```

> Si necesitas una App registrada propia o forzar un tenant específico, puedes añadir `MSSQL_AZURE_CLIENT_ID` y `MSSQL_AZURE_TENANT_ID` (ambos opcionales).

### SQL Server dentro de Kubernetes

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx.cmd",
      "args": ["--yes", "--prefer-online", "fc-devs-mcp"],
      "env": {
        "IRIS_ENABLED": "false",
        "MSSQL_ENABLED": "true",
        "MSSQL_HOSTNAME": "sqlserver-svc.data-ns.svc.cluster.local",
        "MSSQL_PORT": "1433",
        "MSSQL_DATABASE": "orders_db",
        "MSSQL_USERNAME": "k8s_user",
        "MSSQL_PASSWORD": "K8sP@ss2024",
        "MSSQL_ENCRYPT": "false",
        "MSSQL_TRUST_SERVER_CERT": "true"
      }
    }
  }
}
```

### Todas las integraciones activas

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx.cmd",
      "args": ["--yes", "--prefer-online", "fc-devs-mcp"],
      "env": {
        "IRIS_ENABLED": "true",
        "IRIS_HOSTNAME": "10.0.0.42",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "APPNS",
        "IRIS_USERNAME": "admin",
        "IRIS_PASSWORD": "s3cr3tIris!",
        "MSSQL_ENABLED": "true",
        "MSSQL_HOSTNAME": "10.0.1.55",
        "MSSQL_PORT": "1433",
        "MSSQL_DATABASE": "inventory_db",
        "MSSQL_USERNAME": "app_user",
        "MSSQL_PASSWORD": "Sup3rS3cur3!",
        "MSSQL_ENCRYPT": "false",
        "MSSQL_TRUST_SERVER_CERT": "true",
        "ADO_ENABLED": "true",
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/contoso-devs",
        "AZURE_DEVOPS_PAT": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

> **Nota:** `--yes --prefer-online` obliga a `npx` a consultar npm en cada arranque (ignora la caché local), por lo que siempre se ejecuta la **última versión publicada**. En Windows el binario es `npx.cmd`; en macOS/Linux usa `npx`.

---

## Modo 2 — Local (sin publicar en npm)

Útil para desarrollo o entornos sin acceso a npmjs.

### Opción A — Ruta absoluta al dist compilado

```bash
git clone https://github.com/sorodriguezz/fc-devs-mcp.git
cd fc-devs-mcp
npm install
npm run build
```

Configura el cliente MCP apuntando al `dist/index.js`:

```json
{
  "servers": {
    "fc-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "env": {
        "IRIS_ENABLED": "true",
        "IRIS_HOSTNAME": "10.0.0.42",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "APPNS",
        "IRIS_USERNAME": "admin",
        "IRIS_PASSWORD": "s3cr3tIris!",
        "MSSQL_ENABLED": "false",
        "ADO_ENABLED": "false"
      }
    }
  }
}
```

### Opción B — npm link (simula instalación global)

```bash
cd fc-devs-mcp
npm install
npm run build
npm link
```

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "fc-mcp",
      "env": {
        "IRIS_ENABLED": "true",
        "IRIS_HOSTNAME": "10.0.0.42",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "APPNS",
        "IRIS_USERNAME": "admin",
        "IRIS_PASSWORD": "s3cr3tIris!"
      }
    }
  }
}
```

Para deshacer el link: `npm unlink -g fc-devs-mcp`

---

## Tools disponibles

| Tool                 | Integración    | Descripción                                               |
| -------------------- | -------------- | --------------------------------------------------------- |
| `iris_query`         | IRIS (`sql`)   | Ejecuta SQL en InterSystems IRIS                          |
| `iris_production_*`, `interoperability_production_*` | IRIS (`production`) | Gestión de producciones de interoperabilidad |
| `iris_global_*`      | IRIS (`globals`) | Lectura/escritura de globals IRIS                       |
| `mssql_query`        | SQL Server     | Ejecuta SQL en Microsoft SQL Server (SELECT, DML y DDL)   |
| *(dinámicos)*        | Azure DevOps   | Tools descubiertos dinámicamente desde el MCP oficial ADO |

---

## Desarrollo local con inspector MCP

```bash
npm run inspect
```

Abre el inspector visual en `http://localhost:5173` para probar las tools interactivamente.
