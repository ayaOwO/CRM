"""appointments

Revision ID: e2f6cfe582b1
Revises: 419102264a5a
Create Date: 2026-10-11 19:13:46.975327

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2f6cfe582b1"
down_revision: str | Sequence[str] | None = "419102264a5a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location", sa.Text(), nullable=False),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.CheckConstraint("end_time > start_time", name="ck_appointments_time_range"),
    )
    op.create_index("ix_appointments_start_time", "appointments", ["start_time"])
    op.create_table(
        "appointment_guests",
        sa.Column(
            "appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "contact_id",
            sa.Integer(),
            sa.ForeignKey("contacts.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )
    op.create_index(
        "ix_appointment_guests_contact_id", "appointment_guests", ["contact_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("appointment_guests")
    op.drop_table("appointments")
