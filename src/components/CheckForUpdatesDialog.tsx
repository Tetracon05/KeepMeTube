import React from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { AppUpdateInfo, UpdateCheckResult } from "../types";
import { IconRefreshCw } from "./Icons";
import { UpdateCheckControls } from "./UpdateCheckControls";

interface CheckForUpdatesDialogProps {
  onClose: () => void;
  pendingAppUpdate: AppUpdateInfo | null;
  pendingYtDlpUpdate: UpdateCheckResult | null;
  onTriggerAppUpdate: () => void;
  onTriggerYtDlpUpdate: () => void;
  onCheckUpdates: () => Promise<{ appError: boolean; ytError: boolean }>;
}

/** Opened from the macOS app menu's "Check for Updates..." item. */
export const CheckForUpdatesDialog: React.FC<CheckForUpdatesDialogProps> = ({
  onClose,
  pendingAppUpdate,
  pendingYtDlpUpdate,
  onTriggerAppUpdate,
  onTriggerYtDlpUpdate,
  onCheckUpdates,
}) => {
  const { t } = useLanguage();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t("settings_checkForUpdates")}</h2>
          <button className="modal-close" onClick={onClose}>X</button>
        </div>

        <div className="modal-body">
          <div className="confirm-icon-wrapper confirm-icon-wrapper--neutral">
            <IconRefreshCw size={28} className="confirm-icon" />
          </div>
          <div className="dialog-update-controls">
            <UpdateCheckControls
              pendingAppUpdate={pendingAppUpdate}
              pendingYtDlpUpdate={pendingYtDlpUpdate}
              onTriggerAppUpdate={onTriggerAppUpdate}
              onTriggerYtDlpUpdate={onTriggerYtDlpUpdate}
              onCheckUpdates={onCheckUpdates}
              autoCheck
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common_close")}
          </button>
        </div>
      </div>
    </div>
  );
};
