import { NenkinServiceType } from 'src/common/constatns/master-data';
import { declarationB } from './declaration-b';
import { declarationSeparate } from './declaration-separate';
import { entrustApplication } from './entrust-application';
import { finalDeclarationB } from './final-declaration-b';
import { requestApplication } from './request-application';
import { taxManagerNotice } from './tax-manager-notice';
import { PaperTemplate } from './types';

/** Bảng toạ độ của từng mẫu, tra theo `code`. */
export const PAPER_TEMPLATES: Record<string, PaperTemplate> =
  Object.fromEntries(
    [
      requestApplication,
      entrustApplication,
      taxManagerNotice,
      declarationB,
      declarationSeparate,
      finalDeclarationB,
    ].map((t) => [t.code, t]),
  );

/** Thứ tự các mẫu trong bộ hồ sơ của mỗi lần thủ tục. */
export const TEMPLATES_BY_SERVICE: Record<NenkinServiceType, string[]> = {
  [NenkinServiceType.FIRST]: ['RequestApplication', 'EntrustApplication'],
  [NenkinServiceType.SECOND]: [
    'TaxManagerNotice',
    'DeclarationB',
    'DeclarationSeparate',
    'FinalDeclarationB',
  ],
};

export * from './types';
