use argon2::{Argon2, Algorithm, Version, Params};
use wasm_bindgen::prelude::*;


/// Derive a 32-byte root secret from a passphrase and salt using Argon2id.
///
/// Parameters: 128 MiB memory, 3 iterations, 1 lane.
/// These match OWASP recommendations for interactive login.
#[wasm_bindgen(js_name = "deriveRootSecret")]
pub fn derive_root_secret(passphrase: &str, salt: &[u8]) -> Result<Vec<u8>, JsError> {
    let params = Params::new(
        128 * 1024, // 128 MiB in KiB
        3,          // iterations
        1,          // parallelism (1 lane — WASM is single-threaded)
        Some(32),   // output length
    )
    .map_err(|e| JsError::new(&format!("argon2 params: {e}")))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut output = vec![0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut output)
        .map_err(|e| JsError::new(&format!("argon2 hash: {e}")))?;

    // The passphrase bytes are borrowed, so we can't zeroize them here.
    // The caller is responsible for clearing the JS string.
    // output will be moved to JS and GC'd there.
    Ok(output)
}

/// Generate a 16-byte random salt suitable for Argon2.
#[wasm_bindgen(js_name = "generateSalt")]
pub fn generate_salt() -> Result<Vec<u8>, JsError> {
    let mut salt = vec![0u8; 16];
    getrandom::getrandom(&mut salt)
        .map_err(|e| JsError::new(&format!("getrandom: {e}")))?;
    Ok(salt)
}
