module github.com/bastiencouder/microservices-go/services/api-gateway

go 1.25.7

require (
	github.com/bastiencouder/microservices-go/contracts v0.0.0
	google.golang.org/grpc v1.67.0
)

require (
	github.com/prometheus/client_golang v1.23.2 // indirect
	golang.org/x/net v0.43.0 // indirect
	golang.org/x/sys v0.35.0 // indirect
	golang.org/x/text v0.28.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240814211410-ddb44dafa142 // indirect
	google.golang.org/protobuf v1.36.8 // indirect
)

replace github.com/bastiencouder/microservices-go/contracts => ../../contracts
