"""Scheduler settings, guest access, booking ownership and rate limits."""

import sqlalchemy as sa

from alembic import op

revision = "a8b120260001"
down_revision = "87eb90b732f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("appointments", sa.Column("notes", sa.Text(), nullable=True))
    op.create_table(
        "schedulers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
    )
    op.create_index("ix_schedulers_user_id", "schedulers", ["user_id"])
    op.create_table(
        "guest_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_table(
        "guest_bookings",
        sa.Column(
            "appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "scheduler_id",
            sa.Integer(),
            sa.ForeignKey("schedulers.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "session_hash",
            sa.String(64),
            sa.ForeignKey("guest_sessions.token_hash"),
            nullable=False,
        ),
        sa.Column("management_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
    )
    op.create_index("ix_guest_bookings_user_id", "guest_bookings", ["user_id"])
    op.create_index(
        "ix_guest_bookings_session_hash", "guest_bookings", ["session_hash"]
    )
    op.create_table(
        "booking_rate_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("window", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("booking_rate_limits")
    op.drop_table("guest_bookings")
    op.drop_table("guest_sessions")
    op.drop_table("schedulers")
    op.drop_column("appointments", "notes")
