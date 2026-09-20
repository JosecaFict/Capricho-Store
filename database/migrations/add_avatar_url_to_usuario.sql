-- Migración: Adición de avatar_url a la tabla de usuarios
-- Ejecutable en PostgreSQL esquema 'capricho'
ALTER TABLE IF EXISTS capricho.usuario ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL;
