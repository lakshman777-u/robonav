import secrets
import hashlib
import hmac

def generate_api_key() -> tuple[str, str, str]:
    """Generates a new API key, its hash, and its prefix."""
    raw_key = secrets.token_urlsafe(32)
    full_key = f"rb_live_{raw_key}"
    
    key_prefix = full_key[:8]
    key_hash = hash_api_key(full_key)
    
    return full_key, key_hash, key_prefix

def hash_api_key(key: str) -> str:
    """Creates a SHA-256 hash of the API key."""
    return hashlib.sha256(key.encode()).hexdigest()

def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """Verifies a plain API key against its hashed version."""
    computed_hash = hash_api_key(plain_key)
    return hmac.compare_digest(computed_hash, hashed_key)
