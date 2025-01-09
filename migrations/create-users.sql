CREATE TABLE IF NOT EXISTS users (
    app_id INTEGER PRIMARY KEY, -- will auto increment since it's int primary key
    user_id TEXT UNIQUE, -- unique constraint so we can use this as a foreign key
    name TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);