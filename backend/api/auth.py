"""
NeuralForge — Auth API Routes
OAuth login/callback for Google and GitHub, JWT token management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
import hashlib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import (
    create_access_token,
    exchange_github_code,
    exchange_google_code,
    get_current_user_id,
)
from core.config import get_settings
from models.user import User
from schemas import TokenResponse, UserResponse, OAuthCallback

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@router.post("/register", response_model=TokenResponse)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with email and password."""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )
    
    user = User(
        email=user_in.email,
        name=user_in.name,
        provider="email",
        password_hash=hash_password(user_in.password)
    )
    db.add(user)
    await db.flush()
    
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )

@router.post("/token", response_model=TokenResponse)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 compatible token login, get an access token for future requests."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or user.provider != "email":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.password_hash != hash_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )



@router.get("/providers")
async def get_providers():
    """Return available OAuth providers."""
    providers = []
    if settings.google_client_id:
        providers.append({
            "id": "google",
            "name": "Google",
            "auth_url": (
                f"https://accounts.google.com/o/oauth2/v2/auth"
                f"?client_id={settings.google_client_id}"
                f"&redirect_uri={settings.frontend_url}/api/auth/callback/google"
                f"&response_type=code"
                f"&scope=openid email profile"
                f"&access_type=offline"
            ),
        })
    if settings.github_client_id:
        providers.append({
            "id": "github",
            "name": "GitHub",
            "auth_url": (
                f"https://github.com/login/oauth/authorize"
                f"?client_id={settings.github_client_id}"
                f"&redirect_uri={settings.frontend_url}/api/auth/callback/github"
                f"&scope=user:email"
            ),
        })
    return {"providers": providers}
@router.get("/login/{provider}")
async def login_provider(provider: str):
    """Redirect to OAuth provider login page."""
    if provider == "google" and settings.google_client_id:
        url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={settings.google_client_id}"
            f"&redirect_uri={settings.frontend_url}/api/auth/callback/google"
            f"&response_type=code"
            f"&scope=openid email profile"
            f"&access_type=offline"
        )
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)
    elif provider == "github" and settings.github_client_id:
        url = (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={settings.github_client_id}"
            f"&redirect_uri={settings.frontend_url}/api/auth/callback/github"
            f"&scope=user:email"
        )
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)
    
    raise HTTPException(status_code=404, detail=f"Provider {provider} not configured")

@router.post("/callback/{provider}", response_model=TokenResponse)
async def oauth_callback(
    provider: str,
    body: OAuthCallback,
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth callback and return JWT token."""
    if provider == "google":
        user_info = await exchange_google_code(body.code)
        email = user_info.get("email")
        name = user_info.get("name", email)
        avatar = user_info.get("picture")
        provider_id = user_info.get("id")
    elif provider == "github":
        user_info = await exchange_github_code(body.code)
        email = user_info.get("email")
        name = user_info.get("name") or user_info.get("login", email)
        avatar = user_info.get("avatar_url")
        provider_id = str(user_info.get("id"))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}",
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not retrieve email from OAuth provider",
        )

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            avatar_url=avatar,
            provider=provider,
            provider_id=provider_id,
        )
        db.add(user)
        await db.flush()

    # Create JWT
    access_token = create_access_token(data={"sub": user.id, "email": user.email})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(user)
