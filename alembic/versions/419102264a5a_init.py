"""Create contacts table.

Revision ID: 419102264a5a
Revises: init contacts table
Create Date: 2026-10-11 17:15:40.722521

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "419102264a5a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("google_docs_link", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        "ix_contacts_notes_trgm",
        "contacts",
        ["notes"],
        postgresql_using="gin",
        postgresql_ops={"notes": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_contacts_first_last_name",
        "contacts",
        ["first_name", "last_name"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("contacts", if_exists=True)
