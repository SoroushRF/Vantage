# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod and sum files
COPY go.mod ./
# Note: go.sum is missing currently, but go mod download will create it if we had internet
# For now, we'll just copy what we have
RUN go mod download || true

# Copy source code
COPY . .

# Build the application
# We use -tags osusergo,netgo and -ldflags '-w -s -extldflags "-static"' for a truly static binary
RUN CGO_ENABLED=1 GOOS=linux go build -a -tags osusergo,netgo -ldflags '-w -s -extldflags "-static"' -o vantage cmd/server/main.go

# Production stage
FROM gcr.io/distroless/static-debian12:latest-amd64

WORKDIR /

# Copy the binary from the builder
COPY --from=builder /app/vantage /vantage
COPY --from=builder /app/.env /.env

# Expose port
EXPOSE 8080

# Run the binary
ENTRYPOINT ["/vantage"]
