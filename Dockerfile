FROM golang:1.26.0-alpine3.23 AS dev

WORKDIR /workspace

RUN apk --no-cache add git && go install github.com/air-verse/air@v1.61.7

CMD ["air", "-v"]

FROM golang:1.26.0-alpine3.23 AS builder

ARG SERVICE_PATH

WORKDIR /usr/src/app

COPY services ./services

RUN cd services && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /usr/src/app/bin/service ./${SERVICE_PATH}

FROM alpine:3.23 AS certs

RUN apk --no-cache add ca-certificates

FROM scratch

COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/src/app/bin/service /app/service

ENTRYPOINT ["/app/service"]
