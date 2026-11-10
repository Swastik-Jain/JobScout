"""add resume_json to resume_version

Revision ID: 82c354833244
Revises: aee5b57be30c
Create Date: 2026-10-31 07:44:04.185745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82c354833244'
down_revision: Union[str, Sequence[str], None] = 'aee5b57be30c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('resumeversion', schema=None) as batch_op:
        batch_op.add_column(sa.Column('resume_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('resumeversion', schema=None) as batch_op:
        batch_op.drop_column('resume_json')

