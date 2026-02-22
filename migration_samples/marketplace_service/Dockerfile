FROM rust:1.70 as builder
WORKDIR /usr/src/app
COPY . .
RUN apt-get update && apt-get install -y protobuf-compiler
RUN cargo build --release

FROM debian:buster-slim
COPY --from=builder /usr/src/app/target/release/stellara-marketplace /usr/local/bin/stellara-marketplace
EXPOSE 8080 50051
CMD ["/usr/local/bin/stellara-marketplace"]
