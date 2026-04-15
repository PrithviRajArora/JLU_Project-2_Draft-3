-- =============================================================================
-- JLU Marks Management System — PostgreSQL Schema
-- Generated from: jlu_marks/core/models.py
-- Django applies this automatically via: python manage.py migrate
-- =============================================================================


-- ── Users (Custom AbstractBaseUser) ──────────────────────────────────────────
CREATE TABLE users (
    id          SERIAL       PRIMARY KEY,
    jlu_id      VARCHAR(15)  NOT NULL UNIQUE,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(128) NOT NULL,   -- Django hash (PBKDF2 / Argon2)
    role        VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    is_staff    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ── Organisational Hierarchy ──────────────────────────────────────────────────

CREATE TABLE faculty_of (
    id         SERIAL       PRIMARY KEY,
    name       VARCHAR(150) NOT NULL UNIQUE,
    short_name VARCHAR(30),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE school (
    id            SERIAL       PRIMARY KEY,
    faculty_of_id INTEGER      NOT NULL REFERENCES faculty_of(id) ON DELETE RESTRICT,
    name          VARCHAR(150) NOT NULL UNIQUE,
    short_name    VARCHAR(30),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_school_faculty_of ON school(faculty_of_id);

CREATE TABLE program (
    id           SERIAL      PRIMARY KEY,
    school_id    INTEGER     NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
    name         VARCHAR(100) NOT NULL,
    short_name   VARCHAR(20)  NOT NULL,
    duration_yrs SMALLINT    NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, short_name)
);
CREATE INDEX idx_program_school ON program(school_id);


-- ── People ────────────────────────────────────────────────────────────────────

CREATE TABLE faculty (
    faculty_id VARCHAR(10)  PRIMARY KEY,
    user_id    INTEGER      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(150) NOT NULL,
    school_id  INTEGER      NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
    department VARCHAR(150),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_faculty_school ON faculty(school_id);

CREATE TABLE student (
    student_id    VARCHAR(10) PRIMARY KEY,
    user_id       INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    roll_no       VARCHAR(15) NOT NULL UNIQUE,
    gender        VARCHAR(6)  NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    program_id    INTEGER     NOT NULL REFERENCES program(id) ON DELETE RESTRICT,
    semester      SMALLINT    NOT NULL CHECK (semester BETWEEN 1 AND 12),
    section       VARCHAR(10),
    academic_year VARCHAR(9)  NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_student_program ON student(program_id);


-- ── Course Credit Register (CCR) ──────────────────────────────────────────────

CREATE TABLE ccr (
    course_code      VARCHAR(15)  PRIMARY KEY,
    course_name      VARCHAR(150) NOT NULL,
    course_type      VARCHAR(10)  NOT NULL
                     CHECK (course_type IN ('Foundation','Core','MD','SEC','AECC','OE')),
    faculty_id       VARCHAR(10)  NOT NULL REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    program_id       INTEGER      NOT NULL REFERENCES program(id) ON DELETE RESTRICT,
    semester         SMALLINT     NOT NULL CHECK (semester BETWEEN 1 AND 12),
    academic_year    VARCHAR(9)   NOT NULL,
    term             SMALLINT     NOT NULL,
    lecture_hrs      SMALLINT     NOT NULL DEFAULT 0,
    tutorial_hrs     SMALLINT     NOT NULL DEFAULT 0,
    practical_hrs    SMALLINT     NOT NULL DEFAULT 0,
    total_hrs        SMALLINT,                         -- auto-computed on save()
    credits          SMALLINT     NOT NULL,
    int_weightage    SMALLINT     NOT NULL CHECK (int_weightage  >= 0),
    ese_weightage    SMALLINT     NOT NULL CHECK (ese_weightage  >= 0),
    -- Business rule: int_weightage + ese_weightage = 100 (enforced in clean())
    ese_mode         VARCHAR(15)  NOT NULL
                     CHECK (ese_mode IN ('Written','Viva Voce','Coding Test','Practical')),
    ese_duration_hrs SMALLINT     NOT NULL DEFAULT 3,
    ese_max_marks    SMALLINT     NOT NULL DEFAULT 100,
    is_submitted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ccr_faculty  ON ccr(faculty_id);
CREATE INDEX idx_ccr_program  ON ccr(program_id);
CREATE INDEX idx_ccr_sem_year ON ccr(semester, academic_year);


-- ── Student Enrolment ─────────────────────────────────────────────────────────

CREATE TABLE student_enrolment (
    id            SERIAL      PRIMARY KEY,
    student_id    VARCHAR(10) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    course_code   VARCHAR(15) NOT NULL REFERENCES ccr(course_code)    ON DELETE RESTRICT,
    academic_year VARCHAR(9)  NOT NULL,
    enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_code, academic_year)
);
CREATE INDEX idx_enrolment_student ON student_enrolment(student_id);
CREATE INDEX idx_enrolment_course  ON student_enrolment(course_code);


-- ── IA Components ─────────────────────────────────────────────────────────────

CREATE TABLE ia_component (
    id          SERIAL       PRIMARY KEY,
    course_code VARCHAR(15)  NOT NULL REFERENCES ccr(course_code) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    weightage   NUMERIC(5,2) NOT NULL,
    max_marks   NUMERIC(6,2) NOT NULL,
    mode        VARCHAR(15)  NOT NULL
                CHECK (mode IN ('Online','Offline','Certificate','Hackathon')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (course_code, name)
);


-- ── Marks Entry ───────────────────────────────────────────────────────────────

CREATE TABLE marks_entry (
    id             SERIAL       PRIMARY KEY,
    student_id     VARCHAR(10)  NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    component_id   INTEGER      NOT NULL REFERENCES ia_component(id)    ON DELETE CASCADE,
    marks_obtained NUMERIC(6,2),
    scaled_marks   NUMERIC(6,2),   -- auto-computed: (marks_obtained / max_marks) * weightage
    entered_by     VARCHAR(10)  REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    entered_at     TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, component_id)
);
CREATE INDEX idx_marks_student   ON marks_entry(student_id);
CREATE INDEX idx_marks_component ON marks_entry(component_id);


-- ── Result Sheet ──────────────────────────────────────────────────────────────

CREATE TABLE result_sheet (
    id          SERIAL      PRIMARY KEY,
    student_id  VARCHAR(10) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    course_code VARCHAR(15) NOT NULL REFERENCES ccr(course_code)    ON DELETE RESTRICT,
    int_total   NUMERIC(6,2),
    ese_marks   NUMERIC(6,2),
    grand_total NUMERIC(6,2),
    pass_status VARCHAR(12) NOT NULL DEFAULT 'Incomplete'
                CHECK (pass_status IN ('Incomplete','Pass','Fail','Withheld')),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_code)
);
CREATE INDEX idx_result_student     ON result_sheet(student_id);
CREATE INDEX idx_result_course      ON result_sheet(course_code);
CREATE INDEX idx_result_pass_status ON result_sheet(pass_status);


-- ── Exam Attempts ─────────────────────────────────────────────────────────────

CREATE TABLE exam_attempt (
    id            SERIAL      PRIMARY KEY,
    student_id    VARCHAR(10) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    course_code   VARCHAR(15) NOT NULL REFERENCES ccr(course_code)    ON DELETE RESTRICT,
    attempt_type  VARCHAR(15) NOT NULL
                  CHECK (attempt_type IN ('Regular','Makeup','Backlog','SpecialBacklog')),
    attempt_no    SMALLINT    NOT NULL,   -- auto-incremented within (student, course)
    academic_year VARCHAR(9)  NOT NULL,
    conducted_on  DATE,
    ese_marks     NUMERIC(6,2),
    status        VARCHAR(12) NOT NULL DEFAULT 'Scheduled'
                  CHECK (status IN ('Scheduled','Appeared','Absent','Pass','Fail','Withheld')),
    remarks       TEXT,
    entered_by    VARCHAR(10) REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    entered_at    TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_code, attempt_type, attempt_no)
);
CREATE INDEX idx_attempt_student  ON exam_attempt(student_id);
CREATE INDEX idx_attempt_course   ON exam_attempt(course_code);
CREATE INDEX idx_attempt_type     ON exam_attempt(attempt_type);
CREATE INDEX idx_attempt_status   ON exam_attempt(status);
CREATE INDEX idx_attempt_year     ON exam_attempt(academic_year);


-- ── Student Backlogs ──────────────────────────────────────────────────────────

CREATE TABLE student_backlog (
    id                  SERIAL      PRIMARY KEY,
    student_id          VARCHAR(10) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    course_code         VARCHAR(15) NOT NULL REFERENCES ccr(course_code)    ON DELETE RESTRICT,
    reason              VARCHAR(10) NOT NULL CHECK (reason IN ('Failed','Absent','Detained')),
    origin_attempt_id   INTEGER     REFERENCES exam_attempt(id) ON DELETE SET NULL,
    clearing_attempt_id INTEGER     REFERENCES exam_attempt(id) ON DELETE SET NULL,
    status              VARCHAR(8)  NOT NULL DEFAULT 'Active'
                        CHECK (status IN ('Active','Cleared','Lapsed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_backlog_student_status ON student_backlog(student_id, status);
CREATE INDEX idx_backlog_course_status  ON student_backlog(course_code, status);


-- ── Course Exam Stats (denormalised, refreshed via signals/API) ───────────────

CREATE TABLE course_exam_stats (
    id               SERIAL       PRIMARY KEY,
    course_code      VARCHAR(15)  NOT NULL REFERENCES ccr(course_code) ON DELETE CASCADE,
    academic_year    VARCHAR(9)   NOT NULL,
    attempt_type     VARCHAR(15)  NOT NULL
                     CHECK (attempt_type IN ('Regular','Makeup','Backlog','SpecialBacklog')),
    total_registered INTEGER      NOT NULL DEFAULT 0,
    total_appeared   INTEGER      NOT NULL DEFAULT 0,
    total_absent     INTEGER      NOT NULL DEFAULT 0,
    total_pass       INTEGER      NOT NULL DEFAULT 0,
    total_fail       INTEGER      NOT NULL DEFAULT 0,
    total_withheld   INTEGER      NOT NULL DEFAULT 0,
    pass_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,   -- percentage
    avg_marks        NUMERIC(6,2),
    computed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (course_code, academic_year, attempt_type)
);
CREATE INDEX idx_stats_course_year ON course_exam_stats(course_code, academic_year);
