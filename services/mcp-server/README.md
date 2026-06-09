# microservices-mcp-server

Serveur MCP Go (stdio) pour interagir avec le backend microservices.

## Tools

- `backend_health_check`: verifie la sante d'un service
- `backend_list_endpoints`: liste les endpoints exposes

## Lancer

```bash
go run ./cmd/server --transport stdio
```

Mode HTTP:

```bash
go run ./cmd/server --transport http --http-addr :8090
```
