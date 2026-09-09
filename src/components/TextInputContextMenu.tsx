import React from "react";
import { useLanguage } from "../hooks/useLanguage";

interface TextInputContextMenuProps {
  x: number;
  y: number;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClose: () => void;
}

/**
 * A minimal Cut/Copy/Paste/Select All menu for plain text inputs.
 *
 * Exists because not every user knows (or wants to use) Ctrl+V/Cmd+V, and
 * the webview doesn't reliably surface a native right-click menu with a
 * working Paste item on every platform.
 */
export const TextInputContextMenu: React.FC<TextInputContextMenuProps> = ({
  x,
  y,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
  onClose,
}) => {
  const { t } = useLanguage();
  const style: React.CSSProperties = { position: "fixed", top: y, left: x, zIndex: 1000 };

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div className="context-menu" style={style} onClick={(e) => e.stopPropagation()}>
        <button className="context-menu-item" onClick={onCut}>{t("textMenu_cut")}</button>
        <button className="context-menu-item" onClick={onCopy}>{t("textMenu_copy")}</button>
        <button className="context-menu-item" onClick={onPaste}>{t("textMenu_paste")}</button>
        <div className="context-menu-divider" />
        <button className="context-menu-item" onClick={onSelectAll}>{t("modal_selectAll")}</button>
      </div>
    </div>
  );
};
