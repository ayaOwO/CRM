"""userconfig

Revision ID: 58d422083a87
Revises: c3f3e703ea82
Create Date: 2026-10-15 23:32:33.064708

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "58d422083a87"
down_revision: str | Sequence[str] | None = "c3f3e703ea82"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_id_column = "user_id"
tables_to_update = ["appointments", "contacts"]


def upgrade() -> None:
    """Upgrade schema."""
    for table in tables_to_update:
        op.add_column(
            table,
            sa.Column(
                user_id_column,
                sa.Integer,
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.execute(f"UPDATE {table} SET user_id = 1 WHERE user_id IS NULL")
        op.alter_column(table, user_id_column, nullable=False)
    op.alter_column("users", "settings", server_default="{}")


def downgrade() -> None:
    """Downgrade schema."""
    for table in tables_to_update:
        op.drop_column(table, user_id_column)
