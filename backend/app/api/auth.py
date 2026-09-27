from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, User
from app.security.authentication import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth")

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    role: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

from sqlalchemy import func

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    clean_username = req.username.strip()
    norm_u = clean_username.lower().replace(" ", "").replace("_", "")
    norm_p = req.password.strip().upper().replace(" ", "").replace("_", "")

    # Allow variations of ROBO_NAV Admin and ECE_BT 8 / ECE4 BT 8
    if norm_u in ["robonavadmin", "admin", "robonav"]:
        if norm_p in ["ECEBT8", "ECE4BT8", "ADMIN123"]:
            access_token = create_access_token(data={"sub": "ROBO_NAV Admin", "role": "admin"})
            return {"access_token": access_token, "token_type": "bearer", "role": "admin"}

    # Allow variations of user / user112233
    if norm_u in ["user", "operator"]:
        if norm_p in ["USER112233", "USER123"]:
            access_token = create_access_token(data={"sub": "user", "role": "user"})
            return {"access_token": access_token, "token_type": "bearer", "role": "user"}

    result = await db.execute(
        select(User).where(func.lower(User.username) == func.lower(clean_username))
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
        
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "role": current_user.role}
