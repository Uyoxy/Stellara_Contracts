use std::net::SocketAddr;
use tonic::{transport::Server, Request, Response, Status};
use prost_types::Timestamp;
use tracing_subscriber;

pub mod marketplace {
    tonic::include_proto!("stellara.marketplace");
}

use marketplace::{marketplace_server::{Marketplace, MarketplaceServer}, CreateListingReq, CreateListingRes, GetListingReq, GetListingRes, Listing };

#[derive(Default)]
pub struct MarketplaceService {}

#[tonic::async_trait]
impl Marketplace for MarketplaceService {
    async fn create_listing(&self, req: Request<CreateListingReq>) -> Result<Response<CreateListingRes>, Status> {
        let listing = req.into_inner().listing.unwrap_or(Listing { id: "gen-1".into(), seller_id: "unknown".into(), title: "(empty)".into(), description: "".into(), price_cents: 0, currency: "USD".into(), created_at: None });
        Ok(Response::new(CreateListingRes { listing: Some(listing) }))
    }

    async fn get_listing(&self, req: Request<GetListingReq>) -> Result<Response<GetListingRes>, Status> {
        let id = req.into_inner().id;
        let listing = Listing { id: id.clone(), seller_id: "seller-1".into(), title: "Sample".into(), description: "Sample listing".into(), price_cents: 1000, currency: "USD".into(), created_at: Some(Timestamp { seconds: 0, nanos: 0 }) };
        Ok(Response::new(GetListingRes { listing: Some(listing) }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    // Start tonic gRPC server
    let grpc_addr: SocketAddr = "0.0.0.0:50051".parse().unwrap();
    let marketplace = MarketplaceService::default();

    // Axum HTTP shim for external API
    let http_addr: SocketAddr = "0.0.0.0:8080".parse().unwrap();

    let grpc_server = tokio::spawn(async move {
        Server::builder()
            .add_service(MarketplaceServer::new(marketplace))
            .serve(grpc_addr)
            .await
            .unwrap();
    });

    let app = axum::Router::new()
        .route("/health", axum::routing::get(|| async { "ok" }))
        .route("/listings/:id", axum::routing::get(|axum::extract::Path(id): axum::extract::Path<String>| async move { format!("listing {}", id) }));

    let http_server = tokio::spawn(async move {
        axum::Server::bind(&http_addr)
            .serve(app.into_make_service())
            .await
            .unwrap();
    });

    tokio::try_join!(grpc_server, http_server)?;
    Ok(())
}
