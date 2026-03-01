module github.com/bastiencouder/microservices-go/services/permission-service

go 1.25.7

require (
	github.com/bastiencouder/microservices-go/contracts v0.0.0
	github.com/golang-migrate/migrate/v4 v4.19.0
	github.com/jackc/pgx/v5 v5.7.6
	google.golang.org/grpc v1.67.0
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/prometheus/client_golang v1.23.2 // indirect
	golang.org/x/crypto v0.41.0 // indirect
	golang.org/x/net v0.43.0 // indirect
	golang.org/x/sync v0.16.0 // indirect
	golang.org/x/sys v0.35.0 // indirect
	golang.org/x/text v0.28.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240903143218-8af14fe29dc1 // indirect
	google.golang.org/protobuf v1.36.8 // indirect
)

replace github.com/bastiencouder/microservices-go/contracts => ../../contracts
