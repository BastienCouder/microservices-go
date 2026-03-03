module github.com/bastiencouder/microservices-go/services/auth-service

go 1.25.7

require (
	github.com/bastiencouder/microservices-go/contracts v0.0.0
	github.com/prometheus/client_golang v1.23.2 // indirect
)

replace github.com/bastiencouder/microservices-go/contracts => ../../contracts
