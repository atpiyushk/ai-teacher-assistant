# """add student_answers column to submissions

# Revision ID: add_student_answers
# Revises: 
# Create Date: 2025-06-15 00:00:00.000000

# """
# from alembic import op
# import sqlalchemy as sa
# from sqlalchemy.dialects import postgresql

# # revision identifiers, used by Alembic.
# revision = 'add_student_answers'
# down_revision = None
# branch_labels = None
# depends_on = None


# def upgrade():
#     # Add student_answers column to submissions table
#     op.add_column('submissions', sa.Column('student_answers', postgresql.JSON(astext_type=sa.Text()), nullable=True))


# def downgrade():
#     # Remove student_answers column from submissions table
#     op.drop_column('submissions', 'student_answers')