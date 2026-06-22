## syntax=docker/dockerfile:1.7

FROM golang:1.26.0-alpine3.23 AS dev

WORKDIR /workspace

RUN apk --no-cache add git && go install github.com/air-verse/air@v1.61.7

CMD ["air", "-v"]

FROM golang:1.26.0-alpine3.23 AS builder

ARG SERVICE_PATH
ENV GOPROXY=https://proxy.golang.org,direct
ENV GODEBUG=netdns=cgo

WORKDIR /usr/src/app

RUN apk --no-cache add git

COPY services ./services

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd services && \
    go mod download

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd services && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /usr/src/app/bin/service ./${SERVICE_PATH}

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/src/app/bin/service /app/service

ENTRYPOINT ["/app/service"]
