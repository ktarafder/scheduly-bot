CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY,
    userId TEXT NOT NULL,
    day TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    is_free BOOLEAN DEFAULT FALSE,
    course_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(user_id) ON DELETE CASCADE, -- cascade deletes if user is deleted
    CHECK (start_time >= 0 AND start_time < 1440), -- 1440 is the number of minutes in a day
    CHECK (end_time > 0 AND end_time <= 1440), -- 1440 is the number of minutes in a day
    CHECK (start_time < end_time) -- start time must be before end time
);