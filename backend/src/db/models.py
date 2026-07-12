from sqlalchemy import (
    Column, Integer, Text, Boolean, CheckConstraint, UniqueConstraint,
    ForeignKey,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Vocab(Base):
    __tablename__ = "vocab"

    id = Column(Integer, primary_key=True)
    category = Column(Text, nullable=False)
    value = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (UniqueConstraint("category", "value"),)


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True)
    place_key = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    location = Column(Text)
    notes = Column(Text)

    volumes = relationship("Volume", back_populates="repository")


class Volume(Base):
    __tablename__ = "volumes"

    id = Column(Integer, primary_key=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    document_number = Column(Integer, nullable=False)
    serial = Column(Text, nullable=False, unique=True)
    repository_volume_number = Column(Integer)
    folio_count = Column(Integer)
    notes = Column(Text)

    repository = relationship("Repository", back_populates="volumes")
    works = relationship("Work", back_populates="volume")
    annotations = relationship("Annotation", back_populates="volume")
    person_relationships = relationship("PersonRelationship", back_populates="volume")

    __table_args__ = (UniqueConstraint("repository_id", "document_number"),)


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True)
    preferred_name = Column(Text, nullable=False)
    ism = Column(Text)
    nisba_1 = Column(Text)
    nisba_2 = Column(Text)
    laqab = Column(Text)
    nasab = Column(Text)
    notes = Column(Text)

    kunya = Column(Text)
    known_as = Column(Text)
    birth_date_as_written = Column(Text)
    birth_year_earliest = Column(Integer)
    birth_year_latest = Column(Integer)
    death_date_as_written = Column(Text)
    death_year_earliest = Column(Integer)
    death_year_latest = Column(Integer)
    birth_place = Column(Text)
    death_place = Column(Text)

    name_variants = relationship("PersonNameVariant", back_populates="person")
    wilayas = relationship("PersonWilaya", back_populates="person")
    relationships = relationship("PersonRelationship", back_populates="person")


class PersonWilaya(Base):
    __tablename__ = "person_wilayas"

    id = Column(Integer, primary_key=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    wilaya = Column(Text, nullable=False)

    person = relationship("Person", back_populates="wilayas")


class PersonNameVariant(Base):
    __tablename__ = "person_name_variants"

    id = Column(Integer, primary_key=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    written_form = Column(Text, nullable=False)
    normalized_form = Column(Text)
    source_annotation_id = Column(Integer, ForeignKey("annotations.id"))
    notes = Column(Text)

    person = relationship("Person", back_populates="name_variants")
    source_annotation = relationship("Annotation")

    __table_args__ = (UniqueConstraint("person_id", "written_form"),)


class Work(Base):
    __tablename__ = "works"

    id = Column(Integer, primary_key=True)
    volume_id = Column(Integer, ForeignKey("volumes.id"), nullable=False)
    title = Column(Text, nullable=False)
    title_source = Column(Text)
    part_number = Column(Integer)          # الأجزاء — this title's part number within a multi-part work
    incipit = Column(Text)
    explicit = Column(Text)
    start_unit = Column(Text)
    end_unit = Column(Text)
    notes = Column(Text)

    # Structured Hijri copy date — all nullable (NULL = مجهول, researcher must explicitly choose)
    topic_category = Column(Text)
    topic_subcategory = Column(Text)

    copy_place = Column(Text)
    copy_date_as_written = Column(Text)   # verbatim witness from the manuscript
    copy_year = Column(Integer)
    copy_month = Column(Text)             # one of the 12 Hijri month names
    copy_day = Column(Integer)            # 1–30
    copy_weekday = Column(Text)           # one of the 7 Arabic weekday names
    copy_time = Column(Text)              # controlled vocab (copy_time category)

    volume = relationship("Volume", back_populates="works")
    annotations = relationship("Annotation", back_populates="work")
    person_relationships = relationship("PersonRelationship", back_populates="work")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True)
    volume_id = Column(Integer, ForeignKey("volumes.id"), nullable=False)
    work_id = Column(Integer, ForeignKey("works.id"))
    annotation_type = Column(Text, nullable=False)
    text_as_written = Column(Text)
    image_location = Column(Text)
    annotation_year = Column(Integer)
    annotation_month = Column(Text)       # one of the 12 Hijri month names
    annotation_day = Column(Integer)      # 1-30
    annotation_weekday = Column(Text)     # one of the 7 Arabic weekday names
    annotation_time = Column(Text)        # free text
    notes = Column(Text)

    volume = relationship("Volume", back_populates="annotations")
    work = relationship("Work", back_populates="annotations")
    person_relationships = relationship("PersonRelationship", back_populates="evidence_annotation")


class PersonRelationship(Base):
    __tablename__ = "person_relationships"

    id = Column(Integer, primary_key=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    level = Column(Text, nullable=False)
    volume_id = Column(Integer, ForeignKey("volumes.id"))
    work_id = Column(Integer, ForeignKey("works.id"))
    role = Column(Text, nullable=False)
    evidence_source = Column(Text)
    evidence_annotation_id = Column(Integer, ForeignKey("annotations.id"))
    notes = Column(Text)

    person = relationship("Person", back_populates="relationships")
    volume = relationship("Volume", back_populates="person_relationships")
    work = relationship("Work", back_populates="person_relationships")
    evidence_annotation = relationship("Annotation", back_populates="person_relationships")

    __table_args__ = (
        CheckConstraint(
            "(level = 'work'   AND work_id   IS NOT NULL AND volume_id IS NULL) OR "
            "(level = 'volume' AND volume_id IS NOT NULL AND work_id   IS NULL)",
            name="ck_person_relationships_level"
        ),
    )


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id = Column(Integer, primary_key=True)
    commit_id = Column(Text, nullable=False)
    occurred_at = Column(Text, nullable=False)   # ISO8601 UTC
    table_name = Column(Text, nullable=False)
    record_id = Column(Integer, nullable=False)
    action = Column(Text, nullable=False)         # create | update | delete
    label = Column(Text)                          # display hint: serial, title, name…
