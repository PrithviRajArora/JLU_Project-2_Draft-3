from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator


# ── Enums (TextChoices) ───────────────────────────────────────────────────────

class RoleEnum(models.TextChoices):
    ADMIN   = 'admin',   'Admin'
    FACULTY = 'faculty', 'Faculty'
    STUDENT = 'student', 'Student'


class GenderEnum(models.TextChoices):
    MALE   = 'Male',   'Male'
    FEMALE = 'Female', 'Female'
    OTHER  = 'Other',  'Other'


class CourseTypeEnum(models.TextChoices):
    FOUNDATION = 'Foundation', 'Foundation'
    CORE       = 'Core',       'Core'
    MD         = 'MD',         'MD'
    SEC        = 'SEC',        'SEC'
    AECC       = 'AECC',       'AECC'
    OE         = 'OE',         'OE'


class ESEModeEnum(models.TextChoices):
    WRITTEN     = 'Written',     'Written'
    VIVA_VOCE   = 'Viva Voce',   'Viva Voce'
    CODING_TEST = 'Coding Test', 'Coding Test'
    PRACTICAL   = 'Practical',   'Practical'


class IAModeEnum(models.TextChoices):
    ONLINE      = 'Online',      'Online'
    OFFLINE     = 'Offline',     'Offline'
    CERTIFICATE = 'Certificate', 'Certificate'
    HACKATHON   = 'Hackathon',   'Hackathon'


class ExamAttemptTypeEnum(models.TextChoices):
    REGULAR        = 'Regular',        'Regular'
    MAKEUP         = 'Makeup',         'Makeup'
    BACKLOG        = 'Backlog',        'Backlog'
    SPECIAL_BACKLOG = 'SpecialBacklog', 'Special Backlog'


class ExamAttemptStatusEnum(models.TextChoices):
    SCHEDULED = 'Scheduled', 'Scheduled'
    APPEARED  = 'Appeared',  'Appeared'
    ABSENT    = 'Absent',    'Absent'
    PASS      = 'Pass',      'Pass'
    FAIL      = 'Fail',      'Fail'
    WITHHELD  = 'Withheld',  'Withheld'


class BacklogReasonEnum(models.TextChoices):
    FAILED   = 'Failed',   'Failed'
    ABSENT   = 'Absent',   'Absent'
    DETAINED = 'Detained', 'Detained'


class BacklogStatusEnum(models.TextChoices):
    ACTIVE  = 'Active',  'Active'
    CLEARED = 'Cleared', 'Cleared'
    LAPSED  = 'Lapsed',  'Lapsed'


class PassStatusEnum(models.TextChoices):
    INCOMPLETE = 'Incomplete', 'Incomplete'
    PASS       = 'Pass',       'Pass'
    FAIL       = 'Fail',       'Fail'
    WITHHELD   = 'Withheld',   'Withheld'


# ── Custom User Manager ───────────────────────────────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, jlu_id, email, first_name, last_name, role, password=None, **extra):
        if not jlu_id:
            raise ValueError('JLU ID is required')
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(
            jlu_id=jlu_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, jlu_id, email, first_name, last_name, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        # pop 'role' from extra if present to avoid passing it twice
        extra.pop('role', None)
        return self.create_user(jlu_id, email, first_name, last_name, RoleEnum.ADMIN, password, **extra)


# ── Users ─────────────────────────────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    """
    Central auth table. password_hash is handled by AbstractBaseUser.password
    (Django stores it as PBKDF2 / Argon2 etc. via set_password/check_password).
    """
    jlu_id     = models.CharField(max_length=15, unique=True)
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    email      = models.EmailField(max_length=150, unique=True)
    role       = models.CharField(max_length=10, choices=RoleEnum.choices)
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'jlu_id'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f'{self.jlu_id} — {self.first_name} {self.last_name}'


# ── Faculty Of (Top-level org unit) ──────────────────────────────────────────

class FacultyOf(models.Model):
    name       = models.CharField(max_length=150, unique=True)
    short_name = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'faculty_of'

    def __str__(self):
        return self.short_name or self.name


# ── School ────────────────────────────────────────────────────────────────────

class School(models.Model):
    faculty_of = models.ForeignKey(FacultyOf, on_delete=models.PROTECT, related_name='schools')
    name       = models.CharField(max_length=150, unique=True)
    short_name = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'school'
        indexes  = [models.Index(fields=['faculty_of'], name='idx_school_faculty_of')]

    def __str__(self):
        return self.short_name or self.name


# ── Program ───────────────────────────────────────────────────────────────────

class Program(models.Model):
    school       = models.ForeignKey(School, on_delete=models.PROTECT, related_name='programs')
    name         = models.CharField(max_length=100)
    short_name   = models.CharField(max_length=20)
    duration_yrs = models.SmallIntegerField()
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'program'
        unique_together = [('school', 'short_name')]
        indexes         = [models.Index(fields=['school'], name='idx_program_school')]

    def __str__(self):
        return f'{self.short_name} ({self.school})'


# ── Faculty ───────────────────────────────────────────────────────────────────

class Faculty(models.Model):
    faculty_id = models.CharField(max_length=10, primary_key=True)
    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='faculty_profile')
    name       = models.CharField(max_length=150)
    school     = models.ForeignKey(School, on_delete=models.PROTECT, related_name='faculty_members')
    department = models.CharField(max_length=150, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'faculty'
        indexes  = [models.Index(fields=['school'], name='idx_faculty_school')]
        verbose_name_plural = 'Faculty'

    def __str__(self):
        return f'{self.faculty_id} — {self.name}'


# ── Student ───────────────────────────────────────────────────────────────────

class Student(models.Model):
    student_id    = models.CharField(max_length=10, primary_key=True)
    user          = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    roll_no       = models.CharField(max_length=15, unique=True)
    gender        = models.CharField(max_length=6, choices=GenderEnum.choices)
    program       = models.ForeignKey(Program, on_delete=models.PROTECT, related_name='students')
    semester      = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    section       = models.CharField(max_length=10, blank=True, null=True)
    academic_year = models.CharField(max_length=9)   # e.g. "2024-2025"
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table    = 'student'
        indexes     = [models.Index(fields=['program'], name='idx_student_program')]
        constraints = [
            models.CheckConstraint(
                check=models.Q(semester__gte=1) & models.Q(semester__lte=12),
                name='student_semester_check',
            )
        ]

    def __str__(self):
        return f'{self.student_id} — {self.roll_no}'


# ── CCR (Course Credit Register) ──────────────────────────────────────────────

class CCR(models.Model):
    course_code    = models.CharField(max_length=15, primary_key=True)
    course_name    = models.CharField(max_length=150)
    course_type    = models.CharField(max_length=10, choices=CourseTypeEnum.choices)
    faculty        = models.ForeignKey(Faculty, on_delete=models.PROTECT, related_name='courses')
    program        = models.ForeignKey(Program, on_delete=models.PROTECT, related_name='courses')
    semester       = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    academic_year  = models.CharField(max_length=9)
    term           = models.SmallIntegerField()
    lecture_hrs    = models.SmallIntegerField(default=0)
    tutorial_hrs   = models.SmallIntegerField(default=0)
    practical_hrs  = models.SmallIntegerField(default=0)
    total_hrs      = models.SmallIntegerField(blank=True, null=True)
    credits        = models.SmallIntegerField()
    int_weightage  = models.SmallIntegerField()
    ese_weightage  = models.SmallIntegerField()
    ese_mode       = models.CharField(max_length=15, choices=ESEModeEnum.choices)
    ese_duration_hrs = models.SmallIntegerField(default=3)
    ese_max_marks  = models.SmallIntegerField(default=100)
    is_submitted   = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table    = 'ccr'
        indexes     = [
            models.Index(fields=['faculty'],              name='idx_ccr_faculty'),
            models.Index(fields=['program'],              name='idx_ccr_program'),
            models.Index(fields=['semester', 'academic_year'], name='idx_ccr_sem_year'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(semester__gte=1) & models.Q(semester__lte=12),
                name='ccr_semester_check',
            ),
            models.CheckConstraint(
                # int_weightage + ese_weightage = 100
                # Django doesn't support arithmetic in Q; we use a raw expression via F
                # Enforced in clean() below; DB constraint added in migration manually if needed.
                check=models.Q(int_weightage__gte=0) & models.Q(ese_weightage__gte=0),
                name='ccr_weightage_positive',
            ),
        ]

    def clean(self):
        if self.int_weightage is not None and self.ese_weightage is not None:
            if self.int_weightage + self.ese_weightage != 100:
                raise ValidationError(
                    {'ese_weightage': 'int_weightage + ese_weightage must equal 100.'}
                )

    def save(self, *args, **kwargs):
        # Auto-compute total_hrs
        self.total_hrs = (self.lecture_hrs or 0) + (self.tutorial_hrs or 0) + (self.practical_hrs or 0)
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.course_code} — {self.course_name}'


# ── Student Enrolment ─────────────────────────────────────────────────────────

class StudentEnrolment(models.Model):
    student       = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrolments')
    course        = models.ForeignKey(CCR, on_delete=models.PROTECT, related_name='enrolments')
    academic_year = models.CharField(max_length=9)
    enrolled_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'student_enrolment'
        unique_together = [('student', 'course', 'academic_year')]
        indexes         = [
            models.Index(fields=['student'], name='idx_enrolment_student'),
            models.Index(fields=['course'],  name='idx_enrolment_course'),
        ]

    def __str__(self):
        return f'{self.student_id} → {self.course_id}'


# ── IA Component ──────────────────────────────────────────────────────────────

class IAComponent(models.Model):
    course     = models.ForeignKey(CCR, on_delete=models.CASCADE, related_name='ia_components')
    name       = models.CharField(max_length=100)
    weightage  = models.DecimalField(max_digits=5, decimal_places=2)
    max_marks  = models.DecimalField(max_digits=6, decimal_places=2)
    mode       = models.CharField(max_length=15, choices=IAModeEnum.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'ia_component'
        unique_together = [('course', 'name')]

    def __str__(self):
        return f'{self.course_id} / {self.name}'


# ── Marks Entry ───────────────────────────────────────────────────────────────

class MarksEntry(models.Model):
    student        = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='marks_entries')
    component      = models.ForeignKey(IAComponent, on_delete=models.CASCADE, related_name='marks_entries')
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    scaled_marks   = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    entered_by     = models.ForeignKey(
        Faculty, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='entered_by', related_name='entered_marks'
    )
    entered_at     = models.DateTimeField(blank=True, null=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'marks_entry'
        unique_together = [('student', 'component')]
        indexes         = [
            models.Index(fields=['student'],   name='idx_marks_student'),
            models.Index(fields=['component'], name='idx_marks_component'),
        ]

    def save(self, *args, **kwargs):
        # Auto-compute scaled_marks from marks_obtained and component weightage
        if self.marks_obtained is not None and self.component_id:
            comp = self.component
            if comp.max_marks and comp.max_marks > 0:
                self.scaled_marks = (self.marks_obtained / comp.max_marks) * comp.weightage
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.student_id} / {self.component_id} = {self.marks_obtained}'


# ── Result Sheet ──────────────────────────────────────────────────────────────

class ResultSheet(models.Model):
    student      = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results')
    course       = models.ForeignKey(CCR, on_delete=models.PROTECT, related_name='results')
    int_total    = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    ese_marks    = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    grand_total  = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    pass_status  = models.CharField(
        max_length=12, choices=PassStatusEnum.choices,
        default=PassStatusEnum.INCOMPLETE,
    )
    computed_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'result_sheet'
        unique_together = [('student', 'course')]
        indexes         = [
            models.Index(fields=['student'],     name='idx_result_student'),
            models.Index(fields=['course'],      name='idx_result_course'),
            models.Index(fields=['pass_status'], name='idx_result_pass_status'),
        ]

    # Passing threshold — 40 % of grand total (configurable)
    PASS_THRESHOLD = 40

    def compute(self):
        """Aggregate IA scaled_marks and combine with ESE marks into grand_total."""
        entries = MarksEntry.objects.filter(
            student=self.student,
            component__course=self.course,
            scaled_marks__isnull=False,
        )
        self.int_total = sum(e.scaled_marks for e in entries)
        if self.int_total is not None and self.ese_marks is not None:
            course = self.course
            self.grand_total = (
                (self.int_total  * course.int_weightage  / 100) +
                (self.ese_marks  * course.ese_weightage  / 100)
            )
            if self.pass_status not in (PassStatusEnum.WITHHELD,):
                max_possible = course.ese_max_marks  # out of 100 effectively after scaling
                self.pass_status = (
                    PassStatusEnum.PASS if self.grand_total >= self.PASS_THRESHOLD
                    else PassStatusEnum.FAIL
                )
        self.save()

    def __str__(self):
        return f'{self.student_id} / {self.course_id} → {self.grand_total}'


# ── Exam Attempt ──────────────────────────────────────────────────────────────

class ExamAttempt(models.Model):
    """
    Records every ESE sitting for a student in a course.
    attempt_no is auto-assigned (1, 2, 3 …) within (student, course).
    """
    student       = models.ForeignKey(Student, on_delete=models.CASCADE,  related_name='exam_attempts')
    course        = models.ForeignKey(CCR,     on_delete=models.PROTECT,  related_name='exam_attempts')
    attempt_type  = models.CharField(max_length=15, choices=ExamAttemptTypeEnum.choices)
    attempt_no    = models.PositiveSmallIntegerField()          # auto-set in save()
    academic_year = models.CharField(max_length=9)
    conducted_on  = models.DateField(blank=True, null=True)
    ese_marks     = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    status        = models.CharField(
        max_length=12, choices=ExamAttemptStatusEnum.choices,
        default=ExamAttemptStatusEnum.SCHEDULED,
    )
    remarks       = models.TextField(blank=True, null=True)
    entered_by    = models.ForeignKey(
        Faculty, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='entered_by', related_name='entered_attempts',
    )
    entered_at    = models.DateTimeField(blank=True, null=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'exam_attempt'
        unique_together = [('student', 'course', 'attempt_type', 'attempt_no')]
        indexes         = [
            models.Index(fields=['student'],      name='idx_attempt_student'),
            models.Index(fields=['course'],       name='idx_attempt_course'),
            models.Index(fields=['attempt_type'], name='idx_attempt_type'),
            models.Index(fields=['status'],       name='idx_attempt_status'),
            models.Index(fields=['academic_year'],name='idx_attempt_year'),
        ]

    def save(self, *args, **kwargs):
        if not self.pk and not self.attempt_no:
            last = (
                ExamAttempt.objects
                .filter(student=self.student, course=self.course)
                .order_by('-attempt_no')
                .values_list('attempt_no', flat=True)
                .first()
            )
            self.attempt_no = (last or 0) + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f'{self.student_id} / {self.course_id} '
            f'[{self.attempt_type} #{self.attempt_no}] → {self.status}'
        )


# ── Student Backlog ───────────────────────────────────────────────────────────

class StudentBacklog(models.Model):
    """
    Represents one uncleared exam debt for a student in a course.
    Created automatically when an ExamAttempt resolves to Fail/Absent.
    Cleared automatically when a subsequent ExamAttempt resolves to Pass.
    """
    student          = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='backlogs')
    course           = models.ForeignKey(CCR,     on_delete=models.PROTECT, related_name='backlogs')
    reason           = models.CharField(max_length=10, choices=BacklogReasonEnum.choices)
    origin_attempt   = models.ForeignKey(
        ExamAttempt, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_backlogs',
    )
    clearing_attempt = models.ForeignKey(
        ExamAttempt, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cleared_backlogs',
    )
    status     = models.CharField(
        max_length=8, choices=BacklogStatusEnum.choices,
        default=BacklogStatusEnum.ACTIVE,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_backlog'
        indexes  = [
            models.Index(fields=['student', 'status'], name='idx_backlog_student_status'),
            models.Index(fields=['course',  'status'], name='idx_backlog_course_status'),
        ]

    def __str__(self):
        return f'{self.student_id} / {self.course_id} [{self.reason}] — {self.status}'


# ── Course Exam Stats ─────────────────────────────────────────────────────────

class CourseExamStats(models.Model):
    """
    Denormalised statistics per (course, academic_year, attempt_type).
    Refreshed by a signal or an explicit API action.
    """
    course         = models.ForeignKey(CCR, on_delete=models.CASCADE, related_name='exam_stats')
    academic_year  = models.CharField(max_length=9, db_index=True)
    attempt_type   = models.CharField(max_length=15, choices=ExamAttemptTypeEnum.choices)
    total_registered = models.PositiveIntegerField(default=0)
    total_appeared   = models.PositiveIntegerField(default=0)
    total_absent     = models.PositiveIntegerField(default=0)
    total_pass       = models.PositiveIntegerField(default=0)
    total_fail       = models.PositiveIntegerField(default=0)
    total_withheld   = models.PositiveIntegerField(default=0)
    pass_rate        = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # %
    avg_marks        = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    computed_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'course_exam_stats'
        unique_together = [('course', 'academic_year', 'attempt_type')]
        indexes         = [
            models.Index(fields=['course', 'academic_year'], name='idx_stats_course_year'),
        ]

    @classmethod
    def refresh_for(cls, course, academic_year, attempt_type):
        """Recompute and upsert stats for a given slice."""
        from django.db.models import Avg, Count, Q
        qs = ExamAttempt.objects.filter(
            course=course, academic_year=academic_year, attempt_type=attempt_type,
        )
        agg = qs.aggregate(
            total_registered = Count('id'),
            total_appeared   = Count('id', filter=Q(status=ExamAttemptStatusEnum.APPEARED)),
            total_absent     = Count('id', filter=Q(status=ExamAttemptStatusEnum.ABSENT)),
            total_pass       = Count('id', filter=Q(status=ExamAttemptStatusEnum.PASS)),
            total_fail       = Count('id', filter=Q(status=ExamAttemptStatusEnum.FAIL)),
            total_withheld   = Count('id', filter=Q(status=ExamAttemptStatusEnum.WITHHELD)),
            avg_marks        = Avg('ese_marks', filter=Q(status__in=[
                ExamAttemptStatusEnum.PASS, ExamAttemptStatusEnum.FAIL,
            ])),
        )
        appeared = agg['total_appeared'] or 0
        passed   = agg['total_pass'] or 0
        pass_rate = round((passed / appeared * 100), 2) if appeared > 0 else 0

        obj, _ = cls.objects.update_or_create(
            course=course, academic_year=academic_year, attempt_type=attempt_type,
            defaults={**agg, 'pass_rate': pass_rate},
        )
        return obj

    def __str__(self):
        return f'{self.course_id} / {self.academic_year} / {self.attempt_type} — {self.pass_rate}%'
