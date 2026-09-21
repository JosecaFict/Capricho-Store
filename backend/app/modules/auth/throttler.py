from __future__ import annotations

import hashlib
import time
from typing import Protocol

from redis.asyncio import Redis


def email_storage_key(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


class LoginThrottler(Protocol):
    async def get_cooldown_remaining(self, email: str) -> int | None:
        """Devuelve los segundos restantes de enfriamiento o None si no está en pausa."""
        ...

    async def record_failed_attempt(self, email: str) -> tuple[int, int | None]:
        """
        Registra un intento fallido.
        Retorna (total_intentos, segundos_de_pausa_si_aplica).
        - Intento 3 -> (3, 60) (1 minuto)
        - Intento 6 -> (6, 300) (5 minutos)
        - Intento 9+ -> (9, None) (bloqueo permanente a manejar en BD)
        """
        ...

    async def clear(self, email: str) -> None:
        """Limpia los intentos fallidos y pausas activas para el correo."""
        ...


class RedisLoginThrottler:
    def __init__(self, client: Redis) -> None:
        self.client = client

    @staticmethod
    def _attempts_key(email_key: str) -> str:
        return f"auth:login:attempts:{email_key}"

    @staticmethod
    def _cooldown_key(email_key: str) -> str:
        return f"auth:login:cooldown:{email_key}"

    async def get_cooldown_remaining(self, email: str) -> int | None:
        email_key = email_storage_key(email)
        ttl = await self.client.ttl(self._cooldown_key(email_key))
        return ttl if ttl > 0 else None

    async def record_failed_attempt(self, email: str) -> tuple[int, int | None]:
        email_key = email_storage_key(email)
        attempts_key = self._attempts_key(email_key)
        cooldown_key = self._cooldown_key(email_key)

        pipe = self.client.pipeline()
        pipe.incr(attempts_key)
        pipe.expire(attempts_key, 86400)
        results = await pipe.execute()
        attempts = int(results[0])

        if attempts == 3:
            await self.client.set(cooldown_key, "1", ex=60)
            return (attempts, 60)
        if attempts == 6:
            await self.client.set(cooldown_key, "2", ex=300)
            return (attempts, 300)

        return (attempts, None)

    async def clear(self, email: str) -> None:
        email_key = email_storage_key(email)
        await self.client.delete(self._attempts_key(email_key), self._cooldown_key(email_key))


class InMemoryLoginThrottler:
    """Implementación en memoria para entornos de testing y desarrollo local sin Redis."""

    def __init__(self) -> None:
        self._attempts: dict[str, tuple[int, float]] = {}  # key -> (count, expire_at)
        self._cooldowns: dict[str, float] = {}  # key -> expire_at

    async def get_cooldown_remaining(self, email: str) -> int | None:
        email_key = email_storage_key(email)
        now = time.monotonic()
        expire_at = self._cooldowns.get(email_key)
        if expire_at is not None:
            if expire_at > now:
                return max(1, int(expire_at - now))
            del self._cooldowns[email_key]
        return None

    async def record_failed_attempt(self, email: str) -> tuple[int, int | None]:
        email_key = email_storage_key(email)
        now = time.monotonic()

        current_count, expire_at = self._attempts.get(email_key, (0, 0.0))
        if expire_at < now:
            current_count = 0

        current_count += 1
        self._attempts[email_key] = (current_count, now + 86400.0)

        if current_count == 3:
            self._cooldowns[email_key] = now + 60.0
            return (current_count, 60)
        if current_count == 6:
            self._cooldowns[email_key] = now + 300.0
            return (current_count, 300)

        return (current_count, None)

    async def clear(self, email: str) -> None:
        email_key = email_storage_key(email)
        self._attempts.pop(email_key, None)
        self._cooldowns.pop(email_key, None)
