# JLU Marks Management System — Entity Relationship Diagram

> Rendered automatically by GitHub. All 14 tables shown with columns, types, and relationships.

```mermaid
erDiagram

    USER {
        serial      id          PK
        varchar15   jlu_id      UK
        varchar100  first_name
        varchar100  last_name
        varchar150  email       UK
        varchar128  password
        varchar10   role
        boolean     is_active
        boolean     is_staff
        timestamptz created_at
    }

    FACULTY_OF {
        serial      id          PK
        varchar150  name        UK
        varchar30   short_name
        timestamptz created_at
    }

    SCHOOL {
        serial      id          PK
        int         faculty_of_id FK
        varchar150  name        UK
        varchar30   short_name
        timestamptz created_at
    }

    PROGRAM {
        serial      id          PK
        int         school_id   FK
        varchar100  name
        varchar20   short_name
        smallint    duration_yrs
        timestamptz created_at
    }

    FACULTY {
        varchar10   faculty_id  PK
        int         user_id     FK
        varchar150  name
        int         school_id   FK
        varchar150  department
        timestamptz created_at
    }

    STUDENT {
        varchar10   student_id  PK
        int         user_id     FK
        varchar15   roll_no     UK
        varchar6    gender
        int         program_id  FK
        smallint    semester
        varchar10   section
        varchar9    academic_year
        timestamptz created_at
    }

    CCR {
        varchar15   course_code     PK
        varchar150  course_name
        varchar10   course_type
        varchar10   faculty_id      FK
        int         program_id      FK
        smallint    semester
        varchar9    academic_year
        smallint    term
        smallint    lecture_hrs
        smallint    tutorial_hrs
        smallint    practical_hrs
        smallint    total_hrs
        smallint    credits
        smallint    int_weightage
        smallint    ese_weightage
        varchar15   ese_mode
        smallint    ese_duration_hrs
        smallint    ese_max_marks
        boolean     is_submitted
        timestamptz created_at
    }

    STUDENT_ENROLMENT {
        serial      id            PK
        varchar10   student_id    FK
        varchar15   course_code   FK
        varchar9    academic_year
        timestamptz enrolled_at
    }

    IA_COMPONENT {
        serial      id          PK
        varchar15   course_code FK
        varchar100  name
        numeric52   weightage
        numeric62   max_marks
        varchar15   mode
        timestamptz created_at
    }

    MARKS_ENTRY {
        serial      id             PK
        varchar10   student_id     FK
        int         component_id   FK
        numeric62   marks_obtained
        numeric62   scaled_marks
        varchar10   entered_by     FK
        timestamptz entered_at
        timestamptz updated_at
    }

    RESULT_SHEET {
        serial      id          PK
        varchar10   student_id  FK
        varchar15   course_code FK
        numeric62   int_total
        numeric62   ese_marks
        numeric62   grand_total
        varchar12   pass_status
        timestamptz computed_at
    }

    EXAM_ATTEMPT {
        serial      id            PK
        varchar10   student_id    FK
        varchar15   course_code   FK
        varchar15   attempt_type
        smallint    attempt_no
        varchar9    academic_year
        date        conducted_on
        numeric62   ese_marks
        varchar12   status
        varchar10   entered_by    FK
        timestamptz entered_at
        timestamptz updated_at
    }

    STUDENT_BACKLOG {
        serial      id                  PK
        varchar10   student_id          FK
        varchar15   course_code         FK
        varchar10   reason
        int         origin_attempt_id   FK
        int         clearing_attempt_id FK
        varchar8    status
        timestamptz created_at
        timestamptz updated_at
    }

    COURSE_EXAM_STATS {
        serial      id               PK
        varchar15   course_code      FK
        varchar9    academic_year
        varchar15   attempt_type
        int         total_registered
        int         total_appeared
        int         total_absent
        int         total_pass
        int         total_fail
        int         total_withheld
        numeric52   pass_rate
        numeric62   avg_marks
        timestamptz computed_at
    }

    %% ── Organisational hierarchy ──────────────────────────────────────────────
    FACULTY_OF      ||--o{ SCHOOL           : "has"
    SCHOOL          ||--o{ PROGRAM          : "offers"
    SCHOOL          ||--o{ FACULTY          : "employs"

    %% ── User profiles ─────────────────────────────────────────────────────────
    USER            ||--|| FACULTY          : "is a"
    USER            ||--|| STUDENT          : "is a"

    %% ── Programme & course assignment ─────────────────────────────────────────
    PROGRAM         ||--o{ STUDENT          : "has"
    FACULTY         ||--o{ CCR              : "teaches"
    PROGRAM         ||--o{ CCR              : "offers"

    %% ── Enrolment ─────────────────────────────────────────────────────────────
    STUDENT         ||--o{ STUDENT_ENROLMENT : "enrolled in"
    CCR             ||--o{ STUDENT_ENROLMENT : "has"

    %% ── IA & marks ────────────────────────────────────────────────────────────
    CCR             ||--o{ IA_COMPONENT     : "defines"
    STUDENT         ||--o{ MARKS_ENTRY      : "receives"
    IA_COMPONENT    ||--o{ MARKS_ENTRY      : "assessed by"
    FACULTY         ||--o{ MARKS_ENTRY      : "enters"

    %% ── Results ───────────────────────────────────────────────────────────────
    STUDENT         ||--o{ RESULT_SHEET     : "has"
    CCR             ||--o{ RESULT_SHEET     : "generates"

    %% ── Exam attempts & backlogs ──────────────────────────────────────────────
    STUDENT         ||--o{ EXAM_ATTEMPT     : "makes"
    CCR             ||--o{ EXAM_ATTEMPT     : "for"
    FACULTY         ||--o{ EXAM_ATTEMPT     : "records"
    STUDENT         ||--o{ STUDENT_BACKLOG  : "has"
    CCR             ||--o{ STUDENT_BACKLOG  : "from"
    EXAM_ATTEMPT    ||--o{ STUDENT_BACKLOG  : "creates"
    EXAM_ATTEMPT    ||--o{ STUDENT_BACKLOG  : "clears"

    %% ── Stats ─────────────────────────────────────────────────────────────────
    CCR             ||--o{ COURSE_EXAM_STATS : "summarised by"
```

---

## Table Summary

| Table | Rows (purpose) |
|---|---|
| `users` | Central auth — all roles share one table |
| `faculty_of` | Top-level organisational unit (e.g. Faculty of Engineering) |
| `school` | School within a Faculty-Of |
| `program` | Degree programme within a School |
| `faculty` | Faculty member profile linked to a User |
| `student` | Student profile linked to a User |
| `ccr` | Course Credit Register — one row per course offering |
| `student_enrolment` | Many-to-many between Student and CCR |
| `ia_component` | Internal Assessment component defined per course |
| `marks_entry` | Per-student, per-component marks (scaled automatically) |
| `result_sheet` | Aggregated result per student per course |
| `exam_attempt` | Every ESE sitting (Regular / Makeup / Backlog) |
| `student_backlog` | Active/cleared exam debts |
| `course_exam_stats` | Denormalised pass-rate stats, refreshed on demand |

## Key Business Rules

- `int_weightage + ese_weightage = 100` (enforced in `CCR.clean()`)
- `scaled_marks = (marks_obtained / max_marks) × weightage` (auto on `MarksEntry.save()`)
- `grand_total = int_total × (int_weightage/100) + ese_marks × (ese_weightage/100)` (on `ResultSheet.compute()`)
- A `ResultSheet` is created automatically when a student is enrolled (Django signal)
- `int_total` is recomputed automatically whenever a `MarksEntry` is saved or deleted (Django signal)
- `attempt_no` is auto-incremented within `(student, course)` on `ExamAttempt.save()`
