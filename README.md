# fc-devs-mcp

MCP Server para integración con **InterSystems IRIS** y **Azure DevOps**, compatible con cualquier cliente MCP (Claude Desktop, Cowork, etc.).

---

## Variables de entorno

| Variable               | Requerida | Default         | Descripción                                               |
| ---------------------- | --------- | --------------- | --------------------------------------------------------- |
| `IRIS_HOSTNAME`        | ✅        | —               | Host del servidor IRIS                                    |
| `IRIS_PORT`            | ✅        | —               | Puerto IRIS (generalmente `1972`)                         |
| `IRIS_NAMESPACE`       | ✅        | —               | Namespace IRIS (ej. `USER`, `NAMESPACE`)                  |
| `IRIS_USERNAME`        | ✅        | —               | Usuario IRIS                                              |
| `IRIS_PASSWORD`        | ✅        | —               | Contraseña IRIS                                           |
| `ADO_ENABLED`          | ❌        | `false`         | Habilitar integración Azure DevOps                        |
| `AZURE_DEVOPS_ORG_URL` | ❌        | —               | URL organización ADO (ej. `https://dev.azure.com/mi-org`) |
| `AZURE_DEVOPS_PAT`     | ❌        | —               | Personal Access Token de Azure DevOps                     |
| `MCP_SERVER_NAME`      | ❌        | `FC-MCP-Server` | Nombre del servidor MCP                                   |
| `MCP_SERVER_VERSION`   | ❌        | `1.0.0`         | Versión del servidor MCP                                  |

---

## Modo 1 — Via npx (publicado en npm)

No requiere clonar el repositorio. El cliente MCP ejecuta el paquete directamente con `npx`.

Las variables de entorno se pasan en la configuración del cliente MCP:

```json
{
  "mcpServers": {
    "fc-mcp": {
      "command": "npx",
      "args": ["-y", "fc-devs-mcp"],
      "env": {
        "IRIS_HOSTNAME": "192.168.1.100",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "NAMESPACE",
        "IRIS_USERNAME": "usuario",
        "IRIS_PASSWORD": "contraseña"
      }
    }
  }
}
```

> **Nota:** `npx -y` descarga la última versión del paquete automáticamente en el primer uso. Para fijar una versión específica usa `npx -y fc-devs-mcp@1.0.0`.

---

## Modo 2 — Local (sin publicar en npm)

Útil para desarrollo o entornos sin acceso a npmjs.

### Opción A — Ruta absoluta al dist compilado

Clona el repositorio, instala dependencias y compila:

```bash
git clone https://github.com/sorodriguezz/fc-devs-mcp.git
cd fc-devs-mcp
npm install
npm run build
```

Luego configura el cliente MCP apuntando al `dist/index.js` con ruta absoluta:

```json
{
  "servers": {
    "mcp-fc": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "env": {
        "IRIS_HOSTNAME": "HOST",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "NAMESPACE",
        "IRIS_USERNAME": "USUARIO",
        "IRIS_PASSWORD": "PASSWORD",
        "MCP_SERVER_NAME": "MCP-FC",
        "ADO_ENABLED": "false"
      }
    }
  }
}
```

### Opción B — npm link (simula instalación global)

Permite usar el comando `fc-mcp` directamente como si estuviera publicado:

```bash
cd fc-devs-mcp
npm install
npm run build
npm link
```

Luego en la configuración del cliente MCP:

```json
{
  "mcpServers": {
    "iris-desa-sap": {
      "command": "fc-mcp",
      "env": {
        "IRIS_HOSTNAME": "192.168.1.100",
        "IRIS_PORT": "1972",
        "IRIS_NAMESPACE": "ENSSAP",
        "IRIS_USERNAME": "usuario",
        "IRIS_PASSWORD": "contraseña"
      }
    }
  }
}
```

Para deshacer el link: `npm unlink -g fc-devs-mcp`

## Desarrollo local con inspector MCP

```bash
npm run inspect
```

Abre el inspector visual de MCP en `http://localhost:5173` para probar las tools interactivamente.