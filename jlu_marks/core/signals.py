"""
Signals
───────
1. StudentEnrolment post_save  → create ResultSheet row automatically
2. MarksEntry post_save/delete → recompute ResultSheet.int_total
3. ExamAttempt post_save       →
     • Pass   : update ResultSheet.ese_marks + pass_status, clear Active backlogs
     • Fail   : create / keep Active StudentBacklog (reason=Failed)
     • Absent : create / keep Active StudentBacklog (reason=Absent)
     • Any    : refresh CourseExamStats slice
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import (
    StudentEnrolment, MarksEntry, ResultSheet,
    ExamAttempt, StudentBacklog, CourseExamStats,
    ExamAttemptStatusEnum, BacklogReasonEnum, BacklogStatusEnum, PassStatusEnum,
)


# ── 1. Auto-create ResultSheet on enrolment ───────────────────────────────────

@receiver(post_save, sender=StudentEnrolment)
def create_result_sheet_on_enrolment(sender, instance, created, **kwargs):
    if created:
        ResultSheet.objects.get_or_create(
            student=instance.student,
            course=instance.course,
        )


# ── 2. Recompute int_total whenever a MarksEntry is saved or deleted ──────────

def _recompute_for_entry(entry: MarksEntry):
    """Find the ResultSheet for this student+course and recompute int_total."""
    from django.db.models import Sum
    course = entry.component.course
    try:
        sheet = ResultSheet.objects.get(student=entry.student, course=course)
    except ResultSheet.DoesNotExist:
        sheet = ResultSheet.objects.create(student=entry.student, course=course)

    agg = MarksEntry.objects.filter(
        student=entry.student,
        component__course=course,
        scaled_marks__isnull=False,
    ).aggregate(total=Sum('scaled_marks'))

    int_total = agg['total'] or 0
    grand_total = sheet.grand_total

    if sheet.ese_marks is not None:
        grand_total = (
            int_total * course.int_weightage / 100 +
            sheet.ese_marks * course.ese_weightage / 100
        )

    ResultSheet.objects.filter(pk=sheet.pk).update(
        int_total=int_total,
        grand_total=grand_total,
    )


@receiver(post_save, sender=MarksEntry)
def recompute_result_on_marks_save(sender, instance, **kwargs):
    _recompute_for_entry(instance)


@receiver(post_delete, sender=MarksEntry)
def recompute_result_on_marks_delete(sender, instance, **kwargs):
    _recompute_for_entry(instance)


# ── 3. ExamAttempt post_save ──────────────────────────────────────────────────

@receiver(post_save, sender=ExamAttempt)
def handle_exam_attempt_saved(sender, instance, created, **kwargs):
    """
    Central handler for exam attempt status changes.
    """
    status = instance.status

    # ── A. Pass → update ResultSheet ese_marks + pass_status, clear backlogs ──
    if status == ExamAttemptStatusEnum.PASS:
        _sync_result_sheet_ese(instance)
        _clear_backlogs(instance)

    # ── B. Fail / Absent → ensure an Active backlog exists ───────────────────
    elif status in (ExamAttemptStatusEnum.FAIL, ExamAttemptStatusEnum.ABSENT):
        reason = (
            BacklogReasonEnum.FAILED
            if status == ExamAttemptStatusEnum.FAIL
            else BacklogReasonEnum.ABSENT
        )
        _ensure_backlog(instance, reason)
        # Also update ResultSheet pass_status for Fail with ese_marks
        if status == ExamAttemptStatusEnum.FAIL and instance.ese_marks is not None:
            _sync_result_sheet_ese(instance, force_status=PassStatusEnum.FAIL)

    # ── C. Withheld → mark result sheet ──────────────────────────────────────
    elif status == ExamAttemptStatusEnum.WITHHELD:
        try:
            sheet = ResultSheet.objects.get(student=instance.student, course=instance.course)
            ResultSheet.objects.filter(pk=sheet.pk).update(pass_status=PassStatusEnum.WITHHELD)
        except ResultSheet.DoesNotExist:
            pass

    # ── D. Always refresh aggregated stats ───────────────────────────────────
    CourseExamStats.refresh_for(
        course=instance.course,
        academic_year=instance.academic_year,
        attempt_type=instance.attempt_type,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sync_result_sheet_ese(attempt: ExamAttempt, force_status=None):
    """
    Copy ese_marks from the attempt into ResultSheet and recompute grand_total + pass_status.
    Only updates when ese_marks is set on the attempt.
    """
    if attempt.ese_marks is None:
        return

    try:
        sheet = ResultSheet.objects.select_related('course').get(
            student=attempt.student, course=attempt.course,
        )
    except ResultSheet.DoesNotExist:
        sheet = ResultSheet.objects.create(
            student=attempt.student, course=attempt.course,
        )

    course      = attempt.course
    int_total   = sheet.int_total or 0
    ese_marks   = attempt.ese_marks
    grand_total = (
        int_total * course.int_weightage / 100 +
        ese_marks * course.ese_weightage / 100
    )

    if force_status:
        pass_status = force_status
    else:
        pass_status = (
            PassStatusEnum.PASS
            if grand_total >= ResultSheet.PASS_THRESHOLD
            else PassStatusEnum.FAIL
        )

    ResultSheet.objects.filter(pk=sheet.pk).update(
        ese_marks=ese_marks,
        grand_total=grand_total,
        pass_status=pass_status,
    )


def _ensure_backlog(attempt: ExamAttempt, reason: str):
    """
    Create an Active backlog for this student+course if one doesn't already exist.
    Uses origin_attempt to de-duplicate (one backlog per attempt that caused it).
    """
    StudentBacklog.objects.get_or_create(
        student=attempt.student,
        course=attempt.course,
        origin_attempt=attempt,
        defaults={
            'reason': reason,
            'status': BacklogStatusEnum.ACTIVE,
        },
    )


def _clear_backlogs(attempt: ExamAttempt):
    """
    Mark all Active backlogs for this student+course as Cleared,
    pointing to this passing attempt.
    """
    StudentBacklog.objects.filter(
        student=attempt.student,
        course=attempt.course,
        status=BacklogStatusEnum.ACTIVE,
    ).update(
        status=BacklogStatusEnum.CLEARED,
        clearing_attempt=attempt,
    )
