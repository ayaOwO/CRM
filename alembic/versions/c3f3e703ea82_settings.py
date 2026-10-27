"""settings

Revision ID: c3f3e703ea82
Revises: e2f6cfe582b1
Create Date: 2026-10-12 00:44:07.752388

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3f3e703ea82"
down_revision: str | Sequence[str] | None = "e2f6cfe582b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(200), unique=True, nullable=False),
        sa.Column("settings", postgresql.JSONB(), nullable=False, default=""),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("users")
