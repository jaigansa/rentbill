# Step 1: Build the statically linked pure Go binary
FROM golang:1.24-alpine AS builder

WORKDIR /src

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source files
COPY . .

# Compile 100% static pure Go binary (zero CGO)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X 'main.Version=1.0.0'" -o /bin/rentbill .

# Step 2: Lightweight minimal runtime container
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /bin/rentbill /app/rentbill

# Create directory for persistent SQLite database
RUN mkdir -p /app/data
VOLUME /app/data

# Expose default HTTP port
EXPOSE 8080

# Run RentBill in container server mode
ENTRYPOINT ["/app/rentbill"]
CMD ["-server", "-db-path", "/app/data/rentbill.db", "-port", "8080", "-allow-remote"]
