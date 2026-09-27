import asyncio
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, DateTime, LargeBinary, ForeignKey
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Robot(Base):
    __tablename__ = "robots"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    robot_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    api_key_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    api_key_prefix: Mapped[str] = mapped_column(String(8), nullable=True)
    connection_status: Mapped[str] = mapped_column(String(50), default="offline")
    last_heartbeat: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    firmware_version: Mapped[str] = mapped_column(String(50), nullable=True)

class Map(Base):
    __tablename__ = "maps"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    map_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    resolution: Mapped[float] = mapped_column(Float, default=0.05)
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    origin_x: Mapped[float] = mapped_column(Float, default=0.0)
    origin_y: Mapped[float] = mapped_column(Float, default=0.0)
    occupancy_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)
    start_position_x: Mapped[float] = mapped_column(Float, default=0.0)
    start_position_y: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="building")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Destination(Base):
    __tablename__ = "destinations"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    dest_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(50), default="waypoint")
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    map_id: Mapped[Optional[int]] = mapped_column(ForeignKey("maps.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class NavigationRequest(Base):
    __tablename__ = "navigation_requests"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    destination_id: Mapped[int] = mapped_column(ForeignKey("destinations.id"))
    robot_id: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

class NavigationHistory(Base):
    __tablename__ = "navigation_history"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int] = mapped_column(Integer)
    username: Mapped[str] = mapped_column(String(255))
    destination_name: Mapped[str] = mapped_column(String(255))
    distance: Mapped[float] = mapped_column(Float)
    duration: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(50))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SystemLog(Base):
    __tablename__ = "system_logs"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    event_type: Mapped[str] = mapped_column(String(50))
    robot_id: Mapped[str] = mapped_column(String(50), nullable=True)
    user: Mapped[str] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(String(1000))
    level: Mapped[str] = mapped_column(String(50), default="info")

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_data()

async def seed_data():
    from app.security.authentication import hash_password
    from app.security.api_keys import hash_api_key
    from sqlalchemy.future import select
    async with AsyncSessionLocal() as session:
        # Create or update admin
        result = await session.execute(
            select(User).where(User.username.in_(["admin", "ROBO_NAV Admin"]))
        )
        existing_admin = result.scalar_one_or_none()
        if not existing_admin:
            admin = User(username="admin", password_hash=hash_password("admin123"), role="admin")
            session.add(admin)
        else:
            existing_admin.username = "admin"
            existing_admin.password_hash = hash_password("admin123")
            existing_admin.role = "admin"
        
        # Create or update user
        result = await session.execute(
            select(User).where(User.username == "user")
        )
        existing_user = result.scalar_one_or_none()
        if not existing_user:
            user = User(username="user", password_hash=hash_password("user123"), role="user")
            session.add(user)
        else:
            existing_user.username = "user"
            existing_user.password_hash = hash_password("user123")
            existing_user.role = "user"
            
        # Create robot
        result = await session.execute(
            select(Robot).where(Robot.robot_id == "ROBOT-001")
        )
        if not result.scalar_one_or_none():
            robot = Robot(
                robot_id="ROBOT-001",
                name="Raspberry Pi Robot 01",
                api_key_hash=hash_api_key("demo_key_12345"),
                api_key_prefix="demo_key"
            )
            session.add(robot)
            
        await session.commit()
