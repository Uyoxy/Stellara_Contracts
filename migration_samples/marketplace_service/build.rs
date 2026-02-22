fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .compile(&["../proto/marketplace.proto", "../proto/event.proto"], &["../proto"]) ?;
    Ok(())
}
