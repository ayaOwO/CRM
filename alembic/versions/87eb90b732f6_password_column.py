"""password_column

Revision ID: 87eb90b732f6
Revises: 58d422083a87
Create Date: 2026-10-19 13:00:49.602351

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "87eb90b732f6"
down_revision: str | Sequence[str] | None = "58d422083a87"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

column_name = "password"
table_name = "users"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(table_name, sa.Column(column_name, sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column(table_name, column_name)
