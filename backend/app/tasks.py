"""
Celery tasks for async operations.
"""
from celery import Celery
from app.config import settings

celery_app = Celery("crm_tasks", broker=settings.redis_url, backend=settings.redis_url)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
)


@celery_app.task
def send_notification(user_id: str, title: str, content: str):
    """Send notification to user (placeholder)."""
    # TODO: integrate with websocket/push service
    print(f"Notification to {user_id}: {title} - {content}")
    return True


@celery_app.task
def generate_contract_pdf(contract_id: str):
    """Generate contract PDF document (placeholder)."""
    # TODO: use reportlab or weasyprint to generate PDF
    print(f"Generating PDF for contract {contract_id}")
    return True


@celery_app.task
def update_project_progress(project_id: str):
    """Auto-calculate project progress based on stage completion."""
    print(f"Updating progress for project {project_id}")
    return True


@celery_app.task
def daily_report_digest(tenant_id: str):
    """Generate and send daily report to tenant admin."""
    print(f"Generating daily report for tenant {tenant_id}")
    return True
