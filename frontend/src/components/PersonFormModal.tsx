import { PersonForm } from "../screens/persons/PersonForm";
import type { Person } from "../api/types";

interface Props {
  person: Person | null;
  initialName?: string;
  onSaved: (person: Person) => void;
  onDeleted?: () => void;
  onCancel: () => void;
}

export function PersonFormModal(props: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="نموذج الشخص">
      <div className="modal-box modal-box--form modal-box--tall">
        <PersonForm {...props} />
      </div>
    </div>
  );
}
