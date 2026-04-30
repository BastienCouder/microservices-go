module github.com/bastiencouder/microservices-go/services/organizations-service

go 1.25.7

require github.com/jackc/pgx/v5 v5.7.6

require (
	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/lib/pq v1.10.9 // indirect
	github.com/rabbitmq/amqp091-go v1.10.0
)

require (
	github.com/Masterminds/squirrel v1.5.4
	github.com/bastiencouder/microservices-go/contracts v0.0.0
	github.com/golang-migrate/migrate/v4 v4.19.0
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/lann/builder v0.0.0-20180802200727-47ae307949d0 // indirect
	github.com/lann/ps v0.0.0-20150810152359-62de8c46ede0 // indirect
	golang.org/x/crypto v0.37.0 // indirect
	golang.org/x/sync v0.13.0 // indirect
	golang.org/x/text v0.24.0 // indirect
)

replace github.com/bastiencouder/microservices-go/contracts => ../../contracts
