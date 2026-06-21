import { WorkForm } from "../screens/volumes/WorkForm";
import type { Relationship, Work } from "../api/types";

interface Props {
  volumeId: number;
  work: Work | null;
  relationships?: Relationship[];
  personMap?: Map<number, string>;
  folioCount?: number | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function WorkFormModal(props: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="نموذج العنوان">
      <div className="modal-box modal-box--form modal-box--tall">
        <WorkForm {...props} />
      </div>
    </div>
  );
}
