"""Allow assigning the booking hash after the scheduler ID is generated."""

import sqlalchemy as sa

from alembic import op

revision = "b7d120260002"
down_revision = "a8b120260001"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "schedulers", "code_hash", existing_type=sa.String(64), nullable=True
    )


def downgrade():
    op.alter_column(
        "schedulers", "code_hash", existing_type=sa.String(64), nullable=False
    )
