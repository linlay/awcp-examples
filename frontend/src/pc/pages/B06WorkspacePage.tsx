import { useEffect, useState, type ReactElement } from 'react';

import type { DemoRepository } from '../../common/store/repository';
import { DraftFormEditor } from '../components/DraftFormEditor';
import { ExpenseCheckForm } from '../components/ExpenseCheckForm';
import { ExpenseFlowPanel } from '../components/ExpenseFlowPanel';
import { FormTableFilter } from '../components/FormTableFilter';
import { TravelSubmitForm } from '../components/TravelSubmitForm';
import { DraftFormService } from '../service/draftFormService';
import { ExpenseService } from '../service/expenseService';
import { ExpenseFlowService } from '../service/expenseFlowService';
import { TravelService } from '../service/travelService';
import styles from './B06WorkspacePage.module.css';

interface B06WorkspacePageProps {
  repository: DemoRepository;
  objectId?: string;
  formType?: string;
}

export default function B06WorkspacePage({ repository, objectId, formType }: B06WorkspacePageProps): ReactElement {
  const [service] = useState(() => new DraftFormService(repository));
  const [travelService] = useState(() => new TravelService(repository));
  const [expenseService] = useState(() => new ExpenseService(repository));
  const [expenseFlowService] = useState(() => new ExpenseFlowService(repository));
  const [rows, setRows] = useState(() => service.listRows());
  const formId = objectId ?? 'FORM-002';
  const [selectedTableId, setSelectedTableId] = useState<string | null>(formId);

  useEffect(() => service.subscribe(() => setRows(service.listRows())), [service]);

  const form = rows.find((item) => item.id === formId);

  return (
    <section className={styles.page} aria-labelledby="b06-title">
      <p className={styles.eyebrow}>B06 共用组件演示</p>
      <h1 id="b06-title">差旅与费用</h1>
      <p>提交虚构出差申请、核验费用，再完成报销审批和退回补正；下方草稿区域演示 B06 共用组件。</p>
      {formType === 'travel' && <TravelSubmitForm service={travelService} />}
      {formType === 'expense' && <ExpenseCheckForm service={expenseService} />}
      {!formType && <ExpenseFlowPanel service={expenseFlowService} objectId={objectId} />}
      {!formType && (
      <div className={styles.grid}>
        <FormTableFilter rows={rows} selectedFormId={selectedTableId} onSelect={setSelectedTableId} />
        {form?.status === 'draft' ? (
          <DraftFormEditor service={service} formId={formId} actionId="office.travel-draft.save" />
        ) : (
          <div className={styles.notice} role="status">
            {form ? `${formId} 当前为 ${form.status}，此基础适配仅编辑草稿。` : `${formId} 不存在。`}
          </div>
        )}
      </div>
      )}
      {!formType && <p className={styles.note}>编辑对象由页面地址决定。</p>}
    </section>
  );
}
