from sqlalchemy import (
    Column, Integer, Text, Boolean, CheckConstraint, UniqueConstraint,
    ForeignKey, event
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
    kind = Column(Text, nullable=False)
    notes = Column(Text)

    volumes = relationship("Volume", back_populates="repository")


class Volume(Base):
    __tablename__ = "volumes"

    id = Column(Integer, primary_key=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    document_number = Column(Integer, nullable=False)
    serial = Column(Text, nullable=False, unique=True)
    library_shelfmark = Column(Text)
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
    notes = Column(Text)

    ancestors = relationship("PersonAncestor", back_populates="person", order_by="PersonAncestor.position")
    name_variants = relationship("PersonNameVariant", back_populates="person")
    relationships = relationship("PersonRelationship", back_populates="person")


class PersonAncestor(Base):
    __tablename__ = "person_ancestors"

    id = Column(Integer, primary_key=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    position = Column(Integer, nullable=False)
    name = Column(Text, nullable=False)

    person = relationship("Person", back_populates="ancestors")

    __table_args__ = (UniqueConstraint("person_id", "position"),)


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
    work_type = Column(Text)
    start_unit = Column(Text)
    end_unit = Column(Text)
    notes = Column(Text)

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
    date_as_written = Column(Text)
    date_earliest = Column(Integer)
    date_latest = Column(Integer)
    date_precision = Column(Text)
    image_location = Column(Text)
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
    confidence = Column(Text, nullable=False)
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
