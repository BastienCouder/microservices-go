# Go MCP Server Implementation Guide (Official SDK)

## Overview

This document provides Go-specific best practices and examples for implementing MCP servers using the **official Go SDK** (`github.com/modelcontextprotocol/go-sdk`), maintained in collaboration with Google. It covers project structure, server setup, tool registration patterns with typed structs, error handling, and complete working examples.

> **SDK Version**: v1.2.0+ supports MCP spec 2025-06-18, 2025-03-26, 2024-11-05

---

## Quick Reference

### Key Imports
```go
import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"

    "github.com/modelcontextprotocol/go-sdk/mcp"
)
```

### Server Initialization
```go
server := mcp.NewServer(&mcp.Implementation{
    Name:    "service-mcp-server",
    Version: "1.0.0",
}, nil)
```

### Tool Registration Pattern (Typed — Recommended)
```go
type Input struct {
    Param string `json:"param" jsonschema:"the input parameter"`
}

type Output struct {
    Result string `json:"result" jsonschema:"the output result"`
}

func MyHandler(ctx context.Context, req *mcp.CallToolRequest, in Input) (*mcp.CallToolResult, Output, error) {
    out := Output{Result: fmt.Sprintf("Processed: %s", in.Param)}
    return nil, out, nil
}

mcp.AddTool(server, &mcp.Tool{
    Name:        "tool_name",
    Description: "What the tool does",
}, MyHandler)
```

> The `mcp.AddTool` generic function **automatically infers input and output JSON schemas** from Go struct types using `jsonschema` struct tags. No manual schema definition needed.

---

## MCP Official Go SDK

The official SDK (`github.com/modelcontextprotocol/go-sdk/mcp`) provides:
- `mcp.NewServer()` for server initialization
- `mcp.AddTool()` generic function with **automatic schema inference** from Go types
- `server.AddTool()` for low-level tool registration with manual schemas
- `mcp.StdioTransport` and `mcp.StreamableHTTPHandler` for transports
- `server.AddResource()` / `server.AddResourceTemplate()` for resources
- `server.AddPrompt()` for prompts
- Built-in input validation via `jsonschema-go`

**IMPORTANT — Use the right API:**
- **DO use**: `mcp.AddTool(server, tool, typedHandler)` — typed, schema auto-inferred
- **DO use**: `server.AddTool(tool, handler)` — low-level, for custom/raw schemas
- **DO NOT use**: Manual JSON-RPC handlers or direct transport wiring
- **Prefer typed handlers** (`mcp.AddTool` with generics) — they validate input automatically

---

## Server Naming Convention

Official Go MCP servers must follow this naming pattern:
- **Format**: `{service}-mcp-server` (lowercase with hyphens)
- **Examples**: `github-mcp-server`, `stripe-mcp-server`, `notion-mcp-server`

---

## Project Structure

```
{service}-mcp-server/
├── go.mod
├── go.sum
├── README.md
├── main.go               # Entry point with server initialization
├── tools/                # Tool implementations (one file per domain)
│   ├── users.go
│   └── projects.go
├── services/             # API clients and shared utilities
│   └── client.go
├── types/                # Go struct definitions (Input/Output per tool)
│   └── types.go
└── constants/            # Shared constants
    └── constants.go
```

---

## Tool Implementation

### Tool Naming

Use `snake_case` for tool names with clear, action-oriented names.

**Avoid Naming Conflicts** — include the service context:
- Use `slack_send_message` instead of `send_message`
- Use `github_create_issue` instead of `create_issue`

### Schema Definition via Struct Tags

The official SDK uses Go structs with `json` and `jsonschema` tags to auto-generate schemas:

```go
type UserSearchInput struct {
    Query          string `json:"query"           jsonschema:"search string to match against names/emails,minLength=2,maxLength=200"`
    Limit          int    `json:"limit,omitempty" jsonschema:"maximum results to return (1-100),minimum=1,maximum=100"`
    Offset         int    `json:"offset,omitempty" jsonschema:"number of results to skip for pagination,minimum=0"`
    ResponseFormat string `json:"response_format,omitempty" jsonschema:"output format: markdown or json"`
}

type UserSearchOutput struct {
    Total      int    `json:"total"                 jsonschema:"total number of matches found"`
    Count      int    `json:"count"                 jsonschema:"number of results in this response"`
    Offset     int    `json:"offset"                jsonschema:"current pagination offset"`
    Users      []User `json:"users"                 jsonschema:"list of matching users"`
    HasMore    bool   `json:"has_more"              jsonschema:"whether more results are available"`
    NextOffset *int   `json:"next_offset,omitempty" jsonschema:"offset for next page if has_more is true"`
}
```

### Complete Tool Example

```go
// tools/users.go
package tools

import (
    "context"
    "fmt"
    "strings"

    "github.com/modelcontextprotocol/go-sdk/mcp"
    "{module}/services"
    "{module}/types"
)

func RegisterUserTools(s *mcp.Server) {
    mcp.AddTool(s, &mcp.Tool{
        Name: "example_search_users",
        Description: `Search for users in the Example system by name, email, or team.

This tool searches across all user profiles, supporting partial matches and filters.
It does NOT create or modify users, only searches existing ones.

Args:
  - query (string): Search string to match against names/emails (min 2, max 200 chars)
  - limit (int): Maximum results to return, between 1-100 (default: 20)
  - offset (int): Number of results to skip for pagination (default: 0)
  - response_format (string): 'markdown' or 'json' (default: 'markdown')

Returns:
  Structured data with total, count, offset, users list, has_more, next_offset.

Examples:
  - "Find marketing team members" -> query="team:marketing"
  - "Search for John's account"   -> query="john"
  - Don't use when: you need to create a user (use example_create_user instead)

Error Handling:
  - Returns error text on 429 (rate limit), 403 (permission denied), 404 (not found)`,
        Annotations: &mcp.ToolAnnotations{
            ReadOnlyHint:    boolPtr(true),
            DestructiveHint: boolPtr(false),
            IdempotentHint:  boolPtr(true),
            OpenWorldHint:   boolPtr(true),
        },
    }, searchUsersHandler)
}

func searchUsersHandler(
    ctx context.Context,
    req *mcp.CallToolRequest,
    in types.UserSearchInput,
) (*mcp.CallToolResult, types.UserSearchOutput, error) {
    // Apply defaults
    if in.Limit == 0 {
        in.Limit = 20
    }
    if in.ResponseFormat == "" {
        in.ResponseFormat = "markdown"
    }

    // Make API request
    data, err := services.SearchUsers(ctx, in.Query, in.Limit, in.Offset)
    if err != nil {
        // Return error as tool result (not Go error), so the LLM can self-correct
        return &mcp.CallToolResult{
            Content: []mcp.Content{
                &mcp.TextContent{Text: services.HandleAPIError(err)},
            },
            IsError: true,
        }, types.UserSearchOutput{}, nil
    }

    if len(data.Users) == 0 {
        return &mcp.CallToolResult{
            Content: []mcp.Content{
                &mcp.TextContent{Text: fmt.Sprintf("No users found matching '%s'", in.Query)},
            },
        }, types.UserSearchOutput{}, nil
    }

    // Build structured output
    hasMore := data.Total > in.Offset+len(data.Users)
    out := types.UserSearchOutput{
        Total:   data.Total,
        Count:   len(data.Users),
        Offset:  in.Offset,
        Users:   data.Users,
        HasMore: hasMore,
    }
    if hasMore {
        next := in.Offset + len(data.Users)
        out.NextOffset = &next
    }

    if in.ResponseFormat == "json" {
        // Return nil result — SDK auto-serializes Out to JSON text + structuredContent
        return nil, out, nil
    }

    // Markdown: override text content but keep structured output
    return &mcp.CallToolResult{
        Content: []mcp.Content{
            &mcp.TextContent{Text: formatUsersMarkdown(out, in.Query)},
        },
    }, out, nil
}

func formatUsersMarkdown(result types.UserSearchOutput, query string) string {
    lines := []string{
        fmt.Sprintf("# User Search Results: '%s'", query),
        "",
        fmt.Sprintf("Found %d users (showing %d)", result.Total, result.Count),
        "",
    }
    for _, u := range result.Users {
        lines = append(lines,
            fmt.Sprintf("## %s (%s)", u.Name, u.ID),
            fmt.Sprintf("- **Email**: %s", u.Email),
        )
        if u.Team != "" {
            lines = append(lines, fmt.Sprintf("- **Team**: %s", u.Team))
        }
        lines = append(lines, "")
    }
    return strings.Join(lines, "\n")
}

func boolPtr(b bool) *bool { return &b }
```

---

## Types Definition

```go
// types/types.go
package types

type User struct {
    ID     string `json:"id"`
    Name   string `json:"name"`
    Email  string `json:"email"`
    Team   string `json:"team,omitempty"`
    Active bool   `json:"active"`
}

type UserSearchInput struct {
    Query          string `json:"query"            jsonschema:"search string to match against names/emails"`
    Limit          int    `json:"limit,omitempty"  jsonschema:"maximum results to return (1-100)"`
    Offset         int    `json:"offset,omitempty" jsonschema:"number of results to skip for pagination"`
    ResponseFormat string `json:"response_format,omitempty" jsonschema:"output format: markdown or json"`
}

type UserSearchOutput struct {
    Total      int    `json:"total"`
    Count      int    `json:"count"`
    Offset     int    `json:"offset"`
    Users      []User `json:"users"`
    HasMore    bool   `json:"has_more"`
    NextOffset *int   `json:"next_offset,omitempty"`
}
```

---

## Shared Utilities

```go
// services/client.go
package services

import (
    "context"
    "errors"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "os"
    "time"
)

const APIBaseURL = "https://api.example.com/v1"

var httpClient = &http.Client{Timeout: 30 * time.Second}

// APIError represents an HTTP error from the upstream API.
type APIError struct {
    StatusCode int
}

func (e *APIError) Error() string {
    return fmt.Sprintf("API error: status %d", e.StatusCode)
}

func MakeAPIRequest(ctx context.Context, method, endpoint string, params url.Values) ([]byte, error) {
    reqURL := fmt.Sprintf("%s/%s", APIBaseURL, endpoint)
    if params != nil {
        reqURL += "?" + params.Encode()
    }

    req, err := http.NewRequestWithContext(ctx, method, reqURL, nil)
    if err != nil {
        return nil, err
    }
    req.Header.Set("Authorization", "Bearer "+os.Getenv("EXAMPLE_API_KEY"))
    req.Header.Set("Content-Type", "application/json")

    resp, err := httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        return nil, &APIError{StatusCode: resp.StatusCode}
    }

    return io.ReadAll(resp.Body)
}

// HandleAPIError returns a human-readable, actionable error string for the LLM.
func HandleAPIError(err error) string {
    var apiErr *APIError
    if errors.As(err, &apiErr) {
        switch apiErr.StatusCode {
        case 404:
            return "Error: Resource not found. Please check the ID is correct."
        case 403:
            return "Error: Permission denied. You don't have access to this resource."
        case 429:
            return "Error: Rate limit exceeded. Please wait before making more requests."
        default:
            return fmt.Sprintf("Error: API request failed with status %d", apiErr.StatusCode)
        }
    }
    return fmt.Sprintf("Error: Unexpected error occurred: %v", err)
}
```

---

## Character Limits and Truncation

```go
// constants/constants.go
package constants

const CharacterLimit = 25000
```

```go
import (
    "encoding/json"
    "fmt"
    "{module}/constants"
)

func truncateIfNeeded(items []Item, offset int) ([]Item, bool, string) {
    result, _ := json.Marshal(items)
    if len(result) <= constants.CharacterLimit {
        return items, false, ""
    }
    half := items[:max(1, len(items)/2)]
    msg := fmt.Sprintf(
        "Response truncated from %d to %d items. Use 'offset' parameter or add filters.",
        len(items), len(half),
    )
    return half, true, msg
}
```

---

## Pagination Implementation

```go
// services/pagination.go
package services

type PaginatedResult[T any] struct {
    Total      int  `json:"total"`
    Count      int  `json:"count"`
    Offset     int  `json:"offset"`
    Items      []T  `json:"items"`
    HasMore    bool `json:"has_more"`
    NextOffset *int `json:"next_offset,omitempty"`
}

func NewPaginatedResult[T any](items []T, total, offset int) PaginatedResult[T] {
    hasMore := total > offset+len(items)
    r := PaginatedResult[T]{
        Total:   total,
        Count:   len(items),
        Offset:  offset,
        Items:   items,
        HasMore: hasMore,
    }
    if hasMore {
        next := offset + len(items)
        r.NextOffset = &next
    }
    return r
}
```

---

## Transport Options

### stdio (Local Integrations)

```go
func runStdio(s *mcp.Server) error {
    if os.Getenv("EXAMPLE_API_KEY") == "" {
        return fmt.Errorf("EXAMPLE_API_KEY environment variable is required")
    }
    return s.Run(context.Background(), &mcp.StdioTransport{})
}
```

### Streamable HTTP (Remote Servers)

```go
import "github.com/modelcontextprotocol/go-sdk/mcp"

func runHTTP(s *mcp.Server) error {
    if os.Getenv("EXAMPLE_API_KEY") == "" {
        return fmt.Errorf("EXAMPLE_API_KEY environment variable is required")
    }

    handler := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
        return s // stateless: return same server for all requests
    }, nil)

    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }

    log.Printf("MCP server running on http://localhost:%s/mcp", port)
    return http.ListenAndServe(":"+port, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path == "/mcp" {
            handler.ServeHTTP(w, r)
            return
        }
        http.NotFound(w, r)
    }))
}
```

---

## Resource Registration

```go
// Register a static resource
s.AddResource(&mcp.Resource{
    URI:      "file:///documents/readme",
    Name:     "README",
    MIMEType: "text/plain",
}, func(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
    content, err := os.ReadFile("README.md")
    if err != nil {
        return nil, mcp.ResourceNotFoundError(req.Params.URI)
    }
    return &mcp.ReadResourceResult{
        Contents: []*mcp.ResourceContents{{
            URI:  req.Params.URI,
            Text: string(content),
        }},
    }, nil
})

// Register a resource template (URI pattern)
s.AddResourceTemplate(&mcp.ResourceTemplate{
    URITemplate: "file:///documents/{name}",
    Name:        "Document",
    MIMEType:    "text/plain",
}, func(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
    // Extract {name} from URI manually or via a URI template library
    name := extractNameFromURI(req.Params.URI)
    content, err := loadDocument(name)
    if err != nil {
        return nil, mcp.ResourceNotFoundError(req.Params.URI)
    }
    return &mcp.ReadResourceResult{
        Contents: []*mcp.ResourceContents{{URI: req.Params.URI, Text: content}},
    }, nil
})
```

---

## Complete main.go Example

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"

    "github.com/modelcontextprotocol/go-sdk/mcp"
    "{module}/tools"
)

func main() {
    s := mcp.NewServer(&mcp.Implementation{
        Name:    "example-mcp-server",
        Version: "1.0.0",
    }, nil)

    // Register all tool groups
    tools.RegisterUserTools(s)
    tools.RegisterProjectTools(s)

    transport := os.Getenv("TRANSPORT")

    var err error
    switch transport {
    case "http":
        err = runHTTP(s)
    default:
        err = runStdio(s)
    }

    if err != nil {
        log.Fatalf("Server error: %v", err)
    }
}

func runStdio(s *mcp.Server) error {
    if os.Getenv("EXAMPLE_API_KEY") == "" {
        log.Fatal("ERROR: EXAMPLE_API_KEY environment variable is required")
    }
    return s.Run(context.Background(), &mcp.StdioTransport{})
}

func runHTTP(s *mcp.Server) error {
    if os.Getenv("EXAMPLE_API_KEY") == "" {
        log.Fatal("ERROR: EXAMPLE_API_KEY environment variable is required")
    }

    handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server {
        return s
    }, nil)

    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }

    mux := http.NewServeMux()
    mux.Handle("/mcp", handler)

    log.Printf("MCP server running on http://localhost:%s/mcp", port)
    return http.ListenAndServe(":"+port, mux)
}
```

---

## go.mod Configuration

```
module github.com/yourorg/example-mcp-server

go 1.23

require (
    github.com/modelcontextprotocol/go-sdk v1.2.0
)
```

---

## Building and Running

```bash
# Download dependencies
go mod tidy

# Build binary
go build -o bin/server ./...

# Run stdio (local)
EXAMPLE_API_KEY=xxx ./bin/server

# Run HTTP (remote)
TRANSPORT=http PORT=3000 EXAMPLE_API_KEY=xxx ./bin/server

# Development with live reload (using air)
air
```

Always ensure `go build ./...` completes without errors before considering the implementation complete.

---

## Key Differences vs mcp-go (Community SDK)

| Feature | Official SDK (`go-sdk`) | Community (`mcp-go`) |
|---|---|---|
| Schema definition | Auto-inferred from Go structs via `jsonschema` tags | Manual option helpers (`mcp.WithString`, etc.) |
| Typed handlers | `mcp.AddTool[In, Out]` generic | `func(ctx, req) (*ToolResult, error)` |
| Output schema | Auto-inferred from `Out` type | Not supported natively |
| Maintained by | Anthropic + Google | Community (Ed Zynda) |
| Transport HTTP | `mcp.NewStreamableHTTPHandler` | `server.NewStreamableHTTPServer` |
| stdio | `s.Run(ctx, &mcp.StdioTransport{})` | `server.ServeStdio(s)` |

---

## Go Best Practices

1. **Use `context.Context`**: Pass context through all API calls for timeout/cancellation
2. **Typed tool handlers**: Always use `mcp.AddTool` with generics instead of `server.AddTool` unless you need raw schema control
3. **Return errors as tool results**: Use `IsError: true` in `CallToolResult` for user-facing errors — not Go `error` returns — so the LLM can self-correct
4. **`errors.As` / `errors.Is`**: Use for structured error inspection
5. **HTTP client reuse**: Initialize once at package level, never recreate per request
6. **`io.LimitReader`**: Wrap large API responses to prevent memory abuse
7. **`sync.Once` for init**: Use for one-time initialization of clients or config

---

## Quality Checklist

### Strategic Design
- [ ] Tools enable complete workflows, not just raw API endpoint wrappers
- [ ] Tool names use `snake_case` with service prefix (e.g., `example_search_users`)
- [ ] Response formats optimize for agent context efficiency
- [ ] Error messages guide agents toward correct usage

### Implementation Quality
- [ ] All tools registered via `mcp.AddTool()` with typed Input/Output structs
- [ ] `jsonschema` struct tags used to document all fields
- [ ] `ToolAnnotations` set (`ReadOnlyHint`, `DestructiveHint`, `IdempotentHint`, `OpenWorldHint`)
- [ ] Descriptions include return schema, usage examples, and error behavior
- [ ] User-facing errors returned as `CallToolResult{IsError: true}`, not Go `error`
- [ ] Defaults applied manually when struct fields are zero-valued

### Go Quality
- [ ] Structs defined in `types/` for all Input/Output per tool
- [ ] No use of `interface{}` where a concrete type is possible — use `any` only when truly dynamic
- [ ] All errors handled explicitly — no `_` discards on error returns
- [ ] HTTP client reused across requests (package-level `var`)
- [ ] `context.Context` propagated through all I/O operations
- [ ] `boolPtr()` helper used for `ToolAnnotations` pointer fields

### Project Configuration
- [ ] `go.mod` uses `github.com/modelcontextprotocol/go-sdk v1.2.0+`
- [ ] `go build ./...` completes without errors
- [ ] Binary entry point is `main.go` at project root
- [ ] Server name follows format: `{service}-mcp-server`
- [ ] `TRANSPORT` env var controls stdio vs HTTP mode
- [ ] `EXAMPLE_API_KEY` (or equivalent) validated on startup

### Code Quality
- [ ] Pagination implemented via generic `NewPaginatedResult[T]` helper
- [ ] `CharacterLimit` constant checked for large responses with truncation message
- [ ] All network calls use 30s timeout via shared `http.Client`
- [ ] Common functionality extracted into `services/` helpers
- [ ] Resource templates registered for URI-based data access where applicable

### Testing and Build
- [ ] `go build ./...` completes without errors
- [ ] Binary starts without crashing: `./bin/server`
- [ ] Sample tool calls return expected structure
- [ ] API key validation triggers on startup with clear error message